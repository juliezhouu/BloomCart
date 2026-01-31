import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger.js';

import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// console.log(genAI);

// Use basic model configuration without structured output parameters
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash-8b'
});

/**
 * Clean and structure Amazon product data using Gemini AI
 */
export const cleanProductData = async (scrapedData) => {
  try {
    const prompt = `
You are a data extraction expert. Clean and structure this Amazon product data and return ONLY valid JSON:

Raw Data:
Title: ${scrapedData.title}
Product Details: ${JSON.stringify(scrapedData.details || {})}
Category: ${scrapedData.category || 'N/A'}
Description: ${scrapedData.description || 'N/A'}

Return ONLY a valid JSON object with these exact fields:
{
  "cleanedTitle": "A concise, clean product title",
  "weight": {
    "value": number,
    "unit": "kg"
  },
  "materials": ["material1", "material2"],
  "category": "Electronics|Clothing|Home|etc",
  "productDescription": "1-2 sentence description for carbon analysis"
}

Rules:
- Convert weight to kg if possible, estimate if not found
- List specific materials (plastic, metal, cotton, etc.)
- Be precise with weight extraction and material identification
- Return ONLY valid JSON, no other text
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text().trim();
    
    let cleanedData;
    try {
      // Try to parse the JSON response
      cleanedData = JSON.parse(responseText);
    } catch (parseError) {
      // If JSON parsing fails, try to extract JSON from the response
      logger.warn('JSON parsing failed, attempting to extract JSON', { response: responseText.substring(0, 200) });
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from Gemini');
      }
    }

    // Validate required fields
    if (!cleanedData.cleanedTitle || !cleanedData.weight || !cleanedData.materials || !cleanedData.category) {
      throw new Error('Missing required fields in Gemini response');
    }

    logger.info('Gemini cleaned product data successfully', { asin: scrapedData.asin });
    return cleanedData;

  } catch (error) {
    logger.error('Gemini API error:', error);
    
    // Always use fallback data extraction when Gemini fails
    logger.warn('Gemini API unavailable, using fallback data extraction', { 
      asin: scrapedData.asin,
      error: error.message ? error.message.substring(0, 100) : 'Unknown error'
    });
    
    // Simple fallback data extraction without AI
    const titleLower = (scrapedData.title || '').toLowerCase();
    
    // Try to extract weight from title or details
    let estimatedWeight = 0.5; // default
    const weightRegex = /(\d+(?:\.\d+)?)\s*(kg|g|lb|oz|pound|gram|kilogram)/i;
    const titleMatch = titleLower.match(weightRegex);
    const detailsMatch = JSON.stringify(scrapedData.details || {}).match(weightRegex);
    
    if (titleMatch) {
      estimatedWeight = parseFloat(titleMatch[1]);
      const unit = titleMatch[2].toLowerCase();
      if (unit.includes('g') && !unit.includes('kg')) estimatedWeight /= 1000;
      if (unit.includes('lb') || unit.includes('pound')) estimatedWeight *= 0.453592;
      if (unit.includes('oz')) estimatedWeight *= 0.0283495;
    } else if (detailsMatch) {
      estimatedWeight = parseFloat(detailsMatch[1]);
      const unit = detailsMatch[2].toLowerCase();
      if (unit.includes('g') && !unit.includes('kg')) estimatedWeight /= 1000;
      if (unit.includes('lb') || unit.includes('pound')) estimatedWeight *= 0.453592;
      if (unit.includes('oz')) estimatedWeight *= 0.0283495;
    } else {
      // Category-based weight estimation
      if (titleLower.includes('paper') || titleLower.includes('book')) estimatedWeight = 0.2;
      else if (titleLower.includes('clothing') || titleLower.includes('shirt')) estimatedWeight = 0.3;
      else if (titleLower.includes('electronic') || titleLower.includes('phone')) estimatedWeight = 0.4;
      else if (titleLower.includes('furniture')) estimatedWeight = 5.0;
      else if (titleLower.includes('appliance')) estimatedWeight = 15.0;
    }
    
    // Category-based material estimation
    let materials = ['unknown'];
    if (titleLower.includes('plastic')) materials = ['plastic'];
    else if (titleLower.includes('metal') || titleLower.includes('steel')) materials = ['metal', 'steel'];
    else if (titleLower.includes('cotton') || titleLower.includes('fabric')) materials = ['cotton', 'fabric'];
    else if (titleLower.includes('wood')) materials = ['wood'];
    else if (titleLower.includes('glass')) materials = ['glass'];
    else if (titleLower.includes('paper')) materials = ['paper'];
    
    const cleanedData = {
      cleanedTitle: scrapedData.title || 'Unknown Product',
      weight: {
        value: estimatedWeight,
        unit: 'kg'
      },
      materials: materials,
      category: scrapedData.category || 'General',
      productDescription: scrapedData.description || scrapedData.title || 'Product analysis'
    };
    
    return cleanedData;
  }
};

/**
 * Estimate carbon footprint using Gemini (fallback when Climatiq fails)
 */
export const estimateCarbonFootprint = async (productData) => {
  try {
    const prompt = `
You are a sustainability expert. Estimate the carbon footprint for this product and return ONLY valid JSON:

Product: ${productData.cleanedTitle}
Weight: ${productData.weight.value} ${productData.weight.unit}
Materials: ${productData.materials.join(', ')}
Category: ${productData.category}

Return ONLY a valid JSON object with these exact fields:
{
  "estimatedCO2e": number,
  "confidence": "high|medium|low", 
  "reasoning": "Brief explanation of estimate"
}

Base your estimate on typical manufacturing, transportation, and material emissions.
Return ONLY valid JSON, no other text.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text().trim();
    
    let estimate;
    try {
      // Try to parse the JSON response
      estimate = JSON.parse(responseText);
    } catch (parseError) {
      // If JSON parsing fails, try to extract JSON from the response
      logger.warn('JSON parsing failed for carbon estimate, attempting to extract JSON', { response: responseText.substring(0, 200) });
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        estimate = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from Gemini for carbon estimation');
      }
    }

    // Validate required fields
    if (typeof estimate.estimatedCO2e !== 'number' || !estimate.confidence) {
      throw new Error('Missing required fields in Gemini carbon estimation response');
    }

    logger.info('Gemini estimated carbon footprint', {
      co2e: estimate.estimatedCO2e,
      confidence: estimate.confidence
    });

    return estimate;

  } catch (error) {
    logger.error('Gemini carbon estimation error:', error);
    
    // Always use fallback estimate when Gemini fails
    logger.warn('Gemini API unavailable, using basic carbon estimate', { 
      product: productData.cleanedTitle,
      error: error.message ? error.message.substring(0, 100) : 'Unknown error'
    });
      
      // Simple fallback carbon estimation based on materials and category
      const productTitle = (productData.cleanedTitle || '').toLowerCase();
      const materials = productData.materials || ['unknown'];
      
      let carbonMultiplier = 3.0; // base multiplier
      
      // Adjust based on materials
      if (materials.includes('plastic')) carbonMultiplier = 6.0;
      else if (materials.includes('metal') || materials.includes('steel')) carbonMultiplier = 8.0;
      else if (materials.includes('cotton') || materials.includes('fabric')) carbonMultiplier = 4.0;
      else if (materials.includes('wood')) carbonMultiplier = 1.5;
      else if (materials.includes('glass')) carbonMultiplier = 2.0;
      else if (materials.includes('paper')) carbonMultiplier = 1.0;
      
      // Adjust based on product type
      if (productTitle.includes('electronic') || productTitle.includes('phone') || productTitle.includes('computer')) {
        carbonMultiplier *= 2.5; // Electronics have high manufacturing footprint
      } else if (productTitle.includes('organic') || productTitle.includes('eco') || productTitle.includes('sustainable')) {
        carbonMultiplier *= 0.7; // Eco products typically lower
      } else if (productTitle.includes('fast fashion') || productTitle.includes('disposable')) {
        carbonMultiplier *= 1.8;
      }
      
      const basicEstimate = productData.weight.value * carbonMultiplier;
      
      return {
        estimatedCO2e: parseFloat(basicEstimate.toFixed(2)),
        confidence: 'low',
        reasoning: `Estimated based on ${materials.join(', ')} materials and ${productData.weight.value}kg weight`
      };
  }
};

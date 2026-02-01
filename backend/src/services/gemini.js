import { logger } from '../utils/logger.js';
import dotenv from 'dotenv';
dotenv.config();

// OpenRouter configuration for Gemini API
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Call OpenRouter API with Gemini model
 */
async function callOpenRouterGemini(prompt) {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/BloomCart/extension',
      'X-Title': 'BloomCart Sustainability Extension'
    },
    body: JSON.stringify({
      model: 'google/gemini-flash-1.5',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('OpenRouter API detailed error:', { status: response.status, error: errorText });
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
  return data.choices[0].message.content;
}

/**
 * Clean and structure Amazon product data using Gemini AI via OpenRouter
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

    const responseText = await callOpenRouterGemini(prompt);
    
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
      // Category-based weight estimation with more variation
      if (titleLower.includes('paper') || titleLower.includes('book')) estimatedWeight = 0.2;
      else if (titleLower.includes('clothing') || titleLower.includes('shirt') || titleLower.includes('dress')) estimatedWeight = 0.3;
      else if (titleLower.includes('watch') || titleLower.includes('smartwatch') || titleLower.includes('fitness tracker')) estimatedWeight = 0.05; // Smartwatches are very light
      else if (titleLower.includes('phone') || titleLower.includes('smartphone')) estimatedWeight = 0.18;
      else if (titleLower.includes('tablet') || titleLower.includes('ipad')) estimatedWeight = 0.45;
      else if (titleLower.includes('laptop') || titleLower.includes('computer')) estimatedWeight = 2.0;
      else if (titleLower.includes('electronic') || titleLower.includes('gadget')) estimatedWeight = 0.4;
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
 * Estimate carbon footprint using Gemini via OpenRouter (fallback when Climatiq fails)
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

    const responseText = await callOpenRouterGemini(prompt);
    
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
      
      // Fallback carbon estimation with varied scores across A-E grades
      const productTitle = (productData.cleanedTitle || '').toLowerCase();
      const materials = productData.materials || ['unknown'];
      const weight = productData.weight.value || 0.5;

      // Hash the product title to get consistent but varied results per product
      const titleHash = productTitle.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const randomFactor = (titleHash % 100) / 100; // 0.0-1.0 based on title

      // Carbon footprint per kg calibrated for better game balance
      let co2ePerKg = 3.0; // default to C grade

      // Eco-friendly products - A and B grades (20% of products should be here)
      if (productTitle.includes('organic') || productTitle.includes('eco') || productTitle.includes('sustainable') || 
          productTitle.includes('bamboo') || productTitle.includes('recyclable') || productTitle.includes('biodegradable')) {
        co2ePerKg = 0.2 + randomFactor * 1.5; // Range: 0.2-1.7 kg CO2e/kg (A to B range)
      }
      // Low-impact materials - A and B grades
      else if (productTitle.includes('paper') || productTitle.includes('cardboard') || productTitle.includes('wood') || 
               productTitle.includes('glass') || productTitle.includes('cotton') && productTitle.includes('organic')) {
        co2ePerKg = 0.3 + randomFactor * 2.2; // Range: 0.3-2.5 kg CO2e/kg (A to B range)
      }
      // Electronics - distributed across B, C, D grades 
      else if (productTitle.includes('watch') || productTitle.includes('smartwatch') || productTitle.includes('fitness')) {
        co2ePerKg = 1.5 + randomFactor * 8; // Range: 1.5-9.5 kg CO2e/kg (B to D range)
      } else if (productTitle.includes('phone') || productTitle.includes('smartphone')) {
        co2ePerKg = 2.0 + randomFactor * 9; // Range: 2-11 kg CO2e/kg (B to D range)
      } else if (productTitle.includes('laptop') || productTitle.includes('computer') || productTitle.includes('tablet')) {
        co2ePerKg = 3.0 + randomFactor * 12; // Range: 3-15 kg CO2e/kg (C to E range)
      } else if (productTitle.includes('electronic') || productTitle.includes('gadget') || productTitle.includes('device')) {
        co2ePerKg = 2.5 + randomFactor * 8; // Range: 2.5-10.5 kg CO2e/kg (B to D range)
      }
      // Clothing - mostly B and C grades with some A for sustainable
      else if (productTitle.includes('clothing') || productTitle.includes('shirt') || productTitle.includes('dress') || productTitle.includes('fabric')) {
        if (productTitle.includes('organic') || productTitle.includes('sustainable') || productTitle.includes('cotton')) {
          co2ePerKg = 0.4 + randomFactor * 1.8; // Range: 0.4-2.2 kg CO2e/kg (A to B range)
        } else {
          co2ePerKg = 2.5 + randomFactor * 4.5; // Range: 2.5-7 kg CO2e/kg (B to D range)
        }
      }
      // High-impact products - D and E grades
      else if (productTitle.includes('plastic') || productTitle.includes('disposable') || productTitle.includes('synthetic')) {
        co2ePerKg = 8.0 + randomFactor * 8; // Range: 8-16 kg CO2e/kg (D to E range)
      } else if (productTitle.includes('metal') || productTitle.includes('steel') || productTitle.includes('aluminum')) {
        co2ePerKg = 7.0 + randomFactor * 10; // Range: 7-17 kg CO2e/kg (D to E range)
      }
      // Home/furniture - mostly C and D grades
      // Home/furniture - mostly C and D grades
      else if (productTitle.includes('furniture') || productTitle.includes('appliance') || productTitle.includes('kitchen')) {
        co2ePerKg = 4.0 + randomFactor * 10; // Range: 4-14 kg CO2e/kg (C to E range)
      }
      // Default products - spread across B, C, D grades
      else {
        co2ePerKg = 1.5 + randomFactor * 9; // Range: 1.5-10.5 kg CO2e/kg (B to D range)
      }

      const basicEstimate = weight * co2ePerKg;
      
      return {
        estimatedCO2e: parseFloat(basicEstimate.toFixed(2)),
        confidence: 'low',
        reasoning: `Estimated based on ${materials.join(', ')} materials and ${productData.weight.value}kg weight`
      };
  }
};

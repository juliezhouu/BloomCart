import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger.js';

import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// console.log(genAI);

// Gemini supports structured outputs with JSON Schema
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash-8b',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'object',
      properties: {
        cleanedTitle: { type: 'string' },
        weight: {
          type: 'object',
          properties: {
            value: { type: 'number' },
            unit: { type: 'string' }
          }
        },
        materials: {
          type: 'array',
          items: { type: 'string' }
        },
        category: { type: 'string' },
        productDescription: { type: 'string' }
      }
    }
  }
});

/**
 * Clean and structure Amazon product data using Gemini AI
 */
export const cleanProductData = async (scrapedData) => {
  try {
    const prompt = `
You are a data extraction expert. Clean and structure this Amazon product data:

Raw Data:
Title: ${scrapedData.title}
Product Details: ${JSON.stringify(scrapedData.details || {})}
Category: ${scrapedData.category || 'N/A'}
Description: ${scrapedData.description || 'N/A'}

Extract and return:
1. cleanedTitle: A concise, clean product title
2. weight: { value: number, unit: 'kg'|'g'|'lb'|'oz' }
   - Convert to kg if possible
   - If weight not found, estimate based on product type
3. materials: Array of materials (plastic, metal, cotton, etc.)
4. category: Product category (Electronics, Clothing, Home, etc.)
5. productDescription: 1-2 sentence description for carbon analysis

Be precise with weight extraction and material identification.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const cleanedData = JSON.parse(response.text());

    logger.info('Gemini cleaned product data successfully', { asin: scrapedData.asin });
    return cleanedData;

  } catch (error) {
    logger.error('Gemini API error:', error);
    
    // Handle API errors with fallback data (quota, invalid key, etc.)
    if (error.message && (
      error.message.includes('quota') || 
      error.message.includes('RESOURCE_EXHAUSTED') ||
      error.message.includes('API key not valid') ||
      error.message.includes('API_KEY_INVALID')
    )) {
      logger.warn('Gemini API unavailable, using fallback data extraction', { 
        asin: scrapedData.asin,
        error: error.message.substring(0, 100) 
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
    
    throw new Error('Failed to clean product data with Gemini');
  }
};

/**
 * Estimate carbon footprint using Gemini (fallback when Climatiq fails)
 */
export const estimateCarbonFootprint = async (productData) => {
  try {
    const prompt = `
You are a sustainability expert. Estimate the carbon footprint for this product:

Product: ${productData.cleanedTitle}
Weight: ${productData.weight.value} ${productData.weight.unit}
Materials: ${productData.materials.join(', ')}
Category: ${productData.category}

Provide:
1. estimatedCO2e: Total carbon footprint in kg CO2e
2. confidence: 'high'|'medium'|'low'
3. reasoning: Brief explanation of estimate

Base your estimate on typical manufacturing, transportation, and material emissions.
Return as JSON: { estimatedCO2e: number, confidence: string, reasoning: string }
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const estimate = JSON.parse(response.text());

    logger.info('Gemini estimated carbon footprint', {
      co2e: estimate.estimatedCO2e,
      confidence: estimate.confidence
    });

    return estimate;

  } catch (error) {
    logger.error('Gemini carbon estimation error:', error);
    
    // Handle API errors with fallback estimate
    if (error.message && (
      error.message.includes('quota') || 
      error.message.includes('RESOURCE_EXHAUSTED') ||
      error.message.includes('API key not valid') ||
      error.message.includes('API_KEY_INVALID')
    )) {
      logger.warn('Gemini API unavailable, using basic carbon estimate', { 
        product: productData.cleanedTitle 
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
    
    throw new Error('Failed to estimate carbon footprint');
  }
};

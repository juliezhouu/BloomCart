import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Gemini 2.0 supports structured outputs with JSON Schema
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
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
    throw new Error('Failed to estimate carbon footprint');
  }
};

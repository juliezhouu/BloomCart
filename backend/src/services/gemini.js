import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger.js';

// Initialize Gemini client lazily
const getGeminiModel = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
};

/**
 * Clean and structure Amazon product data using Gemini AI
 */
export const cleanProductData = async (scrapedData) => {
  try {
    const model = getGeminiModel();
    
    const prompt = `
You are a data extraction expert. Clean and structure this Amazon product data:

Raw Data:
Title: ${scrapedData.title}
Product Details: ${JSON.stringify(scrapedData.details || {})}
Category: ${scrapedData.category || 'N/A'}
Description: ${scrapedData.description || 'N/A'}

Extract and return ONLY a valid JSON object with these fields:
1. cleanedTitle: A concise, clean product title
2. weight: { value: number, unit: 'kg'|'g'|'lb'|'oz' }
   - Convert to kg if possible
   - If weight not found, estimate based on product type
3. materials: Array of materials (plastic, metal, cotton, etc.)
4. category: Product category (Electronics, Clothing, Home, etc.)
5. productDescription: 1-2 sentence description for carbon analysis

Be precise with weight extraction and material identification.
Return only the JSON object, no other text.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();
    
    // Parse JSON from the response
    let cleanedData;
    try {
      // Remove any potential markdown formatting
      const jsonText = responseText.replace(/```json\n?|```/g, '').trim();
      cleanedData = JSON.parse(jsonText);
    } catch (parseError) {
      logger.error('Failed to parse Gemini JSON response:', parseError);
      logger.error('Raw response:', responseText);
      throw new Error('Invalid JSON response from Gemini');
    }

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
    const model = getGeminiModel();
    
    const prompt = `
You are a sustainability expert. Estimate the carbon footprint for this product:

Product: ${productData.cleanedTitle}
Weight: ${productData.weight.value} ${productData.weight.unit}
Materials: ${productData.materials.join(', ')}
Category: ${productData.category}

Return ONLY a valid JSON object with:
1. estimatedCO2e: Total carbon footprint in kg CO2e
2. confidence: 'high'|'medium'|'low'
3. reasoning: Brief explanation of estimate

Base your estimate on typical manufacturing, transportation, and material emissions.
Return only the JSON object, no other text.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();
    
    // Parse JSON from the response
    let estimate;
    try {
      const jsonText = responseText.replace(/```json\n?|```/g, '').trim();
      estimate = JSON.parse(jsonText);
    } catch (parseError) {
      logger.error('Failed to parse Gemini carbon estimate JSON:', parseError);
      logger.error('Raw response:', responseText);
      throw new Error('Invalid JSON response from Gemini carbon estimation');
    }

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

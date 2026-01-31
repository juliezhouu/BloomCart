import axios from 'axios';
import { logger } from '../utils/logger.js';

const CLIMATIQ_BASE_URL = 'https://preview.api.climatiq.io';
const CLIMATIQ_API_KEY = process.env.CLIMATIQ_API_KEY;

const climatiqClient = axios.create({
  baseURL: CLIMATIQ_BASE_URL,
  headers: {
    'Authorization': `Bearer ${CLIMATIQ_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Step 1: Get emission factor suggestions from Climatiq Autopilot
 */
export const getSuggestions = async (productDescription) => {
  try {
    const response = await climatiqClient.post('/autopilot/v1-preview4/suggest', {
      suggest: {
        text: productDescription
      },
      max_suggestions: 1
    });

    const suggestions = response.data;

    if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
      throw new Error('No suggestions found from Climatiq');
    }

    const bestSuggestion = suggestions[0];
    
    if (!bestSuggestion.suggestion_id) {
      throw new Error('Invalid suggestion response - missing suggestion_id');
    }

    logger.info('Climatiq suggestion retrieved', {
      suggestionId: bestSuggestion.suggestion_id,
      productDescription
    });

    return bestSuggestion;

  } catch (error) {
    logger.error('Climatiq suggest API error:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Step 2: Calculate emissions using suggestion ID
 */
export const estimateEmissions = async (suggestionId, weightData) => {
  try {
    // Convert weight to kg if needed
    const weightInKg = weightData.unit === 'kg' ? weightData.value : convertToKg(weightData.value, weightData.unit);

    const response = await climatiqClient.post('/autopilot/v1-preview4/estimate', {
      suggestion_id: suggestionId,
      parameters: {
        weight: weightInKg,
        weight_unit: 'kg'
      }
    });

    const estimateData = response.data;
    
    if (!estimateData.co2e) {
      throw new Error('Invalid estimate response - missing co2e');
    }

    logger.info('Climatiq estimate calculated', {
      co2e: estimateData.co2e,
      dataQuality: estimateData.data_quality_rating,
      suggestionId
    });

    return {
      co2e: parseFloat(estimateData.co2e),
      dataQuality: estimateData.data_quality_rating || 'unknown',
      suggestionId
    };

  } catch (error) {
    logger.error('Climatiq estimate API error:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Complete Climatiq flow: suggest then estimate
 */
export const calculateCarbonFootprint = async (productData) => {
  try {
    // Step 1: Get suggestion
    const suggestion = await getSuggestions(productData.productDescription);

    // Step 2: Calculate emissions
    const estimate = await estimateEmissions(suggestion.suggestion_id, productData.weight);

    // Check data quality - if poor quality or low confidence, use Gemini fallback
    if (estimate.dataQuality === 'bad' || (typeof estimate.dataQuality === 'number' && estimate.dataQuality > 2.5)) {
      logger.warn('Low data quality from Climatiq, will use Gemini fallback', { 
        dataQuality: estimate.dataQuality,
        suggestionId: estimate.suggestionId
      });
      return { 
        useFallback: true, 
        dataQuality: estimate.dataQuality,
        reason: 'poor_data_quality'
      };
    }

    return {
      co2e: estimate.co2e,
      dataQuality: estimate.dataQuality,
      suggestionId: estimate.suggestionId,
      source: 'climatiq'
    };

  } catch (error) {
    logger.error('Climatiq complete flow error:', error.message);
    
    // Check if it's a "not found" or "unrecognized product" error
    if (error.response?.status === 404 || 
        error.message.includes('not found') || 
        error.message.includes('No suggestions found')) {
      logger.warn('Product not recognized by Climatiq, will use Gemini fallback', {
        product: productData.productDescription
      });
      return { 
        useFallback: true, 
        error: error.message,
        reason: 'product_not_recognized'
      };
    }
    
    // For other errors (API issues, rate limits, etc.), also fallback
    return { 
      useFallback: true, 
      error: error.message,
      reason: 'api_error'
    };
  }
};

// Utility function
const convertToKg = (value, unit) => {
  const conversions = {
    'g': 0.001,
    'lb': 0.453592,
    'oz': 0.0283495
  };
  return value * (conversions[unit] || 1);
};

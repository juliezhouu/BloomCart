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

    if (!suggestions || suggestions.length === 0) {
      throw new Error('No suggestions found from Climatiq');
    }

    const bestSuggestion = suggestions[0];

    logger.info('Climatiq suggestion retrieved', {
      suggestionId: bestSuggestion.suggestion_id
    });

    return bestSuggestion;

  } catch (error) {
    logger.error('Climatiq suggest API error:', error.response?.data || error.message);
    throw new Error('Climatiq suggestion failed');
  }
};

/**
 * Step 2: Calculate emissions using suggestion ID
 */
export const estimateEmissions = async (suggestionId, weight) => {
  try {
    // Convert weight to kg if needed
    const weightInKg = weight.unit === 'kg' ? weight.value : convertToKg(weight.value, weight.unit);

    const response = await climatiqClient.post('/autopilot/v1-preview4/estimate', {
      suggestion_id: suggestionId,
      parameters: {
        weight: weightInKg,
        weight_unit: 'kg'
      }
    });

    const { co2e, data_quality_rating } = response.data;

    logger.info('Climatiq estimate calculated', {
      co2e,
      dataQuality: data_quality_rating
    });

    return {
      co2e: parseFloat(co2e),
      dataQuality: data_quality_rating,
      suggestionId
    };

  } catch (error) {
    logger.error('Climatiq estimate API error:', error.response?.data || error.message);
    throw new Error('Climatiq estimation failed');
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

    // Check data quality - if poor, signal to use Gemini fallback
    if (estimate.dataQuality > 2.5) {
      logger.warn('Low data quality from Climatiq', { dataQuality: estimate.dataQuality });
      return { useFallback: true, dataQuality: estimate.dataQuality };
    }

    return {
      co2e: estimate.co2e,
      dataQuality: estimate.dataQuality,
      suggestionId: estimate.suggestionId,
      source: 'climatiq'
    };

  } catch (error) {
    logger.error('Climatiq complete flow error:', error.message);
    return { useFallback: true, error: error.message };
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

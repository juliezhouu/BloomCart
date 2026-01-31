import express from 'express';
import Product from '../models/Product.js';
import { cleanProductData, estimateCarbonFootprint } from '../services/gemini.js';
import { calculateCarbonFootprint } from '../services/climatiq.js';
import { calculateRating, convertToKg } from '../services/rating.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/analyze-product
 * Analyze product and return sustainability rating
 */
router.post('/analyze-product', async (req, res) => {
  try {
    const { scrapedData } = req.body;

    if (!scrapedData || !scrapedData.asin) {
      return res.status(400).json({ error: 'Missing required product data' });
    }

    // Check if product already analyzed (cache)
    const existingProduct = await Product.findOne({ asin: scrapedData.asin.toUpperCase() });
    if (existingProduct) {
      logger.info('Returning cached product rating', { asin: scrapedData.asin });
      return res.json({ product: existingProduct, cached: true });
    }

    // Step 1: Clean data with Gemini
    logger.info('Cleaning product data with Gemini', { asin: scrapedData.asin });
    const cleanedData = await cleanProductData(scrapedData);

    // Step 2: Calculate carbon footprint (Climatiq primary, Gemini fallback)
    logger.info('Calculating carbon footprint', { asin: scrapedData.asin });
    let carbonResult = await calculateCarbonFootprint(cleanedData);

    // Fallback to Gemini if Climatiq fails or low quality
    if (carbonResult.useFallback) {
      logger.warn('Using Gemini fallback for carbon estimation', { asin: scrapedData.asin });
      const geminiEstimate = await estimateCarbonFootprint(cleanedData);
      carbonResult = {
        co2e: geminiEstimate.estimatedCO2e,
        dataQuality: null,
        source: 'gemini_estimate'
      };
    }

    // Step 3: Calculate rating
    const weightInKg = convertToKg(cleanedData.weight.value, cleanedData.weight.unit);

    const rating = calculateRating(carbonResult.co2e, weightInKg);

    // Step 4: Save to database
    const product = new Product({
      asin: scrapedData.asin.toUpperCase(),
      title: cleanedData.cleanedTitle,
      weight: cleanedData.weight,
      materials: cleanedData.materials,
      category: cleanedData.category,
      carbonFootprint: {
        co2e: carbonResult.co2e,
        dataQuality: carbonResult.dataQuality,
        source: carbonResult.source,
        suggestionId: carbonResult.suggestionId
      },
      rating: rating,
      metadata: {
        scrapedData: scrapedData
      }
    });

    await product.save();
    logger.info('Product analyzed and saved', {
      asin: scrapedData.asin,
      rating: rating.grade
    });

    res.json({ product, cached: false });

  } catch (error) {
    logger.error('Product analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze product', details: error.message });
  }
});

/**
 * GET /api/product-rating/:asin
 * Retrieve cached rating
 */
router.get('/product-rating/:asin', async (req, res) => {
  try {
    const { asin } = req.params;
    const product = await Product.findOne({ asin: asin.toUpperCase() });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product });

  } catch (error) {
    logger.error('Product retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve product' });
  }
});

export default router;

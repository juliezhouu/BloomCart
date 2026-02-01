import express from 'express';
import PlantState from '../models/PlantState.js';
import Purchase from '../models/Purchase.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/plant-state/:userId
 * Get user's plant state
 */
router.get('/plant-state/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    let plantState = await PlantState.findOne({ userId });

    // Create initial state if doesn't exist
    if (!plantState) {
      plantState = new PlantState({ userId, currentFrame: 0 });
      await plantState.save();
    }

    res.json({ plantState });

  } catch (error) {
    logger.error('Plant state retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve plant state' });
  }
});

/**
 * POST /api/plant-state/update
 * Update plant state after purchase
 */
router.post('/plant-state/update', async (req, res) => {
  try {
    logger.info('Plant state update request:', req.body);
    
    const { userId, rating, frameChange, asin, productTitle, carbonFootprint } = req.body;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    if (!rating) {
      return res.status(400).json({ error: 'rating is required' });
    }
    if (frameChange === undefined || frameChange === null) {
      return res.status(400).json({ error: 'frameChange is required' });
    }

    let plantState = await PlantState.findOne({ userId });

    if (!plantState) {
      plantState = new PlantState({ userId });
    }

    // Update frame (ensure within bounds)
    plantState.currentFrame = Math.max(0, Math.min(100, plantState.currentFrame + frameChange));
    plantState.totalPurchases += 1;

    if (['A', 'B'].includes(rating)) {
      plantState.sustainablePurchases += 1;
    }

    // Add to history
    plantState.history.push({
      rating,
      frameChange,
      timestamp: new Date()
    });

    await plantState.save();

    // Record purchase
    const purchase = new Purchase({
      userId,
      asin: asin || 'unknown',
      productTitle: productTitle || 'Unknown Product',
      rating: {
        grade: rating,
        score: req.body.ratingScore || 0
      },
      carbonFootprint: carbonFootprint || { co2e: 0, source: 'unknown' },
      frameChange
    });

    await purchase.save();

    logger.info('Plant state updated', {
      userId,
      currentFrame: plantState.currentFrame
    });

    res.json({ plantState });

  } catch (error) {
    logger.error('Plant state update error:', error);
    res.status(500).json({ error: 'Failed to update plant state' });
  }
});

/**
 * POST /api/plant/state
 * Save plant state from extension
 */
router.post('/plant/state', async (req, res) => {
  try {
    const { userId, plantState } = req.body;

    if (!userId || !plantState) {
      return res.status(400).json({ error: 'Missing userId or plantState' });
    }

    let state = await PlantState.findOne({ userId });

    if (!state) {
      state = new PlantState({ userId });
    }

    // Update state
    state.currentFrame = plantState.currentFrame;
    state.totalPurchases = plantState.totalPurchases || 0;
    state.sustainablePurchases = plantState.sustainablePurchases || 0;

    await state.save();

    logger.info('Plant state saved from extension', { userId, frame: state.currentFrame });

    res.json({ success: true, plantState: state });

  } catch (error) {
    logger.error('Plant state save error:', error);
    res.status(500).json({ error: 'Failed to save plant state', details: error.message });
  }
});

/**
 * POST /api/purchases
 * Track purchase from extension
 */
router.post('/purchases', async (req, res) => {
  try {
    const { userId, product } = req.body;

    if (!userId || !product) {
      return res.status(400).json({ error: 'Missing userId or product' });
    }

    const purchase = new Purchase({
      userId,
      asin: product.asin || 'unknown',
      productTitle: product.title || 'Unknown Product',
      rating: product.rating || { grade: 'C', score: 0 },
      carbonFootprint: product.carbonFootprint || { co2e: 0, source: 'unknown' },
      frameChange: product.rating?.frameChange || 0
    });

    await purchase.save();

    logger.info('Purchase tracked from extension', { userId, asin: product.asin });

    res.json({ success: true, purchase });

  } catch (error) {
    logger.error('Purchase tracking error:', error);
    res.status(500).json({ error: 'Failed to track purchase', details: error.message });
  }
});

export default router;

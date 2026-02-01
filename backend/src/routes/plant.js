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

export default router;

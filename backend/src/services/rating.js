import { logger } from '../utils/logger.js';

/**
 * Calculate sustainability rating based on CO2e per kg
 *
 * Rating Scale (Updated for better distribution):
 * A: < 1 kg CO2e/kg (Excellent)
 * B: 1-3 kg CO2e/kg (Good)
 * C: 3-6 kg CO2e/kg (Average)
 * D: 6-12 kg CO2e/kg (Poor)
 * E: > 12 kg CO2e/kg (Very Poor)
 */
export const calculateRating = (co2e, weightInKg) => {
  const score = co2e / weightInKg;

  let grade, description, frameChange;

  if (score < 1) {
    grade = 'A';
    description = 'Excellent - Low carbon footprint';
    frameChange = 15;
  } else if (score < 3) {
    grade = 'B';
    description = 'Good - Below average emissions';
    frameChange = 10;
  } else if (score < 6) {
    grade = 'C';
    description = 'Average - Moderate carbon impact';
    frameChange = 0;
  } else if (score < 12) {
    grade = 'D';
    description = 'Poor - High carbon emissions';
    frameChange = -15;
  } else {
    grade = 'E';
    description = 'Very Poor - Significant environmental impact';
    frameChange = -20;
  }

  logger.info('Rating calculated', { grade, score, frameChange });

  return {
    grade,
    score: parseFloat(score.toFixed(2)),
    description,
    frameChange
  };
};

/**
 * Get rating color for UI
 */
export const getRatingColor = (grade) => {
  const colors = {
    'A': '#00C851',
    'B': '#7CB342',
    'C': '#FFD600',
    'D': '#FF9800',
    'E': '#F44336'
  };
  return colors[grade];
};

/**
 * Get frame progression for plant animation
 */
export const getFrameProgression = (grade) => {
  const progressions = {
    'A': 15,
    'B': 10,
    'C': 0,
    'D': -15,
    'E': -20
  };
  return progressions[grade];
};

/**
 * Convert weight to kg
 */
export const convertToKg = (value, unit) => {
  const conversions = {
    'kg': 1,
    'g': 0.001,
    'lb': 0.453592,
    'oz': 0.0283495
  };
  return value * (conversions[unit] || 1);
};

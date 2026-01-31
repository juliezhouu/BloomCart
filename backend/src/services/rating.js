import { logger } from '../utils/logger.js';

/**
 * Calculate sustainability rating based on CO2e per kg
 *
 * Rating Scale:
 * A: < 2 kg CO2e/kg (Excellent)
 * B: 2-5 kg CO2e/kg (Good)
 * C: 5-10 kg CO2e/kg (Average)
 * D: 10-20 kg CO2e/kg (Poor)
 * E: > 20 kg CO2e/kg (Very Poor)
 */
export const calculateRating = (co2e, weightInKg) => {
  const score = co2e / weightInKg;

  let grade, description, frameChange;

  if (score < 2) {
    grade = 'A';
    description = 'Excellent - Low carbon footprint';
    frameChange = 10;
  } else if (score < 5) {
    grade = 'B';
    description = 'Good - Below average emissions';
    frameChange = 5;
  } else if (score < 10) {
    grade = 'C';
    description = 'Average - Moderate carbon impact';
    frameChange = -5;
  } else if (score < 20) {
    grade = 'D';
    description = 'Poor - High carbon emissions';
    frameChange = -10;
  } else {
    grade = 'E';
    description = 'Very Poor - Significant environmental impact';
    frameChange = -15;
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
    'A': 10,
    'B': 5,
    'C': -5,
    'D': -10,
    'E': -15
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

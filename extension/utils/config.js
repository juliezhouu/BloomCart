/**
 * BloomCart Configuration
 * Central configuration for the extension
 */

const CONFIG = {
  // API Configuration
  API: {
    BASE_URL: 'http://localhost:3000/api',
    TIMEOUT: 30000 // 30 seconds
  },

  // Plant Animation Configuration
  PLANT: {
    MIN_FRAME: 0,
    MAX_FRAME: 100,
    FRAME_CHANGES: {
      'A': 10,  // Excellent
      'B': 5,   // Good
      'C': -5,  // Average
      'D': -10, // Poor
      'E': -15  // Very Poor
    }
  },

  // Rating Colors
  RATING_COLORS: {
    'A': '#00C851', // Green
    'B': '#7CB342', // Light Green
    'C': '#FFD600', // Yellow
    'D': '#FF9800', // Orange
    'E': '#F44336'  // Red
  },

  // Rating Descriptions
  RATING_DESCRIPTIONS: {
    'A': 'Excellent - Low carbon footprint',
    'B': 'Good - Below average emissions',
    'C': 'Average - Moderate carbon impact',
    'D': 'Poor - High carbon emissions',
    'E': 'Very Poor - Significant environmental impact'
  },

  // Chrome Storage Keys
  STORAGE_KEYS: {
    PLANT_STATE: 'plantState',
    USER_ID: 'userId',
    CACHED_PRODUCTS: 'cachedProducts'
  },

  // UI Configuration
  UI: {
    ANIMATION_DURATION: 500, // ms
    TAB_POSITION: 'right',
    PLANT_POSITION: {
      bottom: '20px',
      right: '20px'
    }
  },

  // Feature Flags
  FEATURES: {
    ENABLE_ANALYTICS: false,
    ENABLE_NOTIFICATIONS: true,
    DEBUG_MODE: true
  }
};

// Make available globally
window.BloomCartConfig = CONFIG;

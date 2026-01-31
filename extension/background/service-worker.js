/**
 * BloomCart Background Service Worker
 * Handles API communication with backend server
 */

const API_BASE_URL = 'http://localhost:3000/api';

/**
 * Listen for messages from content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('BloomCart Service Worker: Received message', request);

  if (request.action === 'analyzeProduct') {
    handleAnalyzeProduct(request.data, sendResponse);
    return true; // Keep channel open for async response
  }

  if (request.action === 'trackPurchase') {
    handleTrackPurchase(request.data, sendResponse);
    return true;
  }

  if (request.action === 'getPlantState') {
    handleGetPlantState(request.data, sendResponse);
    return true;
  }
});

/**
 * Handle product analysis request
 */
async function handleAnalyzeProduct(data, sendResponse) {
  try {
    console.log('BloomCart: Analyzing product', data);

    const response = await fetch(`${API_BASE_URL}/analyze-product`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();

    console.log('BloomCart: Product analyzed successfully', result);

    sendResponse({
      success: true,
      product: result.product,
      cached: result.cached
    });

  } catch (error) {
    console.error('BloomCart: Product analysis failed', error);

    sendResponse({
      success: false,
      error: error.message || 'Failed to analyze product'
    });
  }
}

/**
 * Handle purchase tracking request
 */
async function handleTrackPurchase(data, sendResponse) {
  try {
    console.log('BloomCart: Tracking purchase', data);

    const { userId, product } = data;

    const response = await fetch(`${API_BASE_URL}/plant-state/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        rating: product.rating.grade,
        frameChange: product.rating.frameChange,
        ratingScore: product.rating.score,
        asin: product.asin,
        productTitle: product.title,
        carbonFootprint: product.carbonFootprint
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();

    console.log('BloomCart: Purchase tracked successfully', result);

    // Update Chrome storage with new plant state
    chrome.storage.local.set({ plantState: result.plantState });

    sendResponse({
      success: true,
      plantState: result.plantState
    });

  } catch (error) {
    console.error('BloomCart: Purchase tracking failed', error);

    sendResponse({
      success: false,
      error: error.message || 'Failed to track purchase'
    });
  }
}

/**
 * Handle get plant state request
 */
async function handleGetPlantState(data, sendResponse) {
  try {
    console.log('BloomCart: Getting plant state', data);

    const { userId } = data;

    const response = await fetch(`${API_BASE_URL}/plant-state/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();

    console.log('BloomCart: Plant state retrieved', result);

    // Update Chrome storage
    chrome.storage.local.set({ plantState: result.plantState });

    sendResponse({
      success: true,
      plantState: result.plantState
    });

  } catch (error) {
    console.error('BloomCart: Get plant state failed', error);

    sendResponse({
      success: false,
      error: error.message || 'Failed to get plant state'
    });
  }
}

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('BloomCart: Extension installed!');

    // Initialize storage
    chrome.storage.local.set({
      plantState: {
        currentFrame: 0,
        totalPurchases: 0,
        sustainablePurchases: 0
      },
      userId: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    });

    // Open welcome page (optional)
    // chrome.tabs.create({ url: 'popup/popup.html' });
  }
});

/**
 * Keep service worker alive
 */
chrome.runtime.onStartup.addListener(() => {
  console.log('BloomCart: Service worker started');
});

console.log('BloomCart: Service worker loaded');

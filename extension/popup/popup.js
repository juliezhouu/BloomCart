/**
 * BloomCart Popup Script
 * Displays cart items with sustainability scores and plant animation
 */

let currentPlantState = null;
let currentProductRating = null;
let plantImage = null;

document.addEventListener('DOMContentLoaded', async () => {
  console.log('BloomCart Popup: Initializing...');

  // Load plant state from Chrome storage
  const { plantState, userId } = await new Promise((resolve) => {
    chrome.storage.local.get(['plantState', 'userId'], resolve);
  });

  console.log('BloomCart Popup: Loaded state', { plantState, userId });

  currentPlantState = plantState || {
    currentFrame: 50,
    totalPurchases: 0,
    sustainablePurchases: 0,
    totalCartItems: 0,
    sustainableCartItems: 0
  };

  // Get plant image reference
  plantImage = document.getElementById('plant-image');

  if (plantImage) {
    // Set initial plant image with proper URL
    const initialHealth = currentPlantState.currentFrame || 50;
    // Calculate initial stage inline to avoid undefined function
    let initialStage = 1;
    if (initialHealth >= 85) initialStage = 7;
    else if (initialHealth >= 70) initialStage = 6;
    else if (initialHealth >= 55) initialStage = 5;
    else if (initialHealth >= 40) initialStage = 4;
    else if (initialHealth >= 25) initialStage = 3;
    else if (initialHealth >= 10) initialStage = 2;
    
    plantImage.src = chrome.runtime.getURL(`assets/images/plant-stages/plant-stage-${initialStage}.jpg`);
    plantImage.onerror = function() {
      console.error('BloomCart: Failed to load plant image');
      this.alt = '🌱';
      this.style.fontSize = '80px';
      this.style.textAlign = 'center';
    };
  }

  // Initialize UI
  initializeUI();

  // Setup event listeners
  setupEventListeners();

  // Load cart items
  loadCartItems();
});

/**
 * Initialize UI with current state
 */
function initializeUI() {
  try {
    const health = currentPlantState.currentFrame || 50;
    const tier = getTier(health);

    updateScoreDisplay(tier, health);
    updateTierProgress(tier);

    // Try to get current product from active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('amazon.com')) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getProductInfo' }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('BloomCart: Could not reach content script:', chrome.runtime.lastError.message);
            return;
          }
          if (response && response.product) {
            currentProductRating = response.product;
            displayProductInfo(response.product);
          }
        });
      }
    });
  } catch (error) {
    console.error('BloomCart: Error initializing UI:', error);
  }
}

/**
 * Load cart items from storage and optionally from active tab
 */
function loadCartItems() {
  console.log('BloomCart: Loading cart items...');
  
  // Immediately load and display cached cart items
  chrome.storage.local.get(['cartItems'], (result) => {
    const cartItems = result.cartItems || [];
    console.log('BloomCart: Found cached cart items:', cartItems.length);
    
    if (cartItems.length > 0) {
      displayCartItems(cartItems);
    } else {
      document.getElementById('product-title').textContent = 'No items in cart';
      document.getElementById('product-brand').textContent = 'Add products to Amazon cart';
    }
  });

  // Also try to get fresh cart items from the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url && (tabs[0].url.includes('amazon.com') || tabs[0].url.includes('amazon.ca') || tabs[0].url.includes('amazon.co.uk'))) {
      console.log('BloomCart: Requesting fresh cart items from active tab...');
      
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getCartItems' }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('BloomCart: Could not get fresh cart items:', chrome.runtime.lastError.message);
          return;
        }
        
        console.log('BloomCart: Fresh cart response:', response);
        
        if (response && response.items) {
          if (response.items.length === 0) {
            // Cart is empty - clear display
            console.log('BloomCart: Cart is now empty');
            document.getElementById('product-title').textContent = 'No items in cart';
            document.getElementById('product-brand').textContent = 'Add products to Amazon cart';
            document.getElementById('cart-items-section').style.display = 'none';
            // Clear storage too
            chrome.storage.local.set({ cartItems: [] });
          } else {
            // Analyze fresh cart items via service worker
            console.log('BloomCart: Analyzing', response.items.length, 'fresh items...');
            chrome.runtime.sendMessage(
              { action: 'analyzeCartItems', data: { items: response.items } },
              (analysisResponse) => {
                if (analysisResponse && analysisResponse.success) {
                  console.log('BloomCart: Analysis complete, displaying items');
                  if (analysisResponse.cartItems.length > 0) {
                    displayCartItems(analysisResponse.cartItems);
                  } else {
                    document.getElementById('product-title').textContent = 'No items in cart';
                    document.getElementById('product-brand').textContent = 'Add products to Amazon cart';
                  }
                }
              }
            );
          }
        }
      });
    }
  });
}

/**
 * Display cart items in the popup
 */
function displayCartItems(items) {
  if (!items || items.length === 0) return;

  const section = document.getElementById('cart-items-section');
  const list = document.getElementById('cart-items-list');
  const countEl = document.getElementById('cart-items-count');

  section.style.display = 'block';
  countEl.textContent = items.length;

  // Update header text
  document.getElementById('product-title').textContent = `${items.length} item${items.length !== 1 ? 's' : ''} in cart`;
  document.getElementById('product-brand').textContent = 'Sustainability analysis below';

  // Render each cart item
  list.innerHTML = items.map(item => {
    const gradeColor = getGradeColor(item.grade);
    return `
      <div class="cart-item">
        <div class="cart-item-grade" style="background: ${gradeColor};">${item.grade}</div>
        <div class="cart-item-info">
          <span class="cart-item-title">${truncate(item.title, 50)}</span>
          <div class="cart-item-meta">
            <span class="cart-item-score">${item.overallScore}/100</span>
            ${item.price ? `<span class="cart-item-price">${item.price}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Calculate and display average score
  const avgScore = Math.round(items.reduce((sum, item) => sum + item.overallScore, 0) / items.length);
  document.getElementById('cart-avg-score').textContent = `${avgScore}/100`;

  // Update the overall score display based on average
  const tier = getTier(avgScore);
  updateScoreDisplay(tier, avgScore);
  updateTierProgress(tier);

  // Update plant based on average
  if (plantImage) {
    setPlantStage(avgScore);
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Close button
  const closeBtn = document.getElementById('close-btn');
  closeBtn.addEventListener('click', () => {
    window.close();
  });

  // Details toggle
  const detailsToggle = document.getElementById('details-toggle');
  const sustainabilityDetails = document.getElementById('sustainability-details');
  detailsToggle.addEventListener('click', () => {
    sustainabilityDetails.classList.toggle('collapsed');
  });

  // Cart button
  const cartButton = document.getElementById('cart-button');
  cartButton.addEventListener('click', () => {
    // Open Amazon cart in a new tab
    chrome.tabs.create({ url: 'https://www.amazon.com/gp/cart/view.html' });
  });

  // Preview button
  const previewBtn = document.getElementById('preview-btn');
  previewBtn.addEventListener('click', () => {
    animatePlantGrowth(15);
  });
}

/**
 * Get grade color
 */
function getGradeColor(grade) {
  const colors = {
    'A': '#4CAF50',
    'B': '#7CB342',
    'C': '#FDD835',
    'D': '#FF9800',
    'E': '#EF5350'
  };
  return colors[grade] || '#9E9E9E';
}

/**
 * Truncate text
 */
function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

/**
 * Get tier from health percentage (7-tier system)
 */
function getTier(health) {
  if (health >= 85) return 7;
  if (health >= 70) return 6;
  if (health >= 55) return 5;
  if (health >= 40) return 4;
  if (health >= 25) return 3;
  if (health >= 10) return 2;
  return 1;
}

/**
 * Get tier label (7-tier system)
 */
function getTierLabel(tier) {
  const labels = ['Withered', 'Seedling', 'Sprout', 'Growing', 'Healthy', 'Thriving', 'Blooming'];
  return labels[tier - 1] || 'Unknown';
}

/**
 * Update score display
 */
function updateScoreDisplay(tier, health) {
  const scoreNumber = document.getElementById('score-number');
  const scoreLabel = document.getElementById('score-label');
  const scoreTier = document.getElementById('score-tier');
  const scoreCircle = document.querySelector('.score-circle');

  scoreNumber.textContent = tier;
  scoreLabel.textContent = getTierLabel(tier);
  scoreTier.textContent = `Tier ${tier} of 7`;

  const colors = [
    'linear-gradient(135deg, #8D6E63 0%, #5D4037 100%)',
    'linear-gradient(135deg, #EF5350 0%, #E53935 100%)',
    'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
    'linear-gradient(135deg, #FDD835 0%, #F9A825 100%)',
    'linear-gradient(135deg, #9CCC65 0%, #7CB342 100%)',
    'linear-gradient(135deg, #66BB6A 0%, #43A047 100%)',
    'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)'
  ];

  scoreCircle.style.background = colors[tier - 1];
}

/**
 * Update tier progress bar
 */
function updateTierProgress(tier) {
  const tierBars = document.querySelectorAll('.tier-bar');
  tierBars.forEach((bar, index) => {
    if (index < tier) {
      bar.classList.add('active');
    } else {
      bar.classList.remove('active');
    }
  });
}

/**
 * Display product information (for single product view)
 */
function displayProductInfo(product) {
  const productTitle = document.getElementById('product-title');
  const productBrand = document.getElementById('product-brand');

  productTitle.textContent = product.title || 'Current Product';
  productBrand.textContent = product.brand || 'Analyzing...';

  if (product.environmental !== undefined) {
    document.getElementById('detail-environmental').textContent = `${product.environmental}%`;
  }
  if (product.social !== undefined) {
    document.getElementById('detail-social').textContent = `${product.social}%`;
  }
  if (product.economic !== undefined) {
    document.getElementById('detail-economic').textContent = `${product.economic}%`;
  }
  if (product.carbonFootprint && product.carbonFootprint.co2e) {
    document.getElementById('detail-carbon').textContent = `${product.carbonFootprint.co2e.toFixed(2)} kg CO2e`;
  }

  if (product.overallScore !== undefined) {
    const tier = getTier(product.overallScore);
    updateScoreDisplay(tier, product.overallScore);
    updateTierProgress(tier);
  }
}

/**
 * Get plant stage from health percentage (7 stages total)
 */
function getPlantStage(health) {
  if (health >= 85) return 7;
  if (health >= 70) return 6;
  if (health >= 55) return 5;
  if (health >= 40) return 4;
  if (health >= 25) return 3;
  if (health >= 10) return 2;
  return 1;
}

/**
 * Set plant image to specific stage
 */
function setPlantStage(health) {
  if (!plantImage) return;

  const stage = getPlantStage(health);
  const imagePath = chrome.runtime.getURL(`assets/images/plant-stages/plant-stage-${stage}.jpg`);

  plantImage.classList.add('changing');
  setTimeout(() => {
    plantImage.src = imagePath;
    plantImage.classList.remove('changing');
  }, 300);
}

/**
 * Animate plant growth
 */
function animatePlantGrowth(healthIncrease = 15) {
  if (!plantImage) return;

  const currentHealth = currentPlantState.currentFrame || 50;
  const newHealth = Math.min(100, currentHealth + healthIncrease);

  setPlantStage(newHealth);

  currentPlantState.currentFrame = newHealth;
  chrome.storage.local.set({ plantState: currentPlantState });
}

/**
 * Animate plant withering
 */
function animatePlantWithering(healthDecrease = 20) {
  if (!plantImage) return;

  const currentHealth = currentPlantState.currentFrame || 50;
  const newHealth = Math.max(0, currentHealth - healthDecrease);

  setPlantStage(newHealth);

  currentPlantState.currentFrame = newHealth;
  chrome.storage.local.set({ plantState: currentPlantState });
}

/**
 * Get frame change based on rating grade
 */
function getFrameChangeForGrade(grade) {
  return { 'A': 15, 'B': 10, 'C': 0, 'D': -15, 'E': -20 }[grade] || 0;
}

/**
 * Update plant when plant state changes
 */
function updatePlant(newHealth) {
  const oldHealth = currentPlantState.currentFrame || 50;
  const healthChange = Math.abs(newHealth - oldHealth);

  if (newHealth > oldHealth) {
    animatePlantGrowth(healthChange);
  } else if (newHealth < oldHealth) {
    animatePlantWithering(healthChange);
  } else {
    setPlantStage(newHealth);
  }

  currentPlantState.currentFrame = newHealth;

  const tier = getTier(newHealth);
  updateScoreDisplay(tier, newHealth);
  updateTierProgress(tier);
}

/**
 * Show notification
 */
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#4CAF50' : '#2196F3'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 10000;
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
  `;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/**
 * Listen for storage changes to update UI in real-time
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.plantState) {
      const newState = changes.plantState.newValue;
      if (newState.currentFrame !== currentPlantState.currentFrame) {
        updatePlant(newState.currentFrame);
      }
      currentPlantState = newState;
    }
    if (changes.cartItems) {
      const newItems = changes.cartItems.newValue;
      if (newItems && newItems.length > 0) {
        displayCartItems(newItems);
      }
    }
  }
});

/**
 * Listen for messages from content script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'productAnalyzed') {
    currentProductRating = message.product;
    displayProductInfo(message.product);
  } else if (message.action === 'cartItemAdded') {
    if (message.product && message.product.grade) {
      const frameChange = getFrameChangeForGrade(message.product.grade);
      if (frameChange > 0) {
        animatePlantGrowth(frameChange);
        showNotification('Great choice! Your plant grew!', 'success');
      } else if (frameChange < 0) {
        animatePlantWithering(Math.abs(frameChange));
      }
    }
  }
});

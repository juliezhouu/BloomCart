/**
 * BloomCart Popup Script
 * JavaScript-based flower animations (no Lottie)
 */

let currentPlantState = null;
let currentProductRating = null;

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

  // Initialize UI
  initializeUI();
  renderFlower(currentPlantState.currentFrame);

  // Setup event listeners
  setupEventListeners();
});

/**
 * Initialize UI with current state
 */
function initializeUI() {
  try {
    console.log('BloomCart: Initializing UI with state:', currentPlantState);

    // Update score display
    const health = currentPlantState.currentFrame || 50;
    const tier = getTier(health);

    updateScoreDisplay(tier, health);
    updateTierProgress(tier);

    // Check if we have a current product
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('amazon.com')) {
        console.log('BloomCart: On Amazon page, requesting product info');
        // Request product data from content script
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
      } else {
        console.log('BloomCart: Not on Amazon page');
      }
    });

    console.log('BloomCart: UI initialized successfully');
  } catch (error) {
    console.error('BloomCart: Error initializing UI:', error);
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Details toggle
  const detailsToggle = document.getElementById('details-toggle');
  const sustainabilityDetails = document.getElementById('sustainability-details');

  detailsToggle.addEventListener('click', () => {
    sustainabilityDetails.classList.toggle('collapsed');
  });

  // Cart button
  const cartButton = document.getElementById('cart-button');
  cartButton.addEventListener('click', () => {
    // This would trigger add to cart on Amazon
    showNotification('Feature coming soon! Visit Amazon to add items to cart.', 'info');
  });

  // Preview button
  const previewBtn = document.getElementById('preview-btn');
  previewBtn.addEventListener('click', () => {
    animateFlowerGrowth();
  });
}

/**
 * Get tier from health percentage
 */
function getTier(health) {
  if (health >= 80) return 5;
  if (health >= 60) return 4;
  if (health >= 40) return 3;
  if (health >= 20) return 2;
  return 1;
}

/**
 * Get tier label
 */
function getTierLabel(tier) {
  const labels = ['Poor', 'Fair', 'Good', 'Great', 'Excellent'];
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
  scoreTier.textContent = `Tier ${tier} of 5`;

  // Update circle color based on tier
  const colors = [
    'linear-gradient(135deg, #EF5350 0%, #E53935 100%)',
    'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
    'linear-gradient(135deg, #FDD835 0%, #F9A825 100%)',
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
 * Display product information
 */
function displayProductInfo(product) {
  const productTitle = document.getElementById('product-title');
  const productBrand = document.getElementById('product-brand');

  productTitle.textContent = product.title || 'Current Product';
  productBrand.textContent = product.brand || 'Analyzing...';

  // Update sustainability details
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
    document.getElementById('detail-carbon').textContent = `${product.carbonFootprint.co2e.toFixed(2)} kg CO₂e`;
  }

  // Update tier based on product score
  if (product.overallScore !== undefined) {
    const tier = getTier(product.overallScore);
    updateScoreDisplay(tier, product.overallScore);
    updateTierProgress(tier);
  }
}

/**
 * Render flower based on health percentage
 */
function renderFlower(health) {
  const container = document.getElementById('flower-container');
  if (!container) {
    console.error('BloomCart: Flower container not found');
    return;
  }

  // Ensure health is a valid number
  health = health || 50;

  console.log('BloomCart: Rendering flower with health:', health);

  container.innerHTML = '';

  // Add decorative leaves
  for (let i = 0; i < 3; i++) {
    const leaf = document.createElement('div');
    leaf.className = 'decorative-leaf';
    container.appendChild(leaf);
  }

  // Calculate flower size based on health
  const stemHeight = 40 + (health / 100) * 100; // 40-140px
  const bloomCount = Math.max(1, Math.floor((health / 100) * 4)); // 1-4 blooms
  const leafCount = Math.max(1, Math.ceil((health / 100) * 4)); // 1-4 leaves

  // Create stem
  const stem = document.createElement('div');
  stem.className = 'flower-stem';
  stem.style.height = `${stemHeight}px`;
  container.appendChild(stem);

  // Create leaves
  for (let i = 0; i < leafCount; i++) {
    const leafLeft = document.createElement('div');
    leafLeft.className = 'flower-leaf left';
    leafLeft.style.bottom = `${20 + (i * 25)}px`;
    leafLeft.style.left = `calc(50% - 25px)`;
    container.appendChild(leafLeft);

    if (i < leafCount - 1) {
      const leafRight = document.createElement('div');
      leafRight.className = 'flower-leaf right';
      leafRight.style.bottom = `${30 + (i * 25)}px`;
      leafRight.style.left = `calc(50% + 15px)`;
      container.appendChild(leafRight);
    }
  }

  // Create blooms
  for (let i = 0; i < bloomCount; i++) {
    const bloom = document.createElement('div');
    bloom.className = 'flower-bloom';

    // Position blooms along the stem
    const bloomHeight = stemHeight - 35 - (i * 25);
    bloom.style.bottom = `${bloomHeight}px`;
    bloom.style.left = '50%';
    bloom.style.transform = 'translateX(-50%)';
    bloom.style.width = '50px';
    bloom.style.height = '50px';

    // Create petals
    for (let j = 0; j < 5; j++) {
      const petal = document.createElement('div');
      petal.className = 'flower-petal';
      petal.style.setProperty('--rotation', `${j * 72}deg`);
      bloom.appendChild(petal);
    }

    // Create center
    const center = document.createElement('div');
    center.className = 'flower-center';
    bloom.appendChild(center);

    container.appendChild(bloom);
  }

  console.log('BloomCart: Flower rendered successfully -', bloomCount, 'blooms,', leafCount, 'leaves');
}

/**
 * Animate flower growth
 */
function animateFlowerGrowth() {
  const container = document.getElementById('flower-container');
  container.classList.remove('withering');
  container.classList.add('growing');

  setTimeout(() => {
    container.classList.remove('growing');
  }, 800);
}

/**
 * Animate flower withering
 */
function animateFlowerWithering() {
  const container = document.getElementById('flower-container');
  container.classList.remove('growing');
  container.classList.add('withering');

  setTimeout(() => {
    container.classList.remove('withering');
  }, 800);
}

/**
 * Update flower when plant state changes
 */
function updateFlower(newHealth) {
  const oldHealth = currentPlantState.currentFrame || 50;
  currentPlantState.currentFrame = newHealth;

  // Determine if growing or withering
  if (newHealth > oldHealth) {
    animateFlowerGrowth();
  } else if (newHealth < oldHealth) {
    animateFlowerWithering();
  }

  // Re-render flower after animation
  setTimeout(() => {
    renderFlower(newHealth);
    const tier = getTier(newHealth);
    updateScoreDisplay(tier, newHealth);
    updateTierProgress(tier);
  }, 400);
}

/**
 * Show notification
 */
function showNotification(message, type = 'success') {
  // Create notification element
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
  if (areaName === 'local' && changes.plantState) {
    console.log('BloomCart Popup: Plant state updated', changes.plantState.newValue);
    const newState = changes.plantState.newValue;

    if (newState.currentFrame !== currentPlantState.currentFrame) {
      updateFlower(newState.currentFrame);
    }

    currentPlantState = newState;
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
    // Animate based on item quality
    if (message.impact > 0) {
      animateFlowerGrowth();
      showNotification(`Great choice! Your plant grew!`, 'success');
    } else if (message.impact < 0) {
      animateFlowerWithering();
      // Removed negative notification message
    }
  }
});

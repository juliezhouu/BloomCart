/**
 * BloomCart Main Content Script
 * Manages plant display, rating tab, and product analysis
 */

let currentPlantState = null;
let currentProductRating = null;
let plantContainer = null;
let floatingTab = null;

// Cart tracking
let cartItems = new Set();
let cartObserver = null;
let lastCartCount = 0;

/**
 * Initialize BloomCart on Amazon product pages
 */
async function initBloomCart() {
  console.log('BloomCart: Initializing...');

  // Check if we're on a product page
  if (!AmazonScraper.isProductPage()) {
    console.log('BloomCart: Not a product page, skipping initialization');
    return;
  }

  // Load plant state from Chrome storage
  await loadPlantState();

  // Create and display plant
  createPlantDisplay();

  // Scrape product and analyze
  analyzeCurrentProduct();

  // Listen for navigation changes (SPA-style navigation)
  observePageChanges();

  // Initialize cart monitoring
  initializeCartMonitoring();
}

/**
 * Load plant state from Chrome storage
 */
async function loadPlantState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['plantState', 'userId'], (result) => {
      if (!result.userId) {
        // Generate a unique user ID
        const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        chrome.storage.local.set({ userId });
        result.userId = userId;
      }

      currentPlantState = result.plantState || {
        currentFrame: 0,
        totalPurchases: 0,
        sustainablePurchases: 0
      };

      // Always ensure userId is set
      currentPlantState.userId = result.userId;

      console.log('BloomCart: Plant state loaded', currentPlantState);
      resolve(currentPlantState);
    });
  });
}

/**
 * Save plant state to Chrome storage
 */
async function savePlantState(newState) {
  currentPlantState = { ...currentPlantState, ...newState };
  return new Promise((resolve) => {
    chrome.storage.local.set({ plantState: currentPlantState }, () => {
      console.log('BloomCart: Plant state saved', currentPlantState);
      resolve();
    });
  });
}

/**
 * Create plant display container
 */
function createPlantDisplay() {
  if (plantContainer) {
    return; // Already created
  }

  // Create simplified plant container with icon
  plantContainer = document.createElement('div');
  plantContainer.id = 'bloomcart-plant-container';
  plantContainer.innerHTML = `
    <div class="plant-icon" id="plant-icon">🌸</div>
    <div id="bloomcart-plant-health" title="Click to see detailed cart sustainability info">
      <div class="health-bar">
        <div class="health-fill" id="health-fill"></div>
      </div>
      <div class="health-label">Cart Health</div>
    </div>
  `;

  document.body.appendChild(plantContainer);

  // Add click handler for health indicator
  setTimeout(() => {
    const healthIndicator = document.getElementById('bloomcart-plant-health');
    if (healthIndicator) {
      healthIndicator.addEventListener('click', showCartSummary);
    }
  }, 100);

  // Initialize plant icon and health indicator
  updatePlantDisplay();
  updateHealthIndicator();

  console.log('BloomCart: Plant display created');
}

/**
 * Initialize cart monitoring to track sustainability
 */
function initializeCartMonitoring() {
  console.log('BloomCart: Initializing cart monitoring...');
  
  // Monitor cart changes
  observeCartChanges();
  
  // Monitor "Add to Cart" button clicks
  monitorAddToCartButtons();
  
  // Initial cart check
  checkCurrentCartState();
}

/**
 * Monitor cart changes on Amazon
 */
function observeCartChanges() {
  // Watch for cart count changes in header
  const cartCountSelectors = ['#nav-cart-count', '[data-csa-c-type="element"][data-csa-c-id="nav-cart"]', '.nav-cart-count'];
  
  const checkCartCount = () => {
    cartCountSelectors.forEach(selector => {
      const cartElement = document.querySelector(selector);
      if (cartElement) {
        const currentCount = parseInt(cartElement.textContent) || 0;
        if (currentCount > lastCartCount) {
          console.log('BloomCart: Cart item added, analyzing...');
          handleCartItemAdded();
        }
        lastCartCount = currentCount;
      }
    });
  };

  // Initial check
  checkCartCount();
  
  // Set up observer for cart changes
  const observer = new MutationObserver(() => {
    checkCartCount();
  });
  
  // Observe changes to the navigation area
  const navElement = document.querySelector('#navbar, #nav-main, .nav-main');
  if (navElement) {
    observer.observe(navElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
}

/**
 * Monitor "Add to Cart" button clicks
 */
function monitorAddToCartButtons() {
  // Common "Add to Cart" button selectors on Amazon
  const addToCartSelectors = [
    '#add-to-cart-button',
    '[name="submit.add-to-cart"]',
    '.a-button-primary[aria-labelledby*="cart"]',
    '[data-action="add-to-cart"]'
  ];
  
  addToCartSelectors.forEach(selector => {
    document.addEventListener('click', (event) => {
      if (event.target.matches(selector) || event.target.closest(selector)) {
        console.log('BloomCart: Add to cart button clicked!');
        // Wait a moment for the cart to update, then analyze
        setTimeout(() => {
          handleCartItemAdded();
        }, 2000);
      }
    });
  });
}

/**
 * Check current cart state and analyze items
 */
async function checkCurrentCartState() {
  // This will be called periodically to ensure we're in sync
  console.log('BloomCart: Checking current cart state...');
  // For now, we'll rely on the add-to-cart monitoring
  // Future enhancement: Could scrape the actual cart page
}

/**
 * Handle when an item is added to cart
 */
async function handleCartItemAdded() {
  console.log('BloomCart: Handling cart item addition...');
  
  try {
    // Double-check we're still on a product page
    if (!AmazonScraper.isProductPage()) {
      console.log('BloomCart: Not on a product page, cannot analyze cart item');
      return;
    }

    // Get current product data
    const productData = AmazonScraper.scrapeProduct();
    if (!productData || !productData.title) {
      console.warn('BloomCart: No product data available for cart item');
      return;
    }

    console.log('BloomCart: Scraped product data for cart analysis:', productData);
    
    // Analyze the product for sustainability
    const rating = await analyzeProductSustainability(productData);
    if (!rating) {
      console.warn('BloomCart: Failed to get sustainability rating');
      return;
    }
    
    // Update plant based on item sustainability
    await updatePlantFromCartItem(productData, rating);
    
    // Feedback notifications disabled
    // showCartItemFeedback(productData, rating);
    
  } catch (error) {
    console.error('BloomCart: Error handling cart item:', error);
    console.error('BloomCart: Error details:', {
      message: error.message,
      stack: error.stack
    });
  }
}

/**
 * Analyze product sustainability for cart items
 */
async function analyzeProductSustainability(productData) {
  return new Promise((resolve) => {
    console.log('BloomCart: Analyzing product sustainability...');
    
    // Send to background script for analysis
    chrome.runtime.sendMessage(
      {
        action: 'analyzeProduct',
        data: { scrapedData: productData }
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('BloomCart: Error analyzing product', chrome.runtime.lastError);
          resolve(null);
          return;
        }

        if (response && response.success && response.product) {
          console.log('BloomCart: Product sustainability analyzed', response.product);
          resolve(response.product);
        } else {
          console.error('BloomCart: Analysis failed', response?.error);
          resolve(null);
        }
      }
    );
  });
}

/**
 * Update plant growth based on cart item sustainability
 */
async function updatePlantFromCartItem(productData, rating) {
  console.log('BloomCart: Updating plant from cart item:', rating);
  
  // Calculate plant growth change based on sustainability score
  let growthChange = 0;
  
  if (rating.overallScore >= 80) {
    growthChange = 15; // Excellent sustainability - big growth boost
  } else if (rating.overallScore >= 60) {
    growthChange = 10; // Good sustainability - moderate growth
  } else if (rating.overallScore >= 40) {
    growthChange = 5;  // Fair sustainability - small growth
  } else if (rating.overallScore >= 20) {
    growthChange = 0;  // Poor sustainability - no growth
  } else {
    growthChange = -5; // Very poor sustainability - plant suffers
  }
  
  // Track cart statistics
  const newTotalCartItems = (currentPlantState.totalCartItems || 0) + 1;
  const newSustainableCartItems = rating.overallScore >= 60 
    ? (currentPlantState.sustainableCartItems || 0) + 1 
    : (currentPlantState.sustainableCartItems || 0);
  
  // Update plant state locally (no backend call needed for cart monitoring)
  await savePlantState({
    totalCartItems: newTotalCartItems,
    sustainableCartItems: newSustainableCartItems,
    lastCartUpdate: Date.now()
  });
  
  // Update plant animation with visual feedback
  updatePlantAnimation(growthChange);
  
  console.log(`BloomCart: Plant updated! Growth: ${growthChange > 0 ? '+' : ''}${growthChange}, Cart: ${newTotalCartItems} total, ${newSustainableCartItems} sustainable`);
}

/**
 * Update plant display based on health
 */
function updatePlantDisplay() {
  const plantIcon = document.getElementById('plant-icon');
  if (!plantIcon) return;

  const health = currentPlantState.currentFrame || 50;
  let emoji = '🌱'; // Default sprout
  let size = '60px';

  // Choose emoji and size based on health
  if (health >= 80) {
    emoji = '🌸'; // Flowering
    size = '80px';
  } else if (health >= 60) {
    emoji = '🌻'; // Sunflower
    size = '75px';
  } else if (health >= 40) {
    emoji = '🌿'; // Healthy plant
    size = '70px';
  } else if (health >= 20) {
    emoji = '🌱'; // Sprout
    size = '65px';
  } else {
    emoji = '🥀'; // Wilted
    size = '60px';
  }

  plantIcon.textContent = emoji;
  plantIcon.style.fontSize = size;

  console.log('BloomCart: Plant display updated', { health, emoji });
}

/**
 * Update plant animation with new health value
 */
function updatePlantAnimation(frameChange) {
  const oldFramePercent = currentPlantState.currentFrame;
  const newFramePercent = Math.max(0, Math.min(100, currentPlantState.currentFrame + frameChange));

  // Update state
  savePlantState({ currentFrame: newFramePercent });

  // Update plant display
  updatePlantDisplay();

  // Update health indicator with animation
  updateHealthIndicator();

  // Add visual feedback for health change
  const plantContainer = document.getElementById('bloomcart-plant-container');
  if (plantContainer && frameChange !== 0) {
    // Remove existing animation classes
    plantContainer.classList.remove('growing', 'declining');

    // Add appropriate animation class
    if (frameChange > 0) {
      plantContainer.classList.add('growing');
    } else if (frameChange < 0) {
      plantContainer.classList.add('declining');
    }

    // Remove animation class after it completes
    setTimeout(() => {
      plantContainer.classList.remove('growing', 'declining');
    }, 800);
  }

  console.log('BloomCart: Plant updated', {
    frameChange,
    oldHealth: oldFramePercent,
    newHealth: newFramePercent
  });
}

/**
 * Update the health indicator bar
 */
function updateHealthIndicator() {
  const healthFill = document.getElementById('health-fill');
  if (!healthFill) return;

  const health = currentPlantState.currentFrame;
  
  // Update width based on health percentage
  healthFill.style.width = `${health}%`;
  
  // Change color based on health level
  let color = '#ff6b6b'; // Red for poor
  if (health >= 75) color = '#0be881'; // Green for excellent
  else if (health >= 50) color = '#48dbfb'; // Blue for good  
  else if (health >= 25) color = '#feca57'; // Yellow for fair
  
  healthFill.style.background = color;
  
  // Trigger pulse animation by forcing a reflow
  healthFill.style.animation = 'none';
  healthFill.offsetHeight; // Force reflow
  healthFill.style.animation = '';
}

/**
 * Analyze current product
 */
async function analyzeCurrentProduct() {
  // Double-check we're still on a product page
  if (!AmazonScraper.isProductPage()) {
    console.log('BloomCart: No longer on a product page, skipping analysis');
    return;
  }

  const scrapedData = AmazonScraper.scrapeProduct();

  if (!scrapedData) {
    console.warn('BloomCart: Could not scrape product data');
    return;
  }

  // Show loading state
  showFloatingTab({ loading: true });

  // Send to background script for analysis
  chrome.runtime.sendMessage(
    {
      action: 'analyzeProduct',
      data: { scrapedData }
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error('BloomCart: Error analyzing product', chrome.runtime.lastError);
        showFloatingTab({ error: 'Failed to analyze product' });
        return;
      }

      if (response && response.success) {
        currentProductRating = response.product;
        showFloatingTab({ product: response.product });
        console.log('BloomCart: Product analyzed', response.product);
      } else {
        showFloatingTab({ error: response?.error || 'Analysis failed' });
      }
    }
  );
}

/**
 * Show floating tab with rating
 */
function showFloatingTab(options = {}) {
  if (!floatingTab) {
    createFloatingTab();
  }

  const tabContent = floatingTab.querySelector('#bloomcart-tab-content');

  if (options.loading) {
    tabContent.innerHTML = `
      <div class="bloomcart-card">
        <div class="bloomcart-loading">
          <div class="spinner"></div>
          <p>Analyzing sustainability...</p>
        </div>
      </div>
    `;
    floatingTab.classList.add('expanded');
  } else if (options.error) {
    tabContent.innerHTML = `
      <div class="bloomcart-card">
        <div class="bloomcart-error">
          <div class="error-icon">⚠️</div>
          <p>${options.error}</p>
          <button class="retry-btn" onclick="window.location.reload()">Try Again</button>
        </div>
      </div>
    `;
    floatingTab.classList.add('expanded');
  } else if (options.product) {
    const product = options.product;
    const health = currentPlantState.currentFrame || 50;
    const tier = getTierFromScore(product.overallScore || 50);
    const tierLabel = getTierLabel(tier);

    tabContent.innerHTML = `
      <div class="bloomcart-main-card">
        <!-- Header -->
        <div class="bloomcart-header">
          <div class="brand-section">
            <div class="brand-icon">🌱</div>
            <span class="brand-name">BloomCart</span>
          </div>
          <button class="close-button" onclick="closeBloomCart()">×</button>
        </div>

        <!-- Product Info -->
        <div class="product-section">
          <div class="product-details">
            <h2 class="product-name">${product.title || 'Product Analysis'}</h2>
            <p class="product-brand">${product.brand || 'Analyzing...'}</p>
          </div>
        </div>

        <!-- Score Badge -->
        <div class="score-display">
          <div class="score-badge-large" style="background: ${getTierColor(tier)};">
            <span class="score-number-large">${tier}</span>
            <span class="score-sparkle">✨</span>
          </div>
          <h3 class="score-label-large">${tierLabel}</h3>
          <p class="score-tier-text">Tier ${tier} of 5</p>

          <!-- Tier Progress -->
          <div class="tier-progress-row">
            ${Array.from({length: 5}, (_, i) => `
              <div class="tier-segment ${i < tier ? 'active tier-' + (i+1) : ''}"></div>
            `).join('')}
          </div>
        </div>

        <!-- Flower Garden -->
        <div class="bloom-garden-tab">
          <div class="garden-bg-tab"></div>
          <div id="tab-flower-container" class="tab-flower-container"></div>
          <h3 class="bloom-title-tab">Your Bloom</h3>
          <p class="bloom-subtitle-tab">Cart Health: ${Math.round(health)}%</p>
        </div>

        <!-- Sustainability Details -->
        <div class="sustainability-section">
          <button class="details-toggle" onclick="toggleSustainabilityDetails(this)">
            <span class="details-title">Sustainability Details</span>
            <span class="toggle-icon">▼</span>
          </button>
          <div class="details-content" style="display: none;">
            <div class="metrics-row">
              <div class="metric-item">
                <span class="metric-label">Environmental</span>
                <span class="metric-value">${product.environmental || 0}%</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Social</span>
                <span class="metric-value">${product.social || 0}%</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Economic</span>
                <span class="metric-value">${product.economic || 0}%</span>
              </div>
            </div>
            ${product.carbonFootprint ? `
            <div class="carbon-info">
              <span class="carbon-label">Carbon Footprint:</span>
              <span class="carbon-value">${product.carbonFootprint.co2e?.toFixed(2) || 0} kg CO₂e</span>
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Impact Card -->
        <div class="impact-card">
          <div class="impact-header">
            <span class="impact-title">Your Impact 🌱</span>
          </div>
          <p class="impact-message">
            Cart Health: ${Math.round(health)}%<br>
            Keep choosing sustainable products to help your garden flourish!
          </p>
        </div>

        <!-- Action Button -->
        <button class="grow-garden-btn" onclick="handleGrowGarden()">
          <span class="btn-icon">🛒</span>
          Add to Cart & Grow Garden
        </button>

        <!-- Footer -->
        <div class="extension-footer">
          <span class="footer-text">BloomCart Extension • v1.0</span>
        </div>
      </div>
    `;

    floatingTab.classList.add('expanded');

    // Render flower in tab
    setTimeout(() => renderTabFlower(health), 100);

    // Add global toggle function
    window.toggleSustainabilityDetails = function(button) {
      const content = button.nextElementSibling;
      const icon = button.querySelector('.toggle-icon');

      if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '▲';
        button.classList.add('expanded');
      } else {
        content.style.display = 'none';
        icon.textContent = '▼';
        button.classList.remove('expanded');
      }
    };

    // Add global grow garden function
    window.handleGrowGarden = function() {
      handlePurchase(options.product);
    };

    // Add global close function
    window.closeBloomCart = function() {
      floatingTab.classList.remove('expanded');
    };
  }
}

/**
 * Render flower in floating tab
 */
function renderTabFlower(health) {
  const container = document.getElementById('tab-flower-container');
  if (!container) {
    console.log('BloomCart: Tab flower container not found');
    return;
  }

  health = health || 50;
  container.innerHTML = '';

  // Calculate flower properties
  const stemHeight = 60 + (health / 100) * 80; // 60-140px
  const bloomCount = Math.max(1, Math.floor((health / 100) * 3)); // 1-3 blooms
  const leafCount = Math.max(2, Math.ceil((health / 100) * 4)); // 2-4 leaves

  // Create stem
  const stem = document.createElement('div');
  stem.className = 'tab-flower-stem';
  stem.style.height = `${stemHeight}px`;
  container.appendChild(stem);

  // Create leaves
  for (let i = 0; i < leafCount; i++) {
    const leaf = document.createElement('div');
    leaf.className = 'tab-flower-leaf';
    leaf.style.bottom = `${15 + (i * 20)}px`;
    leaf.style.left = i % 2 === 0 ? 'calc(50% - 20px)' : 'calc(50% + 10px)';
    leaf.style.transform = i % 2 === 0 ? 'rotate(-30deg)' : 'rotate(30deg) scaleX(-1)';
    container.appendChild(leaf);
  }

  // Create blooms
  for (let i = 0; i < bloomCount; i++) {
    const bloom = document.createElement('div');
    bloom.className = 'tab-flower-bloom';
    bloom.style.bottom = `${stemHeight - 25 - (i * 20)}px`;

    // Create petals (5 petals per bloom)
    for (let j = 0; j < 5; j++) {
      const petal = document.createElement('div');
      petal.className = 'tab-flower-petal';
      petal.style.transform = `rotate(${j * 72}deg) translateY(-12px)`;
      petal.style.animationDelay = `${j * 0.1}s`;
      bloom.appendChild(petal);
    }

    // Create center
    const center = document.createElement('div');
    center.className = 'tab-flower-center';
    bloom.appendChild(center);

    container.appendChild(bloom);
  }

  // Add decorative elements
  for (let i = 0; i < 3; i++) {
    const decor = document.createElement('div');
    decor.className = 'tab-decorative-leaf';
    decor.style.animationDelay = `${i * 0.5}s`;
    container.appendChild(decor);
  }

  console.log('BloomCart: Tab flower rendered -', bloomCount, 'blooms');
}

/**
 * Get tier from score
 */
function getTierFromScore(score) {
  if (score >= 80) return 5;
  if (score >= 60) return 4;
  if (score >= 40) return 3;
  if (score >= 20) return 2;
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
 * Get tier color
 */
function getTierColor(tier) {
  const colors = [
    'linear-gradient(135deg, #EF5350 0%, #E53935 100%)',
    'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
    'linear-gradient(135deg, #FDD835 0%, #F9A825 100%)',
    'linear-gradient(135deg, #66BB6A 0%, #43A047 100%)',
    'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)'
  ];
  return colors[tier - 1] || colors[2];
}


/**
 * Create floating tab
 */
function createFloatingTab() {
  if (floatingTab) {
    return;
  }

  floatingTab = document.createElement('div');
  floatingTab.id = 'bloomcart-floating-tab';
  floatingTab.innerHTML = `
    <div id="bloomcart-tab-trigger">
      <span class="leaf-icon">🌱</span>
    </div>
    <div id="bloomcart-tab-content"></div>
  `;

  document.body.appendChild(floatingTab);

  // Add click handler for trigger
  document.getElementById('bloomcart-tab-trigger').addEventListener('click', () => {
    if (currentProductRating) {
      floatingTab.classList.toggle('expanded');
    } else {
      analyzeCurrentProduct();
    }
  });

  console.log('BloomCart: Floating tab created');
}

/**
 * Handle purchase (when user clicks "Track Purchase")
 */
async function handlePurchase(product) {
  console.log('BloomCart: Tracking purchase', product);

  // Send to background script to update plant state in backend
  chrome.runtime.sendMessage(
    {
      action: 'trackPurchase',
      data: {
        userId: currentPlantState.userId,
        product: product
      }
    },
    (response) => {
      if (response && response.success) {
        // Update current plant state from backend response
        currentPlantState = response.plantState;

        // Update animation to new frame
        updatePlantFrame();

        // Show success message
        const frameChange = product.rating.frameChange;
        alert(`Purchase tracked! Your plant ${frameChange > 0 ? 'grew' : 'shrunk'} by ${Math.abs(frameChange)} frames.`);

        floatingTab.classList.remove('expanded');
      } else {
        alert('Failed to track purchase. Please try again.');
      }
    }
  );
}

/**
 * Observe page changes for SPA-style navigation
 */
function observePageChanges() {
  let lastUrl = window.location.href;

  const observer = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      console.log('BloomCart: Page changed, re-initializing');

      // Reset current product rating
      currentProductRating = null;

      // Re-analyze if still on product page
      if (AmazonScraper.isProductPage()) {
        analyzeCurrentProduct();
      } else {
        // Hide floating tab if not on product page
        if (floatingTab) {
          floatingTab.classList.remove('expanded');
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

/**
 * Show cart sustainability summary when health indicator is clicked
 */
function showCartSummary() {
  const summary = document.createElement('div');
  summary.id = 'bloomcart-cart-summary';
  summary.style.cssText = `
    position: fixed;
    bottom: 210px;
    right: 20px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border: 2px solid #e0e0e0;
    border-radius: 12px;
    padding: 15px;
    box-shadow: 0 8px 25px rgba(0,0,0,0.15);
    z-index: 10001;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    width: 200px;
    animation: fadeInUp 0.3s ease-out;
  `;
  
  const health = currentPlantState.currentFrame;
  const totalItems = currentPlantState.totalCartItems || 0;
  const sustainableItems = currentPlantState.sustainableCartItems || 0;
  
  let healthStatus = 'Poor';
  let healthColor = '#ff6b6b';
  
  if (health >= 75) {
    healthStatus = 'Excellent';
    healthColor = '#0be881';
  } else if (health >= 50) {
    healthStatus = 'Good';
    healthColor = '#48dbfb';
  } else if (health >= 25) {
    healthStatus = 'Fair';
    healthColor = '#feca57';
  }
  
  summary.innerHTML = `
    <div style="text-align: center; margin-bottom: 12px;">
      <h4 style="margin: 0; color: #333; font-size: 14px;">🌱 Plant Health</h4>
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <span>Health:</span>
      <span style="color: ${healthColor}; font-weight: 600;">${Math.round(health)}% (${healthStatus})</span>
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <span>Cart Items:</span>
      <span style="color: #333; font-weight: 600;">${totalItems}</span>
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
      <span>Sustainable:</span>
      <span style="color: #0be881; font-weight: 600;">${sustainableItems}</span>
    </div>
    <div style="text-align: center; font-size: 11px; color: #666; font-style: italic;">
      Add eco-friendly items to grow your plant! 🌿
    </div>
    <div style="text-align: center; margin-top: 8px;">
      <button id="close-summary" style="background: none; border: 1px solid #ddd; border-radius: 6px; padding: 4px 8px; font-size: 11px; cursor: pointer;">Close</button>
    </div>
  `;
  
  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  // Remove any existing summary
  const existingSummary = document.getElementById('bloomcart-cart-summary');
  if (existingSummary) {
    existingSummary.remove();
  }
  
  document.body.appendChild(summary);
  
  // Add close button functionality
  document.getElementById('close-summary').addEventListener('click', () => {
    summary.remove();
    style.remove();
  });
  
  // Add click outside to close
  setTimeout(() => {
    document.addEventListener('click', function closeSummaryOnClickOutside(e) {
      if (!summary.contains(e.target) && !document.getElementById('bloomcart-plant-health').contains(e.target)) {
        summary.remove();
        style.remove();
        document.removeEventListener('click', closeSummaryOnClickOutside);
      }
    });
  }, 100);
  
  // Auto-close after 10 seconds
  setTimeout(() => {
    if (summary.parentNode) {
      summary.remove();
      style.remove();
    }
  }, 10000);
}

// Listen for storage changes to sync plant state across tabs
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.plantState) {
    console.log('BloomCart: Plant state updated from storage', changes.plantState.newValue);
    currentPlantState = changes.plantState.newValue;
    updatePlantDisplay();
    updateHealthIndicator();
  }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBloomCart);
} else {
  initBloomCart();
}

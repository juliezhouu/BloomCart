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

// Helper data for metrics
const LEARN_MORE_CONTENT = {
  carbon: {
    what: 'CO2 equivalent emissions from production, transport, and disposal',
    how: 'Calculated based on materials, manufacturing, and shipping',
    tip: 'Choose products with lower carbon footprint or local sourcing'
  },
  water: {
    what: 'Total water used in production and processing',
    how: 'Estimated from material type and manufacturing process',
    tip: 'Look for water-efficient materials like recycled content'
  },
  energy: {
    what: 'Energy consumed during manufacturing and transport',
    how: 'Based on production methods and shipping distance',
    tip: 'Products with renewable energy use have lower impact'
  },
  recyclability: {
    what: 'How easily the product can be recycled at end of life',
    how: 'Scored based on material composition and design',
    tip: 'Choose products with single-material construction'
  }
};

/**
 * Get context string for metric values
 */
function getContextString(metric, value) {
  if (metric === 'co2e') {
    if (value < 1) return 'Very Low';
    if (value < 5) return 'Low';
    if (value < 20) return 'Moderate';
    if (value < 50) return 'High';
    return 'Very High';
  } else if (metric === 'water') {
    if (value < 50) return 'Very Low';
    if (value < 200) return 'Low';
    if (value < 500) return 'Moderate';
    if (value < 1000) return 'High';
    return 'Very High';
  } else if (metric === 'energy') {
    if (value < 5) return 'Very Low';
    if (value < 20) return 'Low';
    if (value < 50) return 'Moderate';
    if (value < 100) return 'High';
    return 'Very High';
  } else if (metric === 'recyclability') {
    if (value >= 80) return 'Excellent';
    if (value >= 60) return 'Good';
    if (value >= 40) return 'Fair';
    if (value >= 20) return 'Poor';
    return 'Very Poor';
  }
  return '';
}

/**
 * Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
 */
function ordinalSuffix(num) {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return num + 'st';
  if (j === 2 && k !== 12) return num + 'nd';
  if (j === 3 && k !== 13) return num + 'rd';
  return num + 'th';
}

/**
 * Initialize BloomCart on Amazon pages (product pages and cart pages)
 */
async function initBloomCart() {
  console.log('BloomCart: Initializing...');

  // Load plant state from Chrome storage
  await loadPlantState();

  // Always sync cart items from Amazon on any page (fetches cart HTML in background)
  syncCartItems();

  if (AmazonScraper.isProductPage()) {
    console.log('BloomCart: On product page');
    // Create and display plant
    createPlantDisplay();
    // Scrape product and analyze
    analyzeCurrentProduct();
    // Listen for navigation changes (SPA-style navigation)
    observePageChanges();
    // Initialize cart monitoring
    initializeCartMonitoring();
  } else if (AmazonScraper.isCartPage()) {
    console.log('BloomCart: On cart page, analyzing cart items...');
    analyzeCartPage();
    // Monitor cart for changes
    observeCartChanges();
  } else {
    console.log('BloomCart: Not a product or cart page');
    // Still observe for SPA navigation
    observePageChanges();
  }
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

    // Store product in cart and update plant health
    chrome.runtime.sendMessage(
      { action: 'addToCart', data: { product: rating } },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('BloomCart: addToCart error', chrome.runtime.lastError);
          return;
        }
        if (response && response.success && response.plantState) {
          console.log('BloomCart: Product added to cart, plant health:', response.plantState.currentFrame);
          currentPlantState = response.plantState;
          savePlantState(response.plantState);
          updatePlantDisplay();
          updateHealthIndicator();
        }
      }
    );
    
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

  // Set up timeout (30 seconds)
  const timeout = setTimeout(() => {
    console.error('BloomCart: Analysis timed out after 30 seconds');
    showFloatingTab({ error: 'Analysis took too long. Please try again.' });
  }, 30000);

  // Send to background script for analysis
  chrome.runtime.sendMessage(
    {
      action: 'analyzeProduct',
      data: { scrapedData }
    },
    (response) => {
      clearTimeout(timeout);
      
      if (chrome.runtime.lastError) {
        console.error('BloomCart: Error analyzing product', chrome.runtime.lastError);
        showFloatingTab({ error: 'Failed to analyze product. Extension may need to be reloaded.' });
        return;
      }

      if (response && response.success) {
        currentProductRating = response.product;
        showFloatingTab({ product: response.product });
        console.log('BloomCart: Product analyzed', response.product);
      } else {
        const errorMsg = response?.error || 'Analysis failed';
        console.error('BloomCart: Analysis error:', errorMsg);
        showFloatingTab({ error: errorMsg });
      }
    }
  );
}

/**
 * Get product percentiles from the product data
 */
function getProductPercentiles(product) {
  return {
    overall: product.percentile || product.overallScore || 50,
    carbon: product.carbonPercentile || 50,
    water: product.waterPercentile || 50,
    energy: product.energyPercentile || 50,
    recyclability: product.recyclabilityPercentile || 50
  };
}

/**
 * Build a metric card for the analytics tab
 */
function buildMetricCard(metricKey, label, value, unit, product) {
  const percentiles = getProductPercentiles(product);
  const pct = percentiles[metricKey] || 50;
  const numValue = parseFloat(value) || 0;

  // Context string and per-weight line
  let contextStr = '';
  let perWeightStr = '';
  const weightKg = product.sustainabilityData?.estimatedWeightKg || 1.0;

  if (metricKey === 'co2e' || metricKey === 'carbon') {
    contextStr = getContextString('co2e', numValue);
    if (weightKg > 0) perWeightStr = `${(numValue / weightKg).toFixed(1)} kg/kg product`;
  } else if (metricKey === 'water') {
    contextStr = getContextString('water', numValue);
    if (weightKg > 0) perWeightStr = `${Math.round(numValue / weightKg)} L/kg product`;
  } else if (metricKey === 'energy') {
    contextStr = getContextString('energy', numValue);
    if (weightKg > 0) perWeightStr = `${(numValue / weightKg).toFixed(1)} kWh/kg product`;
  } else if (metricKey === 'recyclability') {
    contextStr = getContextString('recyclability', numValue);
    perWeightStr = '';
  }

  const learnMore = LEARN_MORE_CONTENT[metricKey] || {};

  return `
    <div class="metric-card-tab ${metricKey}-card-tab">
      <div class="metric-info-tab">
        <span class="metric-label-tab">${label}</span>
        <span class="metric-value-tab">${value} ${unit}</span>
        <span class="metric-context-tab">${contextStr}</span>
        ${perWeightStr ? `<span class="metric-per-weight">${perWeightStr}</span>` : ''}
        <span class="metric-percentile-badge">${ordinalSuffix(pct)} percentile</span>
      </div>
      <div class="metric-progress-tab">
        <div class="metric-bar-tab ${metricKey}-bar-tab" style="width: ${pct}%;"></div>
      </div>
      <button class="learn-more-toggle" data-metric="${metricKey}">
        Learn more <span class="learn-more-chevron">&#9662;</span>
      </button>
      <div class="learn-more-content" id="learn-more-${metricKey}" style="display:none;">
        <p><strong>What it means:</strong> ${learnMore.what || ''}</p>
        <p><strong>How it's calculated:</strong> ${learnMore.how || ''}</p>
        <p><strong>Tip:</strong> ${learnMore.tip || ''}</p>
      </div>
    </div>
  `;
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
          <button class="retry-btn" id="bloomcart-retry-btn">Try Again</button>
        </div>
      </div>
    `;
    floatingTab.classList.add('expanded');

    // Bind retry button (addEventListener instead of inline onclick)
    const retryBtn = document.getElementById('bloomcart-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => window.location.reload());
    }
  } else if (options.product) {
    const product = options.product;
    const productScore = product.overallScore || 0;
    console.log('BloomCart Sidebar: Showing product score:', productScore, 'for product:', product.title);
    const productGrade = product.grade || (product.rating && product.rating.grade) || 'D';
    const gradeLabels = { 'A': 'Excellent', 'B': 'Great', 'C': 'Good', 'D': 'Average', 'E': 'Fair', 'F': 'Poor', 'G': 'Very Poor' };
    const gradeColors = {
      'A': 'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)',
      'B': 'linear-gradient(135deg, #66BB6A 0%, #43A047 100%)',
      'C': 'linear-gradient(135deg, #9CCC65 0%, #7CB342 100%)',
      'D': 'linear-gradient(135deg, #FDD835 0%, #F9A825 100%)',
      'E': 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
      'F': 'linear-gradient(135deg, #EF5350 0%, #E53935 100%)',
      'G': 'linear-gradient(135deg, #8D6E63 0%, #5D4037 100%)'
    };
    const gradeLabel = gradeLabels[productGrade] || 'Unknown';
    const gradeColor = gradeColors[productGrade] || gradeColors['D'];
    const health = currentPlantState.currentFrame || 50;

    tabContent.innerHTML = `
      <div class="bloomcart-main-card">
        <!-- Header -->
        <div class="bloomcart-header">
          <div class="brand-section">
            <div class="brand-icon">🌱</div>
            <span class="brand-name">BloomCart</span>
          </div>
          <button class="close-button" id="bloomcart-close-btn">×</button>
        </div>

        <!-- Tab Navigation -->
        <div class="tab-navigation">
          <button class="tab-btn active" id="tab-btn-overview">
            <span class="tab-label">Overview</span>
          </button>
          <button class="tab-btn" id="tab-btn-analytics">
            <span class="tab-label">Analytics</span>
          </button>
        </div>

        <!-- Tab Content Container -->
        <div class="tab-content-container">
          
          <!-- Overview Tab -->
          <div class="tab-content active" id="overview-tab">
            <!-- Product Info -->
            <div class="product-section">
              <div class="product-details">
                <h2 class="product-name">${product.title || 'Product Analysis'}</h2>
                <p class="product-brand">${product.brand || 'Analyzing...'}</p>
              </div>
            </div>

            <!-- Score Badge - uses product score -->
        <div class="score-display">
          <div class="score-badge-large" style="background: ${gradeColor};">
            <span class="score-number-large">${productGrade}</span>
            <span class="score-sparkle">✨</span>
          </div>
          <h3 class="score-label-large">${gradeLabel}</h3>
          <p class="score-tier-text">${productScore}/100 Sustainability Score</p>

          <!-- Grade Progress -->
          <div class="tier-progress-row">
            ${['G','F','E','D','C','B','A'].map((g, i) => `
              <div class="tier-segment ${i < ('GFEDCBA'.indexOf(productGrade) + 1) ? 'active tier-' + (i+1) : ''}"></div>
            `).join('')}
          </div>
        </div>

        <!-- Flower Garden -->
        <div class="bloom-garden-tab">
          <div class="garden-bg-tab"></div>
          <div id="tab-flower-container" class="tab-flower-container"></div>
          <h3 class="bloom-title-tab">Your Bloom</h3>
        </div>

        <!-- Sustainability Details -->
        <div class="sustainability-section">
          <button class="details-toggle" id="bloomcart-details-toggle">
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
            <span class="impact-title">Product Impact 🌱</span>
          </div>
          <p class="impact-message">
            ${product.rating && product.rating.description ? product.rating.description : 'Sustainability analysis for this product.'}<br>
            ${productScore >= 60 ? 'This is a sustainable choice!' : productScore >= 40 ? 'Consider more eco-friendly alternatives.' : 'This product has a high environmental impact.'}
          </p>
        </div>

        <!-- Action Button -->
        <button class="grow-garden-btn" id="bloomcart-grow-btn">
          <span class="btn-icon">🛒</span>
          Add to Cart & Grow Garden
        </button>
          </div>

          <!-- Analytics Tab -->
          <div class="tab-content" id="analytics-tab">
            <div class="analytics-header">
              <h2 class="analytics-title">Impact Analytics</h2>
              <p class="analytics-subtitle">Percentile ranking vs. similar products</p>
            </div>

            <!-- Percentile Ring Chart -->
            <div class="chart-container-tab">
              <canvas id="impact-pie-chart-tab" width="220" height="220"></canvas>
            </div>

            <!-- Metric Cards -->
            <div class="metrics-grid-tab">
              ${buildMetricCard('carbon', 'Carbon', product.carbonFootprint?.co2e?.toFixed(1) || '0', 'kg CO2e', product)}
              ${buildMetricCard('water', 'Water', product.sustainabilityData?.waterUsage || Math.round((product.carbonFootprint?.co2e || 1) * 75), 'L', product)}
              ${buildMetricCard('energy', 'Energy', product.sustainabilityData?.energyUsage?.toFixed(1) || ((product.carbonFootprint?.co2e || 1) * 0.5).toFixed(1), 'kWh', product)}
              ${buildMetricCard('recyclability', 'Recyclability', product.sustainabilityData?.recyclability || calculateRecyclabilityFromMaterials(product.sustainabilityData?.primaryMaterials) || 50, '%', product)}
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div class="extension-footer">
          <span class="footer-text">BloomCart Extension • v1.0</span>
        </div>
      </div>
    `;

    floatingTab.classList.add('expanded');

    // Render flower in tab based on product score
    setTimeout(() => renderTabFlower(productScore), 100);

    // Add close button event listener
    const closeBtn = document.getElementById('bloomcart-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        console.log('BloomCart: Close button clicked');
        if (floatingTab) {
          floatingTab.classList.remove('expanded');
          console.log('BloomCart: Sidebar closed');
        }
      });
    }

    // Tab switching via addEventListener (inline onclick doesn't work in content script isolated world)
    function switchTab(tabName, clickedBtn) {
      document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
      });
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
      });

      const selectedTab = document.getElementById(tabName + '-tab');
      if (selectedTab) {
        selectedTab.classList.add('active');
      }
      if (clickedBtn) {
        clickedBtn.classList.add('active');
      }

      if (tabName === 'analytics') {
        setTimeout(() => drawTabPieChart(options.product), 100);
      }
    }

    const overviewBtn = document.getElementById('tab-btn-overview');
    const analyticsBtn = document.getElementById('tab-btn-analytics');
    if (overviewBtn) {
      overviewBtn.addEventListener('click', () => switchTab('overview', overviewBtn));
    }
    if (analyticsBtn) {
      analyticsBtn.addEventListener('click', () => switchTab('analytics', analyticsBtn));
    }

    // Sustainability details toggle via addEventListener
    const detailsToggle = document.getElementById('bloomcart-details-toggle');
    if (detailsToggle) {
      detailsToggle.addEventListener('click', () => {
        const content = detailsToggle.nextElementSibling;
        const icon = detailsToggle.querySelector('.toggle-icon');

        if (content.style.display === 'none') {
          content.style.display = 'block';
          icon.textContent = '▲';
          detailsToggle.classList.add('expanded');
        } else {
          content.style.display = 'none';
          icon.textContent = '▼';
          detailsToggle.classList.remove('expanded');
        }
      });
    }

    // Grow garden button via addEventListener
    const growBtn = document.getElementById('bloomcart-grow-btn');
    if (growBtn) {
      growBtn.addEventListener('click', () => {
        handlePurchase(options.product);
      });
    }

    // Learn more toggle event listeners
    document.querySelectorAll('.learn-more-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const metric = btn.getAttribute('data-metric');
        const content = document.getElementById('learn-more-' + metric);
        const chevron = btn.querySelector('.learn-more-chevron');
        if (!content) return;
        if (content.style.display === 'none') {
          content.style.display = 'block';
          chevron.style.transform = 'rotate(180deg)';
          btn.classList.add('expanded');
        } else {
          content.style.display = 'none';
          chevron.style.transform = 'rotate(0deg)';
          btn.classList.remove('expanded');
        }
      });
    });

    // Draw percentile ring chart after a short delay for canvas to be ready
    setTimeout(() => drawTabPieChart(product), 150);
  }
}

/**
 * Draw percentile ring chart in floating tab
 * Shows concentric arcs representing how this product compares to others
 */
function drawTabPieChart(product) {
  const canvas = document.getElementById('impact-pie-chart-tab');
  if (!canvas) return;

  // Set canvas size for retina
  const dpr = window.devicePixelRatio || 1;
  const displaySize = 200;
  canvas.width = displaySize * dpr;
  canvas.height = displaySize * dpr;
  canvas.style.width = displaySize + 'px';
  canvas.style.height = displaySize + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const centerX = displaySize / 2;
  const centerY = displaySize / 2;

  // Get percentile data
  const percentiles = getProductPercentiles(product);
  const targetPct = percentiles.overall;

  // Donut configuration
  const radius = 70;
  const lineWidth = 20;

  // Animation parameters
  const duration = 1200; // 1.2 seconds
  const startTime = performance.now();
  let animationFrame;

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function for smooth animation (ease-out)
    const easeOutCubic = 1 - Math.pow(1 - progress, 3);
    const currentPct = targetPct * easeOutCubic;

    // Clear canvas
    ctx.clearRect(0, 0, displaySize, displaySize);

    // Draw background circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#E8E8E8';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'butt';
    ctx.stroke();

    // Draw animated arc
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (currentPct / 100) * 2 * Math.PI;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'butt';
    ctx.stroke();

    // Center text with animated number
    ctx.fillStyle = '#2E7D32';
    ctx.font = '600 24px Montserrat, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ordinalSuffix(Math.round(currentPct)), centerX, centerY - 6);
    ctx.font = '400 11px Montserrat, Arial, sans-serif';
    ctx.fillStyle = '#666';
    ctx.fillText('percentile', centerX, centerY + 12);

    // Continue animation until complete
    if (progress < 1) {
      animationFrame = requestAnimationFrame(animate);
    }
  }

  // Cancel any existing animation
  if (canvas._animationFrame) {
    cancelAnimationFrame(canvas._animationFrame);
  }

  // Start animation
  animationFrame = requestAnimationFrame(animate);
  canvas._animationFrame = animationFrame;
}

/**
 * Get plant stage from health percentage (7 stages)
 */
function getPlantStage(health) {
  if (health >= 85) return 7; // Fully bloomed
  if (health >= 70) return 6; // Large plant with buds
  if (health >= 55) return 5; // Medium-large plant
  if (health >= 40) return 4; // Medium plant
  if (health >= 25) return 3; // Small growing plant
  if (health >= 10) return 2; // Small sprout
  return 1; // Seedling/withered
}

/**
 * Render plant image in floating tab
 */
function renderTabFlower(health) {
  const container = document.getElementById('tab-flower-container');
  if (!container) {
    console.log('BloomCart: Tab flower container not found');
    return;
  }

  health = health || 50;
  const stage = getPlantStage(health);

  // Get extension URL for the image
  const imageUrl = chrome.runtime.getURL(`assets/images/plant-stages/plant-stage-${stage}.jpg`);

  console.log(`BloomCart: Setting plant to stage ${stage} (health: ${health})`);
  console.log(`BloomCart: Image URL: ${imageUrl}`);

  // Add transition effect
  container.classList.add('changing');

  container.innerHTML = `
    <img
      src="${imageUrl}"
      alt="Plant Stage ${stage}"
      class="plant-stage-image-tab"
      onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌱</text></svg>'"
    />
  `;

  setTimeout(() => {
    container.classList.remove('changing');
  }, 300);

  console.log('BloomCart: Tab plant image rendered - Stage', stage);
}

/**
 * Get tier from score
 */
function getTierFromScore(score) {
  if (score >= 85) return 7;
  if (score >= 70) return 6;
  if (score >= 55) return 5;
  if (score >= 40) return 4;
  if (score >= 25) return 3;
  if (score >= 10) return 2;
  return 1;
}

/**
 * Get tier label
 */
function getTierLabel(tier) {
  const labels = ['Very Poor', 'Poor', 'Fair', 'Average', 'Good', 'Great', 'Excellent'];
  return labels[tier - 1] || 'Unknown';
}

/**
 * Get tier color
 */
function getTierColor(tier) {
  const colors = [
    'linear-gradient(135deg, #8D6E63 0%, #5D4037 100%)',
    'linear-gradient(135deg, #EF5350 0%, #E53935 100%)',
    'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
    'linear-gradient(135deg, #FDD835 0%, #F9A825 100%)',
    'linear-gradient(135deg, #9CCC65 0%, #7CB342 100%)',
    'linear-gradient(135deg, #66BB6A 0%, #43A047 100%)',
    'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)'
  ];
  return colors[tier - 1] || colors[3];
}

/**
 * Get frame change from product grade
 */
function getFrameChangeFromGrade(grade) {
  const frameChanges = {
    'A': 15,
    'B': 10,
    'C': 5,
    'D': 0,
    'E': -5,
    'F': -15,
    'G': -20
  };
  return frameChanges[grade] || 0;
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
 * Handle purchase (when user clicks "Add to Cart & Grow Garden")
 */
async function handlePurchase(product) {
  console.log('BloomCart: Adding to cart', product);

  // Store product in cart and update plant health
  chrome.runtime.sendMessage(
    { action: 'addToCart', data: { product } },
    (response) => {
      if (response && response.success) {
        // Update plant state
        currentPlantState = response.plantState;
        chrome.storage.local.set({ plantState: currentPlantState });

        // Update all plant displays
        updatePlantDisplay();
        updateHealthIndicator();
        renderTabFlower(currentPlantState.currentFrame || 50);

        // Show feedback based on product score
        const score = product.overallScore || 50;
        if (score >= 60) {
          alert(`Added to cart! Great sustainable choice - your plant is thriving! (Health: ${currentPlantState.currentFrame}%)`);
        } else if (score >= 40) {
          alert(`Added to cart. Consider more eco-friendly alternatives next time. (Health: ${currentPlantState.currentFrame}%)`);
        } else {
          alert(`Added to cart. This product has a high environmental impact - your plant needs care! (Health: ${currentPlantState.currentFrame}%)`);
        }

        floatingTab.classList.remove('expanded');
      } else {
        alert('Failed to add to cart. Please try again.');
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

/**
 * Analyze all items on the cart page
 */
function analyzeCartPage() {
  const cartItems = AmazonScraper.scrapeCartItems();
  console.log('BloomCart: Found', cartItems.length, 'cart items');

  if (cartItems.length === 0) {
    // Cart is empty - clear storage
    console.log('BloomCart: Cart is empty, clearing storage');
    chrome.storage.local.set({ cartItems: [] });
    return;
  }

  // Send all items for batch analysis
  chrome.runtime.sendMessage(
    {
      action: 'analyzeCartItems',
      data: { items: cartItems }
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error('BloomCart: Cart analysis error', chrome.runtime.lastError);
        return;
      }
      if (response && response.success) {
        console.log('BloomCart: Cart items analyzed:', response.cartItems.length);
      }
    }
  );
}

/**
 * Observe cart page for changes (items added/removed)
 */
function observeCartChanges() {
  const cartContainer = document.querySelector('#sc-active-cart, #activeCartViewForm');
  if (!cartContainer) {
    console.log('BloomCart: Cart container not found for monitoring');
    return;
  }

  console.log('BloomCart: Monitoring cart for changes...');
  const observer = new MutationObserver((mutations) => {
    // Debounce - only analyze after changes stop for 1 second
    clearTimeout(window._bloomCartDebounce);
    window._bloomCartDebounce = setTimeout(() => {
      console.log('BloomCart: Cart changed, re-analyzing...');
      analyzeCartPage();
    }, 1000);
  });

  observer.observe(cartContainer, {
    childList: true,
    subtree: true
  });
}

/**
 * Fetch cart items by loading the Amazon cart page HTML (works from any Amazon page).
 * Uses the browser's cookies so the request is authenticated.
 */
async function fetchCartItems() {
  console.log('BloomCart: Fetching cart page to get real cart items...');
  try {
    const resp = await fetch('https://www.amazon.com/gp/cart/view.html?ref_=nav_cart', {
      credentials: 'include',
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin'
      }
    });

    if (!resp.ok) {
      console.warn('BloomCart: Cart fetch failed with status', resp.status);
      return [];
    }

    const html = await resp.text();
    console.log('BloomCart: Cart page HTML length:', html.length);

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const items = [];
    const seen = new Set();

    // Helper: extract an item from a container element given an ASIN
    function extractItem(container, asin) {
      if (!asin || asin === '' || seen.has(asin)) return null;

      // Comprehensive title selectors for various Amazon cart layouts
      const titleSelectors = [
        '.sc-product-title a',
        'a.sc-product-link',
        '.sc-item-title-content a',
        '.a-truncate-cut',
        '.sc-product-title',
        'span.a-truncate-full',
        'a[href*="/dp/"]',
        '.sc-product-title span',
        '.a-list-item .a-link-normal',
        'span.a-text-bold',
        '.sc-product-link',
        'a.a-link-normal[href*="/dp/"]',
        'a.a-link-normal[href*="/gp/product/"]'
      ];

      let title = '';
      for (const sel of titleSelectors) {
        const el = container.querySelector(sel);
        if (el) {
          const text = el.textContent.trim();
          // Quick filter for obvious non-products  
          if (text && text.length > 3 && 
              !text.toLowerCase().includes('credit card') &&
              !text.toLowerCase().includes('amazon card')) {
            title = text;
            break;
          }
        }
      }

      if (!title) return null;

      // Clean up title (remove excessive whitespace)
      title = title.replace(/\s+/g, ' ').trim();

      // Price selectors
      const priceSelectors = [
        '.sc-product-price',
        '.sc-price',
        '.sc-item-price-block .a-price .a-offscreen',
        '.a-price .a-offscreen',
        '.a-price-whole',
        'span.a-price span.a-offscreen',
        '.sc-price-badge .a-text-price'
      ];

      let price = '';
      for (const sel of priceSelectors) {
        const el = container.querySelector(sel);
        if (el) {
          const text = el.textContent.trim();
          if (text && text.match(/\$|£|€|\d/)) {
            price = text;
            break;
          }
        }
      }

      seen.add(asin);
      return {
        asin,
        title,
        price,
        brand: '',
        category: '',
        description: title,
        details: {},
        url: `https://www.amazon.com/dp/${asin}`,
        scrapedAt: new Date().toISOString()
      };
    }

    // Find the ACTIVE cart container (exclude "Save for Later", recommendations, etc.)
    const activeCartContainer =
      doc.querySelector('#activeCartViewForm') ||
      doc.querySelector('#sc-active-cart') ||
      doc.querySelector('#sc-cart-container');

    console.log('BloomCart: Active cart container found:', !!activeCartContainer);

    // Helper: check if an element is inside "Save for Later" or recommendations
    function isInActiveCart(el) {
      // If we found an active cart container, element must be inside it
      if (activeCartContainer) {
        return activeCartContainer.contains(el);
      }
      // If no container found, exclude known non-cart sections
      const savedCart = doc.querySelector('#sc-saved-cart, #savedCartViewForm');
      if (savedCart && savedCart.contains(el)) return false;
      const recs = el.closest('[class*="recommendation"], [class*="sims-"], [id*="sims-"], [class*="acswidget"], [class*="credit"], [class*="offer"]');
      if (recs) return false;
      return true;
    }

    // Strategy 1: Scoped search inside active cart for [data-asin] elements
    const searchRoot = activeCartContainer || doc;
    const asinEls = searchRoot.querySelectorAll('[data-asin]');

    asinEls.forEach(el => {
      const asin = el.getAttribute('data-asin');
      if (!asin || asin === '' || seen.has(asin)) return;
      if (!isInActiveCart(el)) return;

      // Find the top-level item container for this ASIN
      const itemContainer =
        el.closest('.sc-list-item') ||
        el.closest('[data-item-index]') ||
        el;

      // Skip if this container has promotional content
      if (itemContainer.querySelector('.a-alert, [class*="credit"], [class*="offer"]')) return;
      const containerAsin = itemContainer.getAttribute('data-asin') || asin;
      if (containerAsin !== asin && seen.has(containerAsin)) return;

      const item = extractItem(itemContainer, asin);
      if (item) items.push(item);
    });

    // Strategy 2: Find ASIN from product links inside the active cart
    if (items.length === 0) {
      const linkRoot = activeCartContainer || doc;
      const productLinks = linkRoot.querySelectorAll('a[href*="/dp/"]');

      productLinks.forEach(link => {
        if (!isInActiveCart(link)) return;
        const href = link.getAttribute('href') || '';
        const asinMatch = href.match(/\/dp\/([A-Z0-9]{10})/);
        if (!asinMatch) return;
        const asin = asinMatch[1];
        if (seen.has(asin)) return;

        const title = link.textContent.trim();
        if (!title || title.length < 3) return;

        const container = link.closest('.sc-list-item, [data-asin], [data-item-index]') || link.parentElement;
        let price = '';
        if (container) {
          const priceEl = container.querySelector('.a-price .a-offscreen, .sc-product-price, .sc-price');
          price = priceEl ? priceEl.textContent.trim() : '';
        }

        seen.add(asin);
        items.push({
          asin,
          title: title.replace(/\s+/g, ' ').trim(),
          price,
          brand: '',
          category: '',
          description: title.replace(/\s+/g, ' ').trim(),
          details: {},
          url: `https://www.amazon.com/dp/${asin}`,
          scrapedAt: new Date().toISOString()
        });
      });
    }

    // Strategy 3: Parse cart data from embedded JSON in script tags (last resort)
    if (items.length === 0) {
      const scripts = doc.querySelectorAll('script');
      for (const script of scripts) {
        const text = script.textContent || '';
        // Look for cart-specific JSON patterns
        if (!text.includes('cartItem') && !text.includes('activeCart') && !text.includes('sc-active')) continue;
        const asinMatches = text.matchAll(/"asin"\s*:\s*"([A-Z0-9]{10})"/g);
        const titleMatches = text.matchAll(/"title"\s*:\s*"([^"]+)"/g);
        const asins = [...asinMatches].map(m => m[1]);
        const titles = [...titleMatches].map(m => m[1]);

        if (asins.length > 0 && titles.length >= asins.length) {
          for (let i = 0; i < asins.length; i++) {
            if (seen.has(asins[i])) continue;
            seen.add(asins[i]);
            items.push({
              asin: asins[i],
              title: titles[i] || 'Unknown Product',
              price: '',
              brand: '',
              category: '',
              description: titles[i] || '',
              details: {},
              url: `https://www.amazon.com/dp/${asins[i]}`,
              scrapedAt: new Date().toISOString()
            });
          }
        }
      }
    }

    // Log diagnostics
    if (items.length === 0) {
      const cartForm = doc.querySelector('#activeCartViewForm, #sc-active-cart, .sc-list-body');
      console.warn('BloomCart: Could not parse any cart items. Cart form found:', !!cartForm);
      console.warn('BloomCart: Page title:', doc.title);
      const allAsinCount = doc.querySelectorAll('[data-asin]').length;
      console.warn('BloomCart: Total [data-asin] on page:', allAsinCount);
      const sampleAsins = [...doc.querySelectorAll('[data-asin]')].slice(0, 5).map(el => ({
        asin: el.getAttribute('data-asin'),
        tag: el.tagName,
        classes: el.className.substring(0, 80),
        inActiveCart: activeCartContainer ? activeCartContainer.contains(el) : 'no container'
      }));
      console.warn('BloomCart: Sample elements:', JSON.stringify(sampleAsins));
    } else {
      console.log('BloomCart: Cart items found:', items.map(i => i.asin));
    }

    console.log('BloomCart: Fetched', items.length, 'cart items from cart page');
    return items;
  } catch (err) {
    console.error('BloomCart: Error fetching cart page:', err);
    return [];
  }
}

/**
 * Sync cart items: fetch from Amazon, analyze with AI, and store in chrome.storage
 */
async function syncCartItems() {
  console.log('BloomCart: Syncing cart items...');
  
  // If on cart page, scrape directly; otherwise try fetch
  let items = [];
  if (AmazonScraper.isCartPage()) {
    items = AmazonScraper.scrapeCartItems();
  } else {
    items = await fetchCartItems();
  }

  if (items.length === 0) {
    console.log('BloomCart: No items in Amazon cart');
    return;
  }

  // Send to service worker for AI analysis and storage
  chrome.runtime.sendMessage(
    { action: 'analyzeCartItems', data: { items } },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error('BloomCart: Cart sync error', chrome.runtime.lastError);
        return;
      }
      if (response && response.success) {
        console.log('BloomCart: Cart synced!', response.cartItems.length, 'items analyzed');
      }
    }
  );
}

/**
 * Listen for messages from popup and other extension parts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getCartItems') {
    // If on cart page, scrape directly; otherwise return cached items
    if (AmazonScraper.isCartPage()) {
      const items = AmazonScraper.scrapeCartItems();
      sendResponse({ items });
    } else {
      chrome.storage.local.get(['cartItems'], (result) => {
        sendResponse({ items: result.cartItems || [] });
      });
    }
    return true;
  } else if (message.action === 'syncCart') {
    // Force fresh cart sync
    console.log('BloomCart: Popup requested fresh cart sync');
    syncCartItems();
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'getProductInfo') {
    // Return current product rating if on a product page
    if (currentProductRating) {
      sendResponse({ product: currentProductRating });
    } else if (AmazonScraper.isProductPage()) {
      // Try to scrape and return basic info
      const scraped = AmazonScraper.scrapeProduct();
      sendResponse({ product: scraped ? { title: scraped.title, brand: scraped.brand } : null });
    } else {
      sendResponse({ product: null });
    }
    return false;
  }

  return false;
});

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

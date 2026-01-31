/**
 * BloomCart Main Content Script
 * Manages plant display, rating tab, and product analysis
 */

let currentPlantState = null;
let currentProductRating = null;
let plantContainer = null;
let floatingTab = null;

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
        userId: result.userId,
        currentFrame: 0,
        totalPurchases: 0,
        sustainablePurchases: 0
      };

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

  // Create container
  plantContainer = document.createElement('div');
  plantContainer.id = 'bloomcart-plant-container';
  plantContainer.innerHTML = `
    <div id="bloomcart-plant-animation"></div>
  `;

  document.body.appendChild(plantContainer);

  // Initialize Lottie animation
  initializePlantAnimation();

  console.log('BloomCart: Plant display created');
}

/**
 * Initialize Lottie plant animation
 */
function initializePlantAnimation() {
  const animationContainer = document.getElementById('bloomcart-plant-animation');

  if (!animationContainer || typeof lottie === 'undefined') {
    console.error('BloomCart: Lottie not loaded or container not found');
    return;
  }

  // Load Lottie animation
  // Note: You'll need to add a plant animation JSON file
  const animationPath = chrome.runtime.getURL('assets/animations/plant.json');

  fetch(animationPath)
    .then(response => response.json())
    .then(animationData => {
      window.plantAnimation = lottie.loadAnimation({
        container: animationContainer,
        renderer: 'svg',
        loop: false,
        autoplay: false,
        animationData: animationData
      });

      // Set to current frame
      const totalFrames = window.plantAnimation.totalFrames;
      const currentFrame = (currentPlantState.currentFrame / 100) * totalFrames;
      window.plantAnimation.goToAndStop(currentFrame, true);

      console.log('BloomCart: Plant animation initialized at frame', currentFrame);
    })
    .catch(error => {
      console.error('BloomCart: Failed to load plant animation', error);
    });
}

/**
 * Update plant animation to new frame
 */
function updatePlantAnimation(frameChange) {
  if (!window.plantAnimation) {
    console.warn('BloomCart: Plant animation not initialized');
    return;
  }

  const newFramePercent = Math.max(0, Math.min(100, currentPlantState.currentFrame + frameChange));
  const totalFrames = window.plantAnimation.totalFrames;
  const targetFrame = (newFramePercent / 100) * totalFrames;

  // Animate to new frame
  window.plantAnimation.playSegments([window.plantAnimation.currentFrame, targetFrame], true);

  // Update state
  savePlantState({ currentFrame: newFramePercent });

  console.log('BloomCart: Plant animation updated', {
    frameChange,
    newFramePercent,
    targetFrame
  });
}

/**
 * Analyze current product
 */
async function analyzeCurrentProduct() {
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
      <div class="bloomcart-loading">
        <div class="spinner"></div>
        <p>Analyzing sustainability...</p>
      </div>
    `;
    floatingTab.classList.add('expanded');
  } else if (options.error) {
    tabContent.innerHTML = `
      <div class="bloomcart-error">
        <p>${options.error}</p>
      </div>
    `;
    floatingTab.classList.add('expanded');
  } else if (options.product) {
    const { rating, carbonFootprint, title } = options.product;
    const ratingColors = {
      'A': '#00C851',
      'B': '#7CB342',
      'C': '#FFD600',
      'D': '#FF9800',
      'E': '#F44336'
    };

    tabContent.innerHTML = `
      <div class="bloomcart-rating">
        <button id="bloomcart-close-btn" class="close-btn">&times;</button>
        <h3>Sustainability Rating</h3>
        <div class="rating-badge" style="background-color: ${ratingColors[rating.grade]}">
          ${rating.grade}
        </div>
        <p class="rating-description">${rating.description}</p>
        <div class="rating-details">
          <p><strong>CO2e:</strong> ${carbonFootprint.co2e.toFixed(2)} kg</p>
          <p><strong>Score:</strong> ${rating.score.toFixed(2)} kg CO2e/kg</p>
          <p class="data-source"><em>Source: ${carbonFootprint.source === 'climatiq' ? 'Climatiq API' : 'AI Estimate'}</em></p>
        </div>
        <button id="bloomcart-add-to-cart-btn" class="action-btn">Track Purchase</button>
      </div>
    `;

    floatingTab.classList.add('expanded');

    // Add event listeners
    document.getElementById('bloomcart-close-btn').addEventListener('click', () => {
      floatingTab.classList.remove('expanded');
    });

    document.getElementById('bloomcart-add-to-cart-btn').addEventListener('click', () => {
      handlePurchase(options.product);
    });
  }
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
        // Update plant animation
        updatePlantAnimation(product.rating.frameChange);

        // Show success message
        alert(`Purchase tracked! Your plant ${product.rating.frameChange > 0 ? 'grew' : 'shrunk'} by ${Math.abs(product.rating.frameChange)} frames.`);

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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBloomCart);
} else {
  initBloomCart();
}

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

  // Show speech bubble based on plant state after a short delay
  setTimeout(() => {
    const health = currentPlantState.currentFrame || 50;
    const tier = getTier(health);
    if (tier <= 3) {
      showPlantGreeting(tier);
    }
  }, 800);
});

/**
 * Initialize UI with current state
 */
function initializeUI() {
  try {
    const health = currentPlantState.currentFrame || 50;
    const grade = getGrade(health);

    updateScoreDisplay(grade, health);
    updateTierProgress(grade);
    
    // Initialize sustainability details (will be updated when cart loads)
    chrome.storage.local.get(['cartItems'], (result) => {
      const items = result.cartItems || [];
      if (items.length > 0) {
        updateSustainabilityDetails(items);
      } else {
        updateSustainabilityDetails([]);
      }
    });

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
      // Use cached items - don't re-analyze to keep scores consistent
      console.log('BloomCart: Using cached cart items with stored scores');
      displayCartItems(cartItems);
    } else {
      document.getElementById('product-title').textContent = 'No items in cart';
      document.getElementById('product-brand').textContent = 'Add products to Amazon cart';
      // Initialize sustainability details with empty values
      updateSustainabilityDetails([]);
      
      // No cached items - try to get fresh cart items from Amazon
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url && (tabs[0].url.includes('amazon.com') || tabs[0].url.includes('amazon.ca') || tabs[0].url.includes('amazon.co.uk'))) {
          console.log('BloomCart: No cached items, requesting fresh cart items...');
          
          chrome.tabs.sendMessage(tabs[0].id, { action: 'getCartItems' }, (response) => {
            if (chrome.runtime.lastError) {
              console.log('BloomCart: Could not get fresh cart items:', chrome.runtime.lastError.message);
              return;
            }
            
            if (response && response.items && response.items.length > 0) {
              // Analyze fresh cart items via service worker
              console.log('BloomCart: Analyzing', response.items.length, 'fresh items...');
              chrome.runtime.sendMessage(
                { action: 'analyzeCartItems', data: { items: response.items } },
                (analysisResponse) => {
                  if (analysisResponse && analysisResponse.success && analysisResponse.cartItems.length > 0) {
                    console.log('BloomCart: Analysis complete, displaying items');
                    displayCartItems(analysisResponse.cartItems);
                  }
                }
              );
            }
          });
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
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Calculate and display average score
  const avgScore = Math.round(items.reduce((sum, item) => sum + item.overallScore, 0) / items.length);
  console.log('BloomCart Popup: Cart items scores:', items.map(i => ({ title: i.title, score: i.overallScore })));
  console.log('BloomCart Popup: Average score:', avgScore);
  document.getElementById('cart-avg-score').textContent = `${avgScore}/100`;

  // Check for newly added bad items (tier 3 or lower)
  if (window.previousCartSize !== undefined && items.length > window.previousCartSize) {
    const newItem = items[items.length - 1];
    const itemTier = getTier(newItem.overallScore);
    if (itemTier <= 3) {
      showUnsustainableNotification(newItem.overallScore, itemTier);
      showPlantSpeechBubble(newItem.overallScore, itemTier);
    }
  }
  window.previousCartSize = items.length;

  // Update the overall score display based on average
  const grade = getGrade(avgScore);
  updateScoreDisplay(grade, avgScore);
  updateTierProgress(grade);

  // Update plant based on average
  if (plantImage) {
    setPlantStage(avgScore);
  }

  // Update dashboard with cart items
  updateDashboard(items);
  
  // Update sustainability details with totals
  updateSustainabilityDetails(items);
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
 * Get grade from score (A-G system, 7 grades)
 */
function getGrade(score) {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  if (score >= 25) return 'E';
  if (score >= 10) return 'F';
  return 'G';
}

/**
 * Get grade label
 */
function getGradeLabel(grade) {
  const labels = { 'A': 'Excellent', 'B': 'Great', 'C': 'Good', 'D': 'Average', 'E': 'Fair', 'F': 'Poor', 'G': 'Very Poor' };
  return labels[grade] || 'Unknown';
}

/**
 * Get tier from health percentage (used for plant stage only)
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
 * Update score display (A-G grade system)
 */
function updateScoreDisplay(grade, score) {
  const scoreNumber = document.getElementById('score-number');
  const scoreLabel = document.getElementById('score-label');
  const scoreTier = document.getElementById('score-tier');
  const scoreCircle = document.querySelector('.score-circle');

  scoreNumber.textContent = grade;
  scoreLabel.textContent = getGradeLabel(grade);
  scoreTier.textContent = `${score}/100 Sustainability Score`;

  const gradeColors = {
    'A': 'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)',
    'B': 'linear-gradient(135deg, #66BB6A 0%, #43A047 100%)',
    'C': 'linear-gradient(135deg, #9CCC65 0%, #7CB342 100%)',
    'D': 'linear-gradient(135deg, #FDD835 0%, #F9A825 100%)',
    'E': 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
    'F': 'linear-gradient(135deg, #EF5350 0%, #E53935 100%)',
    'G': 'linear-gradient(135deg, #8D6E63 0%, #5D4037 100%)'
  };

  scoreCircle.style.background = gradeColors[grade] || gradeColors['D'];
}

/**
 * Update grade progress bar (7 segments: G, F, E, D, C, B, A)
 */
function updateTierProgress(grade) {
  const gradeIndex = 'GFEDCBA'.indexOf(grade);
  const activeCount = gradeIndex + 1;
  const tierBars = document.querySelectorAll('.tier-bar');
  tierBars.forEach((bar, index) => {
    if (index < activeCount) {
      bar.classList.add('active');
      bar.classList.add('tier-' + (index + 1));
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

  // Update sustainability details from cart items
  chrome.storage.local.get(['cartItems'], (result) => {
    const cartItems = result.cartItems || [];
    updateSustainabilityDetails(cartItems);
  });

  if (product.overallScore !== undefined) {
    const grade = getGrade(product.overallScore);
    updateScoreDisplay(grade, product.overallScore);
    updateTierProgress(grade);
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

  const newStage = getPlantStage(health);
  const previousStage = plantImage.dataset.currentStage ? parseInt(plantImage.dataset.currentStage) : newStage;
  const imagePath = chrome.runtime.getURL(`assets/images/plant-stages/plant-stage-${newStage}.jpg`);

  plantImage.classList.add('changing');
  setTimeout(() => {
    plantImage.src = imagePath;
    plantImage.classList.remove('changing');
  }, 300);

  // Store current stage
  plantImage.dataset.currentStage = newStage;

  // If stage dropped, trigger sad effects
  if (previousStage > newStage) {
    triggerPlantSadness(newStage);
  } else {
    // Remove sadness effects if stage improved
    plantImage.classList.remove('plant-sad');
  }
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
 * Trigger plant sadness visual effects (grayscale)
 */
function triggerPlantSadness(stage) {
  if (!plantImage) return;
  
  // Add sadness class for grayscale effect
  plantImage.classList.add('plant-sad');
  
  // Gradually reduce grayscale based on stage
  const grayAmount = Math.max(0, (5 - stage) * 15);
  plantImage.style.filter = `grayscale(${grayAmount}%)`;
}

/**
 * Show notification when unsustainable item is added
 */
function showUnsustainableNotification(score, tier) {
  const notificationToast = document.getElementById('notification-toast');
  const notificationText = document.getElementById('notification-text');
  
  if (!notificationToast || !notificationText) return;
  
  // Tiered messages - progressively more concerning
  let messages;
  if (tier === 3) {
    // Mild concern (score 25-39)
    messages = [
      "The air quality is dropping. Your flower is starting to worry.",
      "Hmm, pollution levels are rising. Your plant is concerned.",
      "Not the best choice... Your flower feels a bit uneasy.",
      "The smog is building up. Your plant hopes for better next time."
    ];
  } else if (tier === 2) {
    // Serious concern (score 10-24)
    messages = [
      "Oh no! The smog level just rose. Your flower is struggling to breathe.",
      "Air quality declining rapidly! Your plant is gasping for air.",
      "Pollution alert! Your flower is really suffering now.",
      "This is bad... Your plant can barely breathe through the smog."
    ];
  } else {
    // Critical (score 0-9) - most depressed
    messages = [
      "CRITICAL! Toxic smog everywhere. Your flower is dying inside.",
      "This is devastating... Your plant has lost all hope.",
      "Why...? The air is poison. Your flower is withering away.",
      "Complete environmental collapse. Your plant can't survive this."
    ];
  }
  
  notificationText.textContent = messages[Math.floor(Math.random() * messages.length)];
  notificationToast.style.display = 'block';
  notificationToast.classList.add('show');
  
  // Hide after 4 seconds
  setTimeout(() => {
    notificationToast.classList.remove('show');
    setTimeout(() => {
      notificationToast.style.display = 'none';
    }, 300);
  }, 4000);
}

/**
 * Show speech bubble from plant
 */
function showPlantSpeechBubble(score, tier) {
  const speechBubble = document.getElementById('speech-bubble');
  const speechBubbleText = document.getElementById('speech-bubble-text');
  
  if (!speechBubble || !speechBubbleText) return;
  
  // Tiered messages - progressively more depressed
  let sadMessages;
  if (tier === 3) {
    // Mild sadness (score 25-39)
    sadMessages = [
      "I'm feeling a bit under the weather... 😕",
      "Could we... choose better next time? 🥺",
      "The air doesn't feel so fresh... 😔",
      "I'm worried about my leaves... 🍃"
    ];
  } else if (tier === 2) {
    // Deep sadness (score 10-24)
    sadMessages = [
      "I can't breathe... 😢",
      "Why would you do this to me? 💔",
      "I'm wilting... 🥀",
      "The air is so toxic... 😷",
      "Please, I'm struggling here... 🌫️"
    ];
  } else {
    // Extreme depression (score 0-9)
    sadMessages = [
      "I don't want to exist anymore... 💀",
      "Everything is pain... 🖤",
      "There's no hope left... ⚰️",
      "Just let me wither away... 🥀",
      "Why do you hate me so much...? 😭",
      "I'm dying... and you don't even care... 💔"
    ];
  }
  
  speechBubbleText.textContent = sadMessages[Math.floor(Math.random() * sadMessages.length)];
  speechBubble.style.display = 'block';
  speechBubble.classList.add('show');
  
  // Hide after 5 seconds
  setTimeout(() => {
    speechBubble.classList.remove('show');
    setTimeout(() => {
      speechBubble.style.display = 'none';
    }, 300);
  }, 5000);
}

/**
 * Show plant greeting when popup opens
 */
function showPlantGreeting(tier) {
  const speechBubble = document.getElementById('speech-bubble');
  const speechBubbleText = document.getElementById('speech-bubble-text');
  
  if (!speechBubble || !speechBubbleText) return;
  
  // Greeting messages based on tier
  let greetingMessages;
  if (tier === 3) {
    // Mild concern (score 25-39)
    greetingMessages = [
      "Hey... I'm not feeling great today 😕",
      "Things could be better... 🥺",
      "I'm a bit worried about us... 😔",
      "Can we make better choices? 🍃"
    ];
  } else if (tier === 2) {
    // Deep sadness (score 10-24)
    greetingMessages = [
      "I'm really struggling right now... 😢",
      "Everything hurts... 💔",
      "I can barely breathe through all this smog... 😷",
      "Please help me... I'm wilting 🥀",
      "Why is the air so toxic? 🌫️"
    ];
  } else {
    // Extreme depression (score 0-9)
    greetingMessages = [
      "I... I can't do this anymore... 💀",
      "Is there any point...? 🖤",
      "I'm barely hanging on... ⚰️",
      "Everything is darkness... 😭",
      "I don't think I'll make it... 🥀"
    ];
  }
  
  speechBubbleText.textContent = greetingMessages[Math.floor(Math.random() * greetingMessages.length)];
  speechBubble.style.display = 'block';
  speechBubble.classList.add('show');
  
  // Hide after 6 seconds
  setTimeout(() => {
    speechBubble.classList.remove('show');
    setTimeout(() => {
      speechBubble.style.display = 'none';
    }, 300);
  }, 6000);
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
  return { 'A': 15, 'B': 10, 'C': 5, 'D': 0, 'E': -5, 'F': -15, 'G': -20 }[grade] || 0;
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

  const grade = getGrade(newHealth);
  updateScoreDisplay(grade, newHealth);
  updateTierProgress(grade);
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

/**
 * Dashboard Functions
 */

/**
 * Update the dashboard with cart item metrics
 */
function updateDashboard(items) {
  const dashboardEl = document.getElementById('dashboard-section');
  if (!dashboardEl) return;

  if (!items || items.length === 0) {
    dashboardEl.style.display = 'none';
    return;
  }

  dashboardEl.style.display = 'block';

  // Calculate aggregate metrics from cart items
  const metrics = calculateAggregateMetrics(items);
  
  // Draw pie chart
  drawImpactPieChart(metrics);
  
  // Update metric cards
  updateMetricCards(metrics);
}

/**
 * Calculate aggregate sustainability metrics from cart items
 */
function calculateAggregateMetrics(items) {
  const totalCarbon = items.reduce((sum, item) => {
    const carbon = item.sustainabilityData?.carbonFootprint || 0;
    return sum + parseFloat(carbon);
  }, 0);

  const totalWater = items.reduce((sum, item) => {
    // Estimate water usage based on category and carbon
    const carbon = item.sustainabilityData?.carbonFootprint || 1;
    const waterMultiplier = getWaterMultiplier(item.category);
    return sum + (carbon * waterMultiplier);
  }, 0);

  const totalEnergy = items.reduce((sum, item) => {
    // Estimate energy based on carbon (roughly 0.5 kWh per kg CO2)
    const carbon = item.sustainabilityData?.carbonFootprint || 0;
    return sum + (parseFloat(carbon) * 0.5);
  }, 0);

  const avgRecyclability = items.reduce((sum, item) => {
    const recyclability = item.sustainabilityData?.recyclability || 30;
    return sum + recyclability;
  }, 0) / items.length;

  return {
    carbon: totalCarbon.toFixed(2),
    water: Math.round(totalWater),
    energy: totalEnergy.toFixed(1),
    recyclability: Math.round(avgRecyclability),
    breakdown: {
      carbon: 30,
      water: 20,
      energy: 20,
      transport: 15,
      packaging: 10,
      other: 5
    }
  };
}

/**
 * Get water usage multiplier based on product category
 */
function getWaterMultiplier(category) {
  const multipliers = {
    'clothing': 150,
    'textiles': 150,
    'food': 100,
    'electronics': 50,
    'furniture': 80,
    'default': 75
  };

  const cat = (category || '').toLowerCase();
  for (const [key, value] of Object.entries(multipliers)) {
    if (cat.includes(key)) return value;
  }
  return multipliers.default;
}

/**
 * Draw pie chart showing sustainability impact breakdown
 */
function drawImpactPieChart(metrics) {
  const canvas = document.getElementById('impact-pie-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = 80;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Data for pie chart
  const data = [
    { label: 'Carbon', value: metrics.breakdown.carbon, color: '#FF6B6B' },
    { label: 'Water', value: metrics.breakdown.water, color: '#4DABF7' },
    { label: 'Energy', value: metrics.breakdown.energy, color: '#FFD43B' },
    { label: 'Transport', value: metrics.breakdown.transport, color: '#A78BFA' },
    { label: 'Packaging', value: metrics.breakdown.packaging, color: '#51CF66' },
    { label: 'Other', value: metrics.breakdown.other, color: '#ADB5BD' }
  ];

  const total = data.reduce((sum, item) => sum + item.value, 0);
  let currentAngle = -Math.PI / 2; // Start at top

  // Draw pie slices
  data.forEach((item, index) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;

    // Draw slice
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();

    // Add border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    currentAngle += sliceAngle;
  });

  // Draw center circle (donut effect)
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.5, 0, 2 * Math.PI);
  ctx.fillStyle = '#fff';
  ctx.fill();

  // Add total score text in center
  ctx.fillStyle = '#2E7D32';
  ctx.font = 'bold 24px Poppins, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(metrics.recyclability + '%', centerX, centerY);
  ctx.font = '10px Poppins, sans-serif';
  ctx.fillStyle = '#757575';
  ctx.fillText('Sustainable', centerX, centerY + 16);

  // Update legend
  updateChartLegend(data);
}

/**
 * Update chart legend with data
 */
function updateChartLegend(data) {
  const legend = document.getElementById('chart-legend');
  if (!legend) return;

  legend.innerHTML = data.map(item => `
    <div class="legend-item">
      <div class="legend-color" style="background: ${item.color};"></div>
      <span class="legend-label">${item.label}</span>
      <span class="legend-value">${item.value}%</span>
    </div>
  `).join('');
}

/**
 * Update metric cards with calculated values
 */
function updateMetricCards(metrics) {
  // Update values
  document.getElementById('metric-carbon').textContent = `${metrics.carbon} kg`;
  document.getElementById('metric-water').textContent = `${metrics.water} L`;
  document.getElementById('metric-energy').textContent = `${metrics.energy} kWh`;
  document.getElementById('metric-recycle').textContent = `${metrics.recyclability}%`;

  // Update progress bars (animated)
  const maxCarbon = 50; // kg
  const maxWater = 5000; // L
  const maxEnergy = 100; // kWh

  const carbonPercent = Math.min((parseFloat(metrics.carbon) / maxCarbon) * 100, 100);
  const waterPercent = Math.min((parseFloat(metrics.water) / maxWater) * 100, 100);
  const energyPercent = Math.min((parseFloat(metrics.energy) / maxEnergy) * 100, 100);

  // Animate bars
  setTimeout(() => {
    document.getElementById('carbon-bar').style.width = `${carbonPercent}%`;
    document.getElementById('water-bar').style.width = `${waterPercent}%`;
    document.getElementById('energy-bar').style.width = `${energyPercent}%`;
    document.getElementById('recycle-bar').style.width = `${metrics.recyclability}%`;
  }, 100);
}

/**
 * Update sustainability details with cart totals
 */
function updateSustainabilityDetails(cartItems) {
  console.log('Updating sustainability details with items:', cartItems);
  
  if (!cartItems || cartItems.length === 0) {
    // Set default values when no items
    document.getElementById('detail-cost').textContent = '$0.00';
    document.getElementById('detail-carbon').textContent = '0 kg CO2e';
    document.getElementById('detail-energy').textContent = '0 kWh';
    document.getElementById('detail-water').textContent = '0 L';
    return;
  }
  
  // Calculate total cost
  const totalCost = cartItems.reduce((sum, item) => {
    const priceStr = item.price || '0';
    const price = parseFloat(priceStr.toString().replace(/[^0-9.]/g, ''));
    console.log('Item price:', item.title, priceStr, '->', price);
    return sum + (isNaN(price) ? 0 : price);
  }, 0);
  document.getElementById('detail-cost').textContent = `$${totalCost.toFixed(2)}`;
  console.log('Total cost:', totalCost);
  
  // Calculate total carbon
  const totalCarbon = cartItems.reduce((sum, item) => {
    const carbon = item.sustainabilityData?.carbonFootprint || 
                   item.carbonFootprint?.co2e || 
                   item.co2e || 0;
    const carbonNum = parseFloat(carbon);
    console.log('Item carbon:', item.title, carbon, '->', carbonNum);
    return sum + (isNaN(carbonNum) ? 0 : carbonNum);
  }, 0);
  document.getElementById('detail-carbon').textContent = `${totalCarbon.toFixed(2)} kg CO2e`;
  console.log('Total carbon:', totalCarbon);
  
  // Calculate total energy
  const totalEnergy = cartItems.reduce((sum, item) => {
    const carbon = item.sustainabilityData?.carbonFootprint || 
                   item.carbonFootprint?.co2e || 
                   item.co2e || 0;
    const carbonNum = parseFloat(carbon);
    return sum + (isNaN(carbonNum) ? 0 : carbonNum * 0.5);
  }, 0);
  document.getElementById('detail-energy').textContent = `${totalEnergy.toFixed(1)} kWh`;
  console.log('Total energy:', totalEnergy);
  
  // Calculate total water
  const totalWater = cartItems.reduce((sum, item) => {
    const carbon = item.sustainabilityData?.carbonFootprint || 
                   item.carbonFootprint?.co2e || 
                   item.co2e || 1;
    const carbonNum = parseFloat(carbon) || 1;
    const waterMultiplier = 75;
    return sum + (carbonNum * waterMultiplier);
  }, 0);
  document.getElementById('detail-water').textContent = `${Math.round(totalWater)} L`;
  console.log('Total water:', totalWater);
}

/**
 * Setup dashboard toggle
 */
document.addEventListener('DOMContentLoaded', () => {
  const dashboardHeader = document.querySelector('.dashboard-header');
  const dashboardSection = document.getElementById('dashboard-section');

  if (dashboardHeader) {
    dashboardHeader.addEventListener('click', () => {
      dashboardSection.classList.toggle('collapsed');
    });
  }
});

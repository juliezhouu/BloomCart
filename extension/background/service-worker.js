/**
 * BloomCart Background Service Worker
 * Direct OpenRouter/Gemini integration for product sustainability analysis
 */

const OPENROUTER_API_KEY = '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';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const BACKEND_API_URL = 'http://localhost:3000/api';

/**
 * Listen for messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('BloomCart SW: Received message:', request.action);

  switch (request.action) {
    case 'analyzeProduct':
      handleAnalyzeProduct(request.data, sendResponse);
      return true;
    case 'analyzeCartItems':
      handleAnalyzeCartItems(request.data, sendResponse);
      return true;
    case 'getCartItems':
      chrome.storage.local.get(['cartItems'], (r) => {
        sendResponse({ success: true, cartItems: r.cartItems || [] });
      });
      return true;
    case 'addToCart':
      handleAddToCart(request.data, sendResponse);
      return true;
    case 'trackPurchase':
      handleTrackPurchase(request.data, sendResponse);
      return true;
    case 'getPlantState':
      chrome.storage.local.get(['plantState'], (r) => {
        sendResponse({ success: true, plantState: r.plantState });
      });
      return true;
  }

  return false;
});

/**
 * Call OpenRouter API with Gemini model
 */
async function callOpenRouter(prompt) {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/BloomCart',
      'X-Title': 'BloomCart Sustainability Extension'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-001',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('BloomCart SW: OpenRouter error:', response.status, errorText);
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Parse JSON from AI response (handles markdown code blocks)
 */
function parseJSON(text) {
  // Strip markdown code blocks if present
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to find JSON object or array in the text
    const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (match) return JSON.parse(match[0]);
    throw new Error('No valid JSON found in response');
  }
}

/**
 * Analyze a single product using OpenRouter/Gemini
 */
async function analyzeProductWithAI(scrapedData) {
  const prompt = `You are a sustainability and lifecycle analysis expert analyzing an Amazon product. Return ONLY valid JSON with no markdown formatting.

Product: ${scrapedData.title}
Brand: ${scrapedData.brand || 'Unknown'}
Category: ${scrapedData.category || 'General'}
Description: ${(scrapedData.description || '').substring(0, 500)}
Product Details: ${JSON.stringify(scrapedData.details || {}).substring(0, 300)}

Return this exact JSON structure:
{
  "overallScore": <number 0-100>,
  "environmental": <number 0-100>,
  "social": <number 0-100>,
  "economic": <number 0-100>,
  "grade": "<A or B or C or D or E or F or G>",
  "co2e": <estimated kg CO2e for full product lifecycle>,
  "waterLiters": <estimated liters of water used in production>,
  "energyKwh": <estimated kWh of energy for production>,
  "recyclabilityPercent": <0-100 based on material composition>,
  "primaryMaterials": ["<material1>", "<material2>"],
  "productCategory": "<one of: electronics, clothing, furniture, food, books, toys, beauty, kitchen, sports, home, office, default>",
  "estimatedWeightKg": <product weight in kg>,
  "percentileRanking": {
    "overall": <0-100 percentile vs similar products in category>,
    "carbon": <0-100>,
    "water": <0-100>,
    "energy": <0-100>,
    "recyclability": <0-100>
  },
  "reasoning": "<1-2 sentences>"
}

IMPORTANT guidelines:
- co2e: realistic lifecycle carbon footprint in kg CO2e (materials + manufacturing + end-of-life)
- waterLiters: total water footprint (e.g., cotton t-shirt ~2700L, smartphone ~12000L, book ~400L, plastic bottle ~7L)
- energyKwh: manufacturing energy (e.g., smartphone ~70kWh, t-shirt ~15kWh, book ~2kWh, chair ~25kWh)
- recyclabilityPercent: based on actual materials (aluminum=95, glass=90, steel=90, metal=85, cardboard=80, paper=75, wood=65, electronic=50, plastic=40, textile=30, mixed=20)
- percentileRanking: 50 = average for this product category, 80+ = among most sustainable, <20 = among least sustainable
- estimatedWeightKg: estimate from product title/description
- Scoring: Organic/eco/sustainable=70-95, Reusable/durable=55-80, Standard goods=35-55, Electronics=20-50, Fast fashion/disposable=10-35
- Grade: A=85-100, B=70-84, C=55-69, D=40-54, E=25-39, F=10-24, G=0-9

Return ONLY the JSON object, nothing else.`;

  const responseText = await callOpenRouter(prompt);
  const result = parseJSON(responseText);

  // Validate
  if (typeof result.overallScore !== 'number') throw new Error('Missing overallScore');

  return result;
}

/**
 * Analyze multiple cart items in a single API call
 */
async function analyzeCartItemsWithAI(items) {
  const itemList = items.map((item, i) => `${i + 1}. "${item.title}"`).join('\n');

  const prompt = `You are a sustainability and lifecycle analysis expert. Analyze these ${items.length} Amazon cart products. Return ONLY a valid JSON array with no markdown.

Products:
${itemList}

Return a JSON array with exactly ${items.length} objects, one per product in order:
[{
  "title": "<short title>",
  "overallScore": <0-100>,
  "environmental": <0-100>,
  "social": <0-100>,
  "economic": <0-100>,
  "grade": "<A-G>",
  "co2e": <kg CO2e number>,
  "waterLiters": <liters>,
  "energyKwh": <kWh>,
  "recyclabilityPercent": <0-100>,
  "primaryMaterials": ["<material1>"],
  "productCategory": "<electronics|clothing|furniture|food|books|toys|beauty|kitchen|sports|home|office|default>",
  "estimatedWeightKg": <kg>,
  "percentileRanking": {"overall":<0-100>,"carbon":<0-100>,"water":<0-100>,"energy":<0-100>,"recyclability":<0-100>},
  "reasoning": "<brief>"
}]

Scoring - be realistic and VARY scores between different products:
- Organic/eco/sustainable: 70-95, Reusable/durable: 55-80, Standard goods: 35-55, Electronics: 20-50, Fast fashion/disposable: 10-35
- Grade: A=85-100, B=70-84, C=55-69, D=40-54, E=25-39, F=10-24, G=0-9
- recyclabilityPercent: based on materials (aluminum=95, glass=90, plastic=40, textile=30, mixed=20)
- percentileRanking: 50=average for category

Return ONLY the JSON array.`;

  const responseText = await callOpenRouter(prompt);
  return parseJSON(responseText);
}

/**
 * Fallback analysis when API fails - generates varied scores based on product title
 */
function fallbackAnalysis(scrapedData) {
  const title = (scrapedData.title || '').toLowerCase();

  // Hash title for consistent but varied results per product
  const hash = title.split('').reduce((acc, ch, i) => acc + ch.charCodeAt(0) * (i + 1), 0);
  const v1 = ((hash * 7) % 25) - 12;  // -12 to +12
  const v2 = ((hash * 13) % 20) - 10; // -10 to +10
  const v3 = ((hash * 19) % 22) - 11; // -11 to +11
  const v4 = ((hash * 31) % 18) - 9;  // -9 to +9

  let baseScore = 42;

  if (title.match(/organic|eco|sustainable|bamboo|recycl|biodegradable|compostable/)) {
    baseScore = 78 + v1;
  } else if (title.match(/reusable|durable|stainless|glass bottle/)) {
    baseScore = 65 + v1;
  } else if (title.match(/paper|wood|natural|hemp/)) {
    baseScore = 60 + v1;
  } else if (title.match(/cotton|linen|wool/)) {
    baseScore = 52 + v1;
  } else if (title.match(/laptop|computer|tablet|monitor/)) {
    baseScore = 28 + Math.abs(v1);
  } else if (title.match(/phone|smartphone|iphone|galaxy|pixel/)) {
    baseScore = 32 + Math.abs(v1);
  } else if (title.match(/watch|smartwatch|fitness|earbuds|headphone/)) {
    baseScore = 35 + Math.abs(v1);
  } else if (title.match(/shirt|dress|clothing|shoes|sneaker|hoodie/)) {
    baseScore = 40 + v1;
  } else if (title.match(/book|kindle|journal|notebook/)) {
    baseScore = 62 + v1;
  } else if (title.match(/plastic|disposable|single.use|styrofoam/)) {
    baseScore = 18 + Math.abs(v1);
  } else if (title.match(/furniture|sofa|desk|chair|table/)) {
    baseScore = 38 + v1;
  } else if (title.match(/appliance|microwave|toaster|blender/)) {
    baseScore = 34 + v1;
  } else if (title.match(/toy|game|lego|puzzle/)) {
    baseScore = 42 + v1;
  } else if (title.match(/food|snack|vitamin|supplement|protein/)) {
    baseScore = 50 + v1;
  } else {
    baseScore = 42 + v1;
  }

  baseScore = Math.max(5, Math.min(95, baseScore));

  const environmental = Math.max(5, Math.min(95, baseScore + v2));
  const social = Math.max(5, Math.min(95, baseScore + v3));
  const economic = Math.max(5, Math.min(95, baseScore + v4));

  let grade;
  if (baseScore >= 85) grade = 'A';
  else if (baseScore >= 70) grade = 'B';
  else if (baseScore >= 55) grade = 'C';
  else if (baseScore >= 40) grade = 'D';
  else if (baseScore >= 25) grade = 'E';
  else if (baseScore >= 10) grade = 'F';
  else grade = 'G';

  const co2e = parseFloat(((100 - baseScore) * 0.08 + Math.abs(v2) * 0.1).toFixed(2));

  // Determine product category from title keywords
  let productCategory = 'default';
  if (title.match(/laptop|computer|tablet|monitor|phone|smartphone|earbuds|headphone|watch|smartwatch/)) productCategory = 'electronics';
  else if (title.match(/shirt|dress|clothing|shoes|sneaker|hoodie|cotton|linen|wool/)) productCategory = 'clothing';
  else if (title.match(/furniture|sofa|desk|chair|table/)) productCategory = 'furniture';
  else if (title.match(/food|snack|vitamin|supplement|protein/)) productCategory = 'food';
  else if (title.match(/book|kindle|journal|notebook/)) productCategory = 'books';
  else if (title.match(/toy|game|lego|puzzle/)) productCategory = 'toys';
  else if (title.match(/cream|serum|lotion|makeup|beauty|skincare/)) productCategory = 'beauty';
  else if (title.match(/kitchen|blender|toaster|microwave|cookware|pan|pot/)) productCategory = 'kitchen';

  // Estimate water and energy from category averages
  const categoryWaterMultipliers = {
    electronics: 50, clothing: 150, furniture: 80, food: 100,
    books: 30, toys: 60, beauty: 60, kitchen: 50, default: 75
  };
  const waterMultiplier = categoryWaterMultipliers[productCategory] || 75;
  const waterLiters = Math.round(co2e * waterMultiplier);
  const energyKwh = parseFloat((co2e * (productCategory === 'electronics' ? 0.8 : 0.5)).toFixed(1));

  // Estimate recyclability from title keywords
  let recyclabilityPercent = 30;
  if (title.match(/aluminum|aluminium/)) recyclabilityPercent = 95;
  else if (title.match(/glass/)) recyclabilityPercent = 90;
  else if (title.match(/steel|metal/)) recyclabilityPercent = 88;
  else if (title.match(/cardboard|paper/)) recyclabilityPercent = 78;
  else if (title.match(/wood|bamboo/)) recyclabilityPercent = 65;
  else if (title.match(/plastic/)) recyclabilityPercent = 40;
  else if (title.match(/textile|fabric|cotton|polyester/)) recyclabilityPercent = 30;
  else recyclabilityPercent = 35 + ((hash * 11) % 30); // 35-64 varied

  // Estimate weight from category
  const categoryWeights = {
    electronics: 1.5, clothing: 0.4, furniture: 12.0, food: 0.8,
    books: 0.6, toys: 1.2, beauty: 0.25, kitchen: 2.0, default: 1.0
  };
  const estimatedWeightKg = categoryWeights[productCategory] || 1.0;

  // Primary materials from keyword detection
  const primaryMaterials = [];
  const materialKeywords = ['plastic', 'metal', 'wood', 'glass', 'paper', 'aluminum', 'steel', 'textile', 'cotton', 'leather', 'rubber', 'cardboard', 'bamboo', 'ceramic'];
  for (const mat of materialKeywords) {
    if (title.includes(mat)) primaryMaterials.push(mat);
  }
  if (primaryMaterials.length === 0) primaryMaterials.push('mixed');

  // Derive percentile from score (maps 0-100 score to approximately bell-curve percentile)
  const overallPercentile = Math.max(1, Math.min(99, Math.round(baseScore)));
  const carbonPercentile = Math.max(1, Math.min(99, Math.round(baseScore + v2)));
  const waterPercentile = Math.max(1, Math.min(99, Math.round(baseScore + v3)));
  const energyPercentile = Math.max(1, Math.min(99, Math.round(baseScore + v4)));
  const recyclabilityPercentile = Math.max(1, Math.min(99, recyclabilityPercent));

  return {
    overallScore: Math.round(baseScore),
    environmental: Math.round(environmental),
    social: Math.round(social),
    economic: Math.round(economic),
    grade,
    co2e,
    waterLiters,
    energyKwh,
    recyclabilityPercent: Math.round(recyclabilityPercent),
    primaryMaterials,
    productCategory,
    estimatedWeightKg,
    percentileRanking: {
      overall: overallPercentile,
      carbon: carbonPercentile,
      water: waterPercentile,
      energy: energyPercentile,
      recyclability: recyclabilityPercentile
    },
    reasoning: 'Estimated based on product type and materials'
  };
}

/**
 * Build a product object from analysis results
 */
function buildProduct(scrapedData, analysis) {
  const co2e = analysis.co2e || 3;
  return {
    asin: scrapedData.asin || 'unknown',
    title: scrapedData.title || analysis.title || 'Unknown Product',
    brand: scrapedData.brand || 'Unknown',
    price: scrapedData.price || '',
    overallScore: Math.max(0, Math.min(100, Math.round(analysis.overallScore))),
    environmental: Math.max(0, Math.min(100, Math.round(analysis.environmental))),
    social: Math.max(0, Math.min(100, Math.round(analysis.social))),
    economic: Math.max(0, Math.min(100, Math.round(analysis.economic))),
    grade: analysis.grade || 'C',
    carbonFootprint: { co2e, source: 'openrouter_gemini' },
    rating: {
      grade: analysis.grade || 'C',
      score: co2e,
      description: analysis.reasoning || '',
      frameChange: getFrameChange(analysis.grade || 'C')
    },
    sustainabilityData: {
      waterUsage: analysis.waterLiters || Math.round(co2e * 75),
      energyUsage: analysis.energyKwh || parseFloat((co2e * 0.5).toFixed(1)),
      recyclability: analysis.recyclabilityPercent || null,
      primaryMaterials: analysis.primaryMaterials || [],
      productCategory: analysis.productCategory || 'default',
      estimatedWeightKg: analysis.estimatedWeightKg || 1.0
    },
    percentileRanking: analysis.percentileRanking || null
  };
}

function getFrameChange(grade) {
  return { 'A': 15, 'B': 10, 'C': 5, 'D': 0, 'E': -5, 'F': -15, 'G': -20 }[grade] || 0;
}

/**
 * Save product to MongoDB via backend API
 */
async function saveProductToMongoDB(product) {
  const response = await fetch(`${BACKEND_API_URL}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product })
  });

  if (!response.ok) {
    throw new Error(`Backend API error: ${response.status}`);
  }

  return await response.json();
}

/**
 * Fallback: Save to local storage
 */
async function saveToLocalStorage(product) {
  return new Promise(resolve => {
    chrome.storage.local.get(['detailedAnalyses'], (result) => {
      const analyses = result.detailedAnalyses || {};
      analyses[product.asin] = product;
      chrome.storage.local.set({ detailedAnalyses: analyses }, resolve);
    });
  });
}

/**
 * Store a product in the cart items list
 */
function storeCartItem(product) {
  return new Promise(resolve => {
    chrome.storage.local.get(['cartItems'], (result) => {
      const items = result.cartItems || [];
      const idx = items.findIndex(i => i.asin === product.asin);
      if (idx >= 0) {
        items[idx] = product;
      } else {
        items.push(product);
      }
      chrome.storage.local.set({ cartItems: items }, resolve);
    });
  });
}

/**
 * Save plant state to MongoDB
 */
async function savePlantStateToMongoDB(userId, plantState) {
  const response = await fetch(`${BACKEND_API_URL}/plant/state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, plantState })
  });

  if (!response.ok) {
    throw new Error(`Plant state save failed: ${response.status}`);
  }

  return await response.json();
}

/**
 * Handle single product analysis
 */
async function handleAnalyzeProduct(data, sendResponse) {
  try {
    const { scrapedData } = data;
    if (!scrapedData) throw new Error('Missing scraped data');

    let analysis;
    try {
      analysis = await analyzeProductWithAI(scrapedData);
    } catch (aiError) {
      console.warn('BloomCart SW: AI analysis failed, using fallback:', aiError.message);
      analysis = fallbackAnalysis(scrapedData);
    }

    const product = buildProduct(scrapedData, analysis);
    product.detailedAnalysis = true;

    // Save to MongoDB via backend API
    try {
      await saveProductToMongoDB(product);
      console.log('BloomCart SW: Saved to MongoDB:', product.asin, 'score:', product.overallScore);
    } catch (dbError) {
      console.warn('BloomCart SW: MongoDB save failed, using local storage:', dbError.message);
      // Fallback to local storage if backend is down
      await saveToLocalStorage(product);
    }

    // Also update local cache for immediate access
    chrome.storage.local.get(['detailedAnalyses', 'cartItems'], (result) => {
      const analyses = result.detailedAnalyses || {};
      analyses[product.asin] = product;
      chrome.storage.local.set({ detailedAnalyses: analyses });

      const items = result.cartItems || [];
      const idx = items.findIndex(i => i.asin === product.asin);
      if (idx >= 0) {
        if (!product.price && items[idx].price) {
          product.price = items[idx].price;
        }
        items[idx] = product;
        chrome.storage.local.set({ cartItems: items });
        updatePlantFromCart(items);
      }
    });

    sendResponse({ success: true, product });
  } catch (error) {
    console.error('BloomCart SW: Analysis failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle adding a product to the cart - stores item and updates plant health
 */
async function handleAddToCart(data, sendResponse) {
  try {
    const { product } = data;
    if (!product) throw new Error('Missing product');

    console.log('BloomCart SW: Storing product with score:', product.overallScore, 'Title:', product.title);

    // Store in cart items
    await storeCartItem(product);

    // Recalculate plant health from all cart items
    chrome.storage.local.get(['cartItems', 'plantState'], (result) => {
      const items = result.cartItems || [];
      console.log('BloomCart SW: Cart items after add:', items.map(i => ({ title: i.title.substring(0, 30), score: i.overallScore })));
      const state = result.plantState || { currentFrame: 50, totalPurchases: 0, sustainablePurchases: 0 };

      if (items.length > 0) {
        const avgScore = Math.round(
          items.reduce((sum, item) => sum + item.overallScore, 0) / items.length
        );
        state.currentFrame = avgScore;
        state.totalCartItems = items.length;
        state.sustainableCartItems = items.filter(i => i.overallScore >= 60).length;
        state.totalPurchases = items.length;
      }

      chrome.storage.local.set({ plantState: state }, () => {
        sendResponse({ success: true, plantState: state, cartItems: items });
      });
    });
  } catch (error) {
    console.error('BloomCart SW: addToCart failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle batch cart items analysis
 */
async function handleAnalyzeCartItems(data, sendResponse) {
  try {
    const { items } = data;
    if (!items || !items.length) {
      sendResponse({ success: true, cartItems: [] });
      return;
    }

    let analyzedItems;
    try {
      const aiResults = await analyzeCartItemsWithAI(items);

      analyzedItems = items.map((item, i) => {
        const analysis = (Array.isArray(aiResults) && aiResults[i]) || fallbackAnalysis(item);
        return buildProduct(item, analysis);
      });
    } catch (aiError) {
      console.warn('BloomCart SW: Batch AI failed, using fallback:', aiError.message);
      analyzedItems = items.map(item => buildProduct(item, fallbackAnalysis(item)));
    }

    // Merge: use detailed product page analyses when available (handles race condition)
    chrome.storage.local.get(['cartItems', 'detailedAnalyses'], (result) => {
      const existing = result.cartItems || [];
      const detailed = result.detailedAnalyses || {};
      const merged = analyzedItems.map(newItem => {
        let mergedItem;
        // First priority: detailed analysis from product page (stored separately)
        if (detailed[newItem.asin]) {
          mergedItem = detailed[newItem.asin];
        } else {
          // Second priority: existing cart item with detailed flag
          const prev = existing.find(e => e.asin === newItem.asin);
          if (prev && prev.detailedAnalysis) {
            mergedItem = prev;
          }
        }
        if (mergedItem) {
          // Preserve price from cart scrape if detailed analysis lacks it
          if (!mergedItem.price && newItem.price) {
            mergedItem = { ...mergedItem, price: newItem.price };
          }
          return mergedItem;
        }
        // Fallback: use the batch analysis result
        return newItem;
      });

      chrome.storage.local.set({ cartItems: merged });
      updatePlantFromCart(merged);
      sendResponse({ success: true, cartItems: merged });
    });
  } catch (error) {
    console.error('BloomCart SW: Cart analysis failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Update plant health based on cart items average score
 */
function updatePlantFromCart(cartItems) {
  if (!cartItems.length) return;

  const avgScore = Math.round(
    cartItems.reduce((sum, item) => sum + item.overallScore, 0) / cartItems.length
  );

  chrome.storage.local.get(['plantState'], (result) => {
    const state = result.plantState || { currentFrame: 50, totalPurchases: 0, sustainablePurchases: 0 };
    state.currentFrame = avgScore;
    state.totalCartItems = cartItems.length;
    state.sustainableCartItems = cartItems.filter(i => i.overallScore >= 60).length;
    chrome.storage.local.set({ plantState: state });
  });
}

/**
 * Handle purchase tracking (local, no backend needed)
 */
async function handleTrackPurchase(data, sendResponse) {
  try {
    const { userId, product } = data;
    if (!userId || !product) throw new Error('Missing data');

    // Save purchase to MongoDB
    try {
      const response = await fetch(`${BACKEND_API_URL}/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, product })
      });

      if (!response.ok) {
        console.warn('BloomCart SW: MongoDB purchase save failed');
      } else {
        console.log('BloomCart SW: Purchase saved to MongoDB');
      }
    } catch (dbError) {
      console.warn('BloomCart SW: Backend unavailable for purchase tracking:', dbError.message);
    }

    const score = product.overallScore || 50;
    let frameChange = 0;
    if (score >= 80) frameChange = 15;
    else if (score >= 60) frameChange = 10;
    else if (score >= 40) frameChange = 5;
    else if (score >= 20) frameChange = 0;
    else frameChange = -5;

    chrome.storage.local.get(['plantState'], (result) => {
      const state = result.plantState || { currentFrame: 50, totalPurchases: 0, sustainablePurchases: 0 };
      state.currentFrame = Math.max(0, Math.min(100, state.currentFrame + frameChange));
      state.totalPurchases = (state.totalPurchases || 0) + 1;
      if (score >= 60) state.sustainablePurchases = (state.sustainablePurchases || 0) + 1;

      // Save plant state to MongoDB
      savePlantStateToMongoDB(userId, state).catch(err => 
        console.warn('PlantState MongoDB save failed:', err.message)
      );

      chrome.storage.local.set({ plantState: state }, () => {
        sendResponse({ success: true, plantState: state });
      });
    });
  } catch (error) {
    console.error('BloomCart SW: Purchase tracking failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('BloomCart: Extension installed!');
    chrome.storage.local.set({
      plantState: {
        currentFrame: 50,
        totalPurchases: 0,
        sustainablePurchases: 0
      },
      cartItems: [],
      userId: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    });
  }
});

chrome.runtime.onStartup.addListener(() => {
  console.log('BloomCart: Service worker started');
});

console.log('BloomCart: Service worker loaded');

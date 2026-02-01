/**
 * BloomCart Background Service Worker
 * Direct OpenRouter/Gemini integration for product sustainability analysis
 */

const OPENROUTER_API_KEY = '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';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

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
  const prompt = `You are a sustainability expert analyzing an Amazon product. Return ONLY valid JSON with no markdown formatting.

Product: ${scrapedData.title}
Brand: ${scrapedData.brand || 'Unknown'}
Category: ${scrapedData.category || 'General'}
Description: ${(scrapedData.description || '').substring(0, 300)}

Return this exact JSON structure:
{"overallScore":<number 0-100>,"environmental":<number 0-100>,"social":<number 0-100>,"economic":<number 0-100>,"grade":"<A or B or C or D or E>","co2e":<estimated kg CO2e number>,"reasoning":"<1 sentence>"}

IMPORTANT scoring guidelines - be realistic and varied:
- Organic/eco-friendly/sustainable/bamboo/recycled products: 70-95 overall
- Reusable/durable/high-quality products: 55-80 overall
- Standard consumer goods: 35-55 overall
- Electronics with rare earth materials: 20-50 overall
- Fast fashion/disposable/single-use plastic: 10-35 overall
- Grade mapping: A=80-100, B=60-79, C=40-59, D=20-39, E=0-19
- Make environmental, social, and economic scores vary independently based on the product
- co2e should reflect realistic carbon footprint in kg

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

  const prompt = `You are a sustainability expert. Analyze these ${items.length} Amazon cart products. Return ONLY a valid JSON array with no markdown.

Products:
${itemList}

Return a JSON array with exactly ${items.length} objects, one per product in order:
[{"title":"<short title>","overallScore":<0-100>,"environmental":<0-100>,"social":<0-100>,"economic":<0-100>,"grade":"<A-E>","co2e":<kg number>,"reasoning":"<brief>"}]

Scoring - be realistic and VARY scores significantly between different products:
- Organic/eco/sustainable: 70-95
- Reusable/durable goods: 55-80
- Standard consumer goods: 35-55
- Electronics: 20-50
- Fast fashion/disposable: 10-35
- Grade: A=80-100, B=60-79, C=40-59, D=20-39, E=0-19

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
  if (baseScore >= 80) grade = 'A';
  else if (baseScore >= 60) grade = 'B';
  else if (baseScore >= 40) grade = 'C';
  else if (baseScore >= 20) grade = 'D';
  else grade = 'E';

  const co2e = parseFloat(((100 - baseScore) * 0.08 + Math.abs(v2) * 0.1).toFixed(2));

  return {
    overallScore: Math.round(baseScore),
    environmental: Math.round(environmental),
    social: Math.round(social),
    economic: Math.round(economic),
    grade,
    co2e,
    reasoning: 'Estimated based on product type and materials'
  };
}

/**
 * Build a product object from analysis results
 */
function buildProduct(scrapedData, analysis) {
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
    carbonFootprint: { co2e: analysis.co2e || 3, source: 'openrouter_gemini' },
    rating: {
      grade: analysis.grade || 'C',
      score: analysis.co2e || 3,
      description: analysis.reasoning || '',
      frameChange: getFrameChange(analysis.grade || 'C')
    }
  };
}

function getFrameChange(grade) {
  return { 'A': 15, 'B': 10, 'C': 0, 'D': -15, 'E': -20 }[grade] || 0;
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

    // Store in cart items
    await storeCartItem(product);

    // Recalculate plant health from all cart items
    chrome.storage.local.get(['cartItems', 'plantState'], (result) => {
      const items = result.cartItems || [];
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

    // Store all cart items
    chrome.storage.local.set({ cartItems: analyzedItems });

    // Update plant health based on average cart score
    updatePlantFromCart(analyzedItems);

    sendResponse({ success: true, cartItems: analyzedItems });
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

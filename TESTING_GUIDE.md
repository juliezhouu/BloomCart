# BloomCart Testing Guide

## ✅ Fixes Applied

I've fixed several critical issues to make BloomCart work properly:

### 1. **Data Format Mismatch Fixed**
- **Problem**: Frontend expected `overallScore`, `environmental`, `social`, `economic` fields that backend wasn't providing
- **Solution**: Modified backend to calculate and return these scores (0-100 scale) based on carbon footprint and materials

### 2. **Product Schema Updated**
- Added: `brand`, `overallScore`, `environmental`, `social`, `economic` fields
- Now properly stores all sustainability metrics in MongoDB

### 3. **Brand Extraction Added**
- Amazon scraper now extracts product brand information
- Handles multiple brand element selectors on Amazon pages

## 🚀 How to Test

### Step 1: Reload the Extension
1. Open Chrome and go to `chrome://extensions`
2. Find "BloomCart - Sustainable Shopping on Amazon"
3. Click the reload icon (🔄) to apply the code changes

### Step 2: Test on Amazon Product Page
1. Go to any Amazon product page, for example:
   - https://www.amazon.com/dp/B09G9FPHY6 (Echo Dot)
   - https://www.amazon.com/dp/B08N5WRWNW (Fire TV Stick)

2. **What should happen:**
   - Plant icon (🌱 or 🌸) appears in bottom-right corner
   - Green floating tab button (🌱) appears on the right side of the page

3. **Click the green floating tab**
   - Should see "Analyzing sustainability..." loading state
   - Then displays:
     - Product name and brand
     - Sustainability tier (1-5) with badge
     - Your plant/flower visualization
     - Environmental, Social, Economic scores
     - Carbon footprint information

### Step 3: Test Cart Tracking
1. While on a product page with the rating displayed
2. Click "Add to Cart" button on Amazon
3. **What should happen:**
   - Plant health indicator updates (grows or shrinks)
   - Plant emoji may change based on new health level
   - Cart statistics update in the plant health popup

### Step 4: Check Health Indicator
1. Click on the "Cart Health" bar in bottom-right corner
2. **Should display:**
   - Current plant health percentage
   - Total cart items tracked
   - Number of sustainable items
   - Health status (Excellent/Good/Fair/Poor)

## 🔍 Troubleshooting

### "Failed to analyze product" Error

**Check Console Logs:**
1. Open DevTools (F12)
2. Go to Console tab
3. Look for errors mentioning "BloomCart"

**Common Causes:**
- **Backend not running**: The backend server must be running on `localhost:3000`
  ```bash
  cd backend
  npm run dev
  ```

- **API Keys invalid**: Check `backend/.env` file
  - Gemini API Key: Get from https://aistudio.google.com/app/apikey
  - Climatiq API Key: Get from https://www.climatiq.io/

- **CORS issues**: Extension ID in `.env` must match your actual extension ID
  - Find your extension ID at `chrome://extensions`
  - Update `ALLOWED_ORIGINS` in `backend/.env`

### Plant Not Displaying

- **Expected behavior**: Plant shows as emoji (🌱, 🌿, 🌻, 🌸, or 🥀)
- The Lottie animation has been removed, so emojis are the primary visualization
- If you don't see any plant, check browser console for errors

### Backend Connection Issues

**Verify backend is running:**
```bash
ps aux | grep "node.*index.js"
```

**Check backend health:**
```bash
curl http://localhost:3000/health
```

Should return: `{"status":"ok","timestamp":"...","uptime":...}`

**Restart backend if needed:**
```bash
cd backend
npm run dev
```

## 🧪 Test Scenarios

### Test 1: High Sustainability Product
- Search for "organic cotton t-shirt" on Amazon
- Expected: High scores (80+), Tier 4-5, plant grows

### Test 2: Low Sustainability Product
- Search for "disposable plastic bottles" on Amazon
- Expected: Low scores (<40), Tier 1-2, plant health decreases

### Test 3: Multiple Products in Cart
- Add 3-4 different products to cart from their product pages
- Check if cart health percentage reflects average sustainability
- Click health indicator to see stats

## 📊 Understanding the Ratings

### Tier System (1-5)
- **Tier 5** (90-100): Excellent - Low carbon footprint, sustainable materials
- **Tier 4** (75-89): Great - Good sustainability practices
- **Tier 3** (50-74): Good - Average environmental impact
- **Tier 2** (30-49): Fair - High carbon emissions
- **Tier 1** (0-29): Poor - Significant environmental impact

### Score Components
- **Environmental**: Based on carbon footprint and materials (plastic = lower, recyclable = higher)
- **Social**: Correlated with overall sustainability
- **Economic**: Based on product longevity and quality implications

### Plant Health
- **80-100%**: 🌸 Flowering plant (Excellent)
- **60-79%**: 🌻 Sunflower (Great)
- **40-59%**: 🌿 Healthy plant (Good)
- **20-39%**: 🌱 Sprout (Fair)
- **0-19%**: 🥀 Wilted (Poor)

## 🔄 How It Works

1. **Product Page Load**:
   - Extension scrapes Amazon product data (title, brand, category, details)
   - Sends to backend via service worker

2. **Backend Analysis**:
   - Gemini AI cleans and extracts product info (weight, materials, category)
   - Climatiq API calculates carbon footprint
   - If Climatiq fails, Gemini estimates carbon footprint
   - Calculates sustainability rating (A-E) and component scores
   - Stores in MongoDB for caching

3. **Display Results**:
   - Floating tab shows sustainability rating and scores
   - Plant display shows current cart health

4. **Cart Tracking**:
   - Monitors "Add to Cart" button clicks
   - Updates plant health based on product sustainability
   - Tracks statistics (total items, sustainable items)
   - Stores state in Chrome local storage

## 📝 Known Limitations

1. **No Backend Purchase Tracking**: Cart monitoring is local only (Chrome storage)
   - The "Add to Cart & Grow Garden" button in the floating tab is for future enhancement
   - Currently, plant grows/shrinks automatically when you add items to cart

2. **Gemini/Climatiq API Limits**:
   - Free tier has rate limits
   - If quota exceeded, you'll see errors in console
   - Fallback estimates are less accurate

3. **Amazon Page Variations**:
   - Some Amazon pages have different layouts
   - Brand/weight extraction may fail on certain products
   - Fallback values will be used ("Unknown" brand, estimated weight)

4. **MongoDB Optional**:
   - Extension works without MongoDB (no caching)
   - Each analysis will call APIs fresh

## 🎯 Next Steps

After testing, you can:
1. Improve the scoring algorithm in `backend/src/routes/product.js`
2. Add more material types to the sustainability calculation
3. Enhance the plant visualization with custom animations
4. Add user accounts for cross-device synchronization
5. Implement the "purchase confirmation" flow for more accurate tracking

## 💡 Tips

- **First load is slower**: Gemini + Climatiq APIs take 3-5 seconds
- **Subsequent loads are faster**: Products are cached in MongoDB
- **Test with various products**: Electronics, clothing, food, toys - each scores differently
- **Monitor API usage**: Free tiers have limits; consider upgrading for production use

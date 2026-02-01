# BloomCart Quick Start Guide

## ✅ Code Fixes Applied

The following issues have been fixed:
- ✅ Data format mismatch between frontend and backend
- ✅ Product schema updated with sustainability scores
- ✅ Brand extraction added to Amazon scraper
- ✅ Rating calculation now returns all required fields

## 🚀 Quick Start (3 Steps)

### Step 1: Start the Backend Server
```bash
cd backend
npm install  # Only needed first time
npm run dev
```

**Expected output:**
```
🚀 BloomCart backend running on port 3000
Environment: development
Health check: http://localhost:3000/health
```

### Step 2: Load Extension in Chrome
1. Open Chrome and go to `chrome://extensions`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `extension` folder from this project
5. Click reload (🔄) on BloomCart extension to apply code changes

### Step 3: Update CORS Configuration (if needed)
1. Find your Extension ID at `chrome://extensions` (e.g., `efniicinomgamoacfkfknefieabpflpf`)
2. Open `backend/.env` file
3. Update line 20 with your Extension ID:
   ```
   ALLOWED_ORIGINS=chrome-extension://YOUR_EXTENSION_ID_HERE
   ```
4. Save the file - backend will auto-reload

## 🧪 Test It Now!

1. Go to any Amazon product page:
   - Example: https://www.amazon.com/dp/B09G9FPHY6

2. You should see:
   - Plant icon (🌱) in bottom-right corner
   - Green floating tab button on the right side

3. Click the green tab:
   - See product sustainability analysis
   - Tier rating (1-5)
   - Environmental, Social, Economic scores
   - Carbon footprint data

4. Try adding to cart:
   - Click "Add to Cart" on Amazon
   - Watch your plant health change!

## ⚙️ Configuration

### API Keys (Required for Full Functionality)

**Current status:**
- ✅ Gemini API Key: Configured in `.env`
- ✅ Climatiq API Key: Configured in `.env`

**If you need new keys:**

1. **Gemini API** (for product data extraction)
   - Get key: https://aistudio.google.com/app/apikey
   - Update in `backend/.env` line 12

2. **Climatiq API** (for carbon footprint calculation)
   - Get key: https://www.climatiq.io/
   - Update in `backend/.env` line 15

### MongoDB (Optional - for caching)

**Current:** MongoDB Atlas URI is configured

If MongoDB connection fails:
- Extension still works! Products just won't be cached
- Each product will be analyzed fresh each time
- Check logs for connection errors

## 🔧 Troubleshooting

### "Failed to analyze product"
1. **Check backend is running:**
   ```bash
   curl http://localhost:3000/health
   ```
   Should return: `{"status":"ok",...}`

2. **Check API keys:**
   - Open `backend/.env`
   - Ensure `GEMINI_API_KEY` and `CLIMATIQ_API_KEY` are set

3. **Check CORS:**
   - Verify `ALLOWED_ORIGINS` in `.env` matches your extension ID

### Backend not starting
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Extension not loading
1. Go to `chrome://extensions`
2. Click reload (🔄) on BloomCart extension
3. Check for errors in the extension card

## 📚 Full Documentation

- **[TESTING_GUIDE.md](TESTING_GUIDE.md)**: Comprehensive testing instructions
- **Backend API**: See `backend/src/routes/` for endpoint documentation
- **Frontend**: See `extension/content/` for content script logic

## 🎯 How It Works

```
Amazon Product Page
       ↓
   Scrape Data (title, brand, category, details)
       ↓
   Send to Backend
       ↓
   Gemini AI → Clean & Extract (weight, materials)
       ↓
   Climatiq API → Calculate Carbon Footprint
       ↓  (fallback: Gemini Estimate if Climatiq fails)
       ↓
   Calculate Rating (A-E) & Scores (0-100)
       ↓
   Save to MongoDB (cache for future)
       ↓
   Return to Extension
       ↓
   Display in Floating Tab
       ↓
   Track Cart Additions → Update Plant Health
```

## 🌟 Features Working

- ✅ Product sustainability analysis
- ✅ Real-time carbon footprint calculation
- ✅ Tier-based rating system (1-5)
- ✅ Component scores (Environmental, Social, Economic)
- ✅ Plant health visualization
- ✅ Cart tracking with plant growth/decline
- ✅ Floating tab with detailed metrics
- ✅ MongoDB caching (optional)
- ✅ Fallback estimates when APIs fail

## 💡 Known Limitations

- Cart tracking is local (Chrome storage) - not synced to backend yet
- Plant animations use emojis (Lottie removed)
- Some Amazon pages may have different layouts (brand/weight extraction may vary)
- API free tiers have rate limits

## 🚀 Next Steps

After everything works:
1. Review the scoring algorithm in `backend/src/routes/product.js`
2. Test with different product categories
3. Monitor API usage and upgrade if needed
4. Consider implementing user accounts for cross-device sync
5. Enhance plant visualizations

---

**Need help?** Check [TESTING_GUIDE.md](TESTING_GUIDE.md) for detailed troubleshooting.

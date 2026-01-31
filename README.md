# BloomCart 🛒🌸

Turn sustainable shopping into a virtual garden! BloomCart is a Chrome extension that gamifies eco-friendly shopping on Amazon by visualizing your environmental impact through an animated plant that grows or shrinks based on your purchase decisions.

## 🌟 Features

- **Real-time Sustainability Ratings**: Analyze Amazon products with AI-powered carbon footprint calculations
- **Interactive Plant Growth**: Watch your virtual plant grow with sustainable purchases or wilt with high-carbon choices
- **Smart Analysis**: Uses Gemini AI for product data extraction and Climatiq API for accurate carbon calculations
- **Floating Tab Interface**: Clean, unobtrusive UI that shows ratings without disrupting your shopping
- **Purchase Tracking**: MongoDB-backed history of all your purchases and plant progress
- **Grade System**: A-E rating scale based on CO2e per kg ratio

## 📋 Rating System

| Grade | Score (kg CO2e/kg) | Frame Change | Impact |
|-------|-------------------|--------------|---------|
| A | < 2 | +10 | Excellent - Low carbon footprint |
| B | 2-5 | +5 | Good - Below average emissions |
| C | 5-10 | -5 | Average - Moderate carbon impact |
| D | 10-20 | -10 | Poor - High carbon emissions |
| E | > 20 | -15 | Very Poor - Significant environmental impact |

## 🏗️ Architecture

```
BloomCart/
├── backend/              # Node.js Express API server
│   ├── src/
│   │   ├── models/      # MongoDB models
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Gemini AI, Climatiq, Rating logic
│   │   ├── config/      # Database, CORS configuration
│   │   └── index.js     # Server entry point
│   └── .env             # Environment variables (not committed)
│
└── extension/           # Chrome Extension
    ├── background/      # Service worker for API calls
    ├── content/         # Amazon page scraper & UI injector
    ├── popup/           # Extension popup UI
    ├── ui/              # Lottie animation components
    ├── assets/          # Icons and animations
    └── manifest.json    # Extension configuration
```

## 🚀 Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- MongoDB Atlas account (free tier works)
- Gemini API key ([Get it here](https://makersuite.google.com/app/apikey))
- Climatiq API key ([Get it here](https://www.climatiq.io/))
- Google Chrome browser

### 1. Backend Setup

#### Install Dependencies
```bash
cd backend
npm install
```

#### Configure Environment Variables

The `.env` file is already created with your Gemini API key. You need to add:

1. **MongoDB URI**:
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create a free cluster
   - Get your connection string
   - Update `MONGODB_URI` in `backend/.env`

2. **Climatiq API Key**:
   - Sign up at [Climatiq](https://www.climatiq.io/)
   - Get your API key
   - Update `CLIMATIQ_API_KEY` in `backend/.env`

Your `backend/.env` should look like:
```env
PORT=3000
NODE_ENV=development

# MongoDB Atlas - UPDATE THIS
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/bloomcart

# API Keys
GEMINI_API_KEY=AIzaSyBhyQ-AVkl1QbDoWkyAC1rMyuoZqWd2YPw
CLIMATIQ_API_KEY=YOUR_CLIMATIQ_KEY_HERE

# CORS - UPDATE AFTER LOADING EXTENSION
ALLOWED_ORIGINS=chrome-extension://YOUR_EXTENSION_ID_HERE

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

LOG_LEVEL=info
```

#### Start the Backend Server
```bash
npm run dev
```

The server should start at `http://localhost:3000`. Test it by visiting `http://localhost:3000/health`.

### 2. Chrome Extension Setup

#### Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` folder from this project

#### Get Your Extension ID

1. After loading, you'll see the extension card
2. Copy the Extension ID (looks like: `abcdefghijklmnopqrstuvwxyz123456`)
3. Update `backend/.env` with:
   ```env
   ALLOWED_ORIGINS=chrome-extension://YOUR_EXTENSION_ID_HERE
   ```
4. Restart the backend server

#### Add Extension Icons (Optional)

The extension works without icons, but for a better experience:

1. Create or download 3 PNG icons (16x16, 48x48, 128x128 pixels)
2. Place them in `extension/assets/icons/`
3. Name them: `icon16.png`, `icon48.png`, `icon128.png`

Quick option: Visit [Favicon.io](https://favicon.io/favicon-generator/) and use emoji "🌸" or "🌱"

### 3. Database Setup

The backend will automatically create MongoDB collections on first run. No manual setup needed!

Collections created:
- `products` - Cached product ratings
- `plantstates` - User plant states
- `purchases` - Purchase history

## 🎮 How to Use

### First Time Setup

1. Make sure backend server is running (`npm run dev` in backend folder)
2. Extension is loaded in Chrome
3. Visit any Amazon product page

### Shopping Flow

1. **Browse Amazon**: Go to any product page (e.g., https://www.amazon.com/dp/B08N5WRWNW)

2. **See Your Plant**: A plant animation appears in the bottom-right corner

3. **View Rating**: Click the green leaf tab on the right side to see the sustainability rating

4. **Track Purchase**: Click "Track Purchase" to update your plant based on the rating
   - A-rated products: Plant grows! 🌱
   - E-rated products: Plant wilts 😢

5. **Check Progress**: Click the BloomCart extension icon to see your stats and history

### Understanding the Interface

- **Bottom Right Plant**: Shows your current plant health (frame 0-100)
- **Floating Tab**: Displays product rating, CO2e data, and source
- **Extension Popup**: Shows total purchases, sustainable purchases, and recent activity

## 🔧 Development & Testing

### Test the Backend API

```bash
# Health check
curl http://localhost:3000/health

# Analyze a product (requires scraped data)
curl -X POST http://localhost:3000/api/analyze-product \
  -H "Content-Type: application/json" \
  -d '{
    "scrapedData": {
      "asin": "B08N5WRWNW",
      "title": "Stainless Steel Water Bottle",
      "details": {},
      "category": "Kitchen",
      "description": "Reusable water bottle"
    }
  }'
```

### Debug the Extension

1. Open Chrome DevTools on any Amazon page (F12)
2. Check Console for "BloomCart:" logs
3. Go to `chrome://extensions/` and click "Errors" if issues occur
4. Use `chrome.storage.local.get(console.log)` in console to inspect storage

### Common Issues

**Plant not appearing?**
- Check if Lottie library loaded: Look for "Lottie library loaded successfully" in console
- Verify you're on an Amazon product page

**Rating not showing?**
- Check backend is running at `http://localhost:3000`
- Verify CORS is configured with correct extension ID
- Check Network tab in DevTools for failed requests

**"Failed to analyze product"?**
- Check Gemini API key is valid
- Check Climatiq API key is valid
- Ensure MongoDB is connected
- Check backend console for error logs

## 🌐 API Endpoints

### Backend API

**POST** `/api/analyze-product`
- Analyzes product and returns sustainability rating
- Body: `{ scrapedData: {...} }`
- Response: `{ product: {...}, cached: boolean }`

**GET** `/api/product-rating/:asin`
- Retrieves cached product rating
- Response: `{ product: {...} }`

**GET** `/api/plant-state/:userId`
- Gets user's plant state
- Response: `{ plantState: {...} }`

**POST** `/api/plant-state/update`
- Updates plant state after purchase
- Body: `{ userId, rating, frameChange, asin, productTitle, carbonFootprint }`
- Response: `{ plantState: {...} }`

## 🎨 Customization

### Change Rating Thresholds

Edit [backend/src/services/rating.js](backend/src/services/rating.js):

```javascript
if (score < 2) {
  grade = 'A';
  frameChange = 10;  // Change this value
}
```

### Modify Plant Animation

Replace [extension/assets/animations/plant.json](extension/assets/animations/plant.json) with your own Lottie animation:

1. Create animation in After Effects
2. Export using Bodymovin plugin
3. Replace plant.json

Or find free Lottie animations at [LottieFiles](https://lottiefiles.com/)

### Adjust Frame Changes

Edit [extension/utils/config.js](extension/utils/config.js):

```javascript
FRAME_CHANGES: {
  'A': 10,  // Change these values
  'B': 5,
  'C': -5,
  'D': -10,
  'E': -15
}
```

## 📊 Data Flow

```
Amazon Product Page
        ↓
Content Script (amazon-scraper.js)
        ↓
Background Service Worker
        ↓
Backend API (/analyze-product)
        ↓
Gemini AI (clean product data)
        ↓
Climatiq API (calculate CO2e)
        ↓
Rating Service (calculate grade)
        ↓
MongoDB (cache result)
        ↓
Chrome Storage (plant state)
        ↓
Lottie Animation (update plant)
```

## 🔒 Security

- API keys are stored in `.env` and never committed to git
- `.gitignore` configured to exclude all environment files
- CORS restricted to your extension ID only
- Rate limiting enabled (100 requests per 15 minutes)
- Input validation on all API endpoints

## 📝 TODO / Future Enhancements

- [ ] Add user authentication
- [ ] Create leaderboard for most sustainable shoppers
- [ ] Add browser notifications for purchase tracking
- [ ] Support for more e-commerce sites (eBay, Walmart, etc.)
- [ ] Add achievements/badges system
- [ ] Export purchase history as CSV
- [ ] Add carbon offset suggestions
- [ ] Create Chrome Web Store listing

## 🤝 Contributing

This is a personal project, but suggestions are welcome! Feel free to:
- Report bugs via issues
- Suggest features
- Improve documentation

## 📄 License

MIT License - feel free to use this project for learning and development.

## 🙏 Acknowledgments

- **Gemini AI** - Product data extraction
- **Climatiq API** - Carbon footprint calculations
- **Lottie** - Beautiful vector animations
- **MongoDB Atlas** - Database hosting

## 📞 Support

If you encounter issues:

1. Check the [Common Issues](#common-issues) section
2. Review browser console logs
3. Check backend server logs
4. Verify all API keys are correct
5. Ensure MongoDB connection is working

---

**Happy Sustainable Shopping!** 🌱🛒💚

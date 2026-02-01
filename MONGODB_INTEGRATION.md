# MongoDB Integration Guide

## Overview

BloomCart now stores all sustainability data in MongoDB Atlas instead of only using local browser storage. This enables:
- **Persistent data** across devices and browser sessions
- **Centralized analytics** on sustainability trends
- **Product caching** to reduce AI API calls
- **User purchase history** tracking
- **Plant state synchronization**

## Architecture

### Data Flow

```
Amazon Product Page
       ↓
Extension Scraper (content.js)
       ↓
Service Worker (analyzes with OpenRouter/Gemini)
       ↓
Backend API (localhost:3000)
       ↓
MongoDB Atlas (cloud database)
```

### Fallback Strategy

- **Primary**: MongoDB via backend API
- **Fallback**: chrome.storage.local if backend is unavailable
- The extension remains functional even if MongoDB is down

## Database Schema

### Collections

#### 1. **products**
Stores analyzed product sustainability data
```javascript
{
  asin: String (unique),
  title: String,
  brand: String,
  overallScore: Number (0-100),
  environmental: Number (0-100),
  social: Number (0-100),
  economic: Number (0-100),
  grade: String (A-G),
  carbonFootprint: {
    co2e: Number,
    source: String
  },
  sustainabilityData: {
    waterUsage: Number,
    energyUsage: Number,
    recyclability: Number,
    primaryMaterials: [String],
    productCategory: String
  },
  createdAt: Date
}
```

#### 2. **plantstates**
Tracks user's virtual plant health
```javascript
{
  userId: String (unique),
  currentFrame: Number (0-100),
  totalPurchases: Number,
  sustainablePurchases: Number,
  history: [{
    rating: String,
    frameChange: Number,
    timestamp: Date
  }]
}
```

#### 3. **purchases**
Records purchase history
```javascript
{
  userId: String,
  asin: String,
  productTitle: String,
  rating: {
    grade: String,
    score: Number
  },
  carbonFootprint: {
    co2e: Number,
    source: String
  },
  frameChange: Number,
  timestamp: Date
}
```

## API Endpoints

### Products

**POST /api/products**
- Stores analyzed product from extension
- Request: `{ product: { asin, title, overallScore, ... } }`
- Response: `{ product: {...}, updated: boolean }`

**GET /api/product-rating/:asin**
- Retrieves cached product analysis
- Returns 404 if not found

### Plant State

**POST /api/plant/state**
- Saves user's plant state
- Request: `{ userId, plantState: { currentFrame, totalPurchases, ... } }`
- Response: `{ success: true, plantState: {...} }`

**GET /api/plant-state/:userId**
- Retrieves user's plant state

### Purchases

**POST /api/purchases**
- Tracks a purchase event
- Request: `{ userId, product: {...} }`
- Response: `{ success: true, purchase: {...} }`

## Setup Instructions

### 1. MongoDB Atlas Connection

The connection is already configured in `backend/.env`:
```
MONGODB_URI=mongodb+srv://bernicelam912_db_user:UE29RWoXgsJEVF3Y@bloomcart.aqlo4nx.mongodb.net/?appName=BloomCart
```

### 2. Start Backend Server

```bash
cd backend
node src/index.js
```

You should see:
```
✅ MongoDB Atlas connected successfully
🚀 BloomCart backend running on port 3000
```

### 3. Load Extension

The extension will automatically connect to `http://localhost:3000/api`

### 4. Verify Connection

Visit: http://localhost:3000/health

## Code Changes

### Service Worker Updates

**Before**: All data stored in `chrome.storage.local`
```javascript
chrome.storage.local.set({ cartItems: items });
```

**After**: Data saved to MongoDB with fallback
```javascript
await saveProductToMongoDB(product);  // Primary
await saveToLocalStorage(product);    // Fallback
```

### Key Functions

1. **saveProductToMongoDB(product)**
   - POST to `/api/products`
   - Saves analyzed product to database

2. **savePlantStateToMongoDB(userId, state)**
   - POST to `/api/plant/state`
   - Updates user's plant health

3. **handleTrackPurchase()**
   - POST to `/api/purchases`
   - Records purchase in database

## Monitoring

### Check Database Contents

Access MongoDB Atlas dashboard:
1. Go to https://cloud.mongodb.com/
2. Login with credentials
3. Browse Collections → bloomcart database

### View Logs

Backend logs show all database operations:
```
info: Product saved to MongoDB from extension {"asin":"B08N5WRWNW"}
info: Plant state saved from extension {"userId":"user_123","frame":75}
info: Purchase tracked from extension {"userId":"user_123","asin":"B08N5WRWNW"}
```

### Extension Console

Open DevTools → Service Worker console to see:
```
BloomCart SW: Saved to MongoDB: B08N5WRWNW score: 45
BloomCart SW: Purchase saved to MongoDB
```

## Data Analytics

With MongoDB, you can now run queries like:

```javascript
// Find products with low sustainability scores
db.products.find({ overallScore: { $lt: 30 } })

// Count sustainable purchases per user
db.purchases.aggregate([
  { $match: { "rating.grade": { $in: ["A", "B"] } } },
  { $group: { _id: "$userId", count: { $sum: 1 } } }
])

// Average sustainability score by category
db.products.aggregate([
  { $group: {
    _id: "$sustainabilityData.productCategory",
    avgScore: { $avg: "$overallScore" }
  }}
])
```

## Troubleshooting

### Backend won't start
- Check MongoDB URI in `.env`
- Verify network connection
- Check port 3000 is available: `lsof -i :3000`

### Extension can't connect
- Verify backend is running: `curl http://localhost:3000/health`
- Check browser console for CORS errors
- Confirm extension ID in backend `.env` ALLOWED_ORIGINS

### Data not saving
- Check backend logs for errors
- Verify MongoDB Atlas IP whitelist (should allow all: 0.0.0.0/0)
- Extension will fallback to local storage automatically

## Performance

- **Product caching**: Subsequent visits to same product are instant (no re-analysis)
- **Batch operations**: Cart analysis optimized with single API call
- **Concurrent requests**: MongoDB connection pool handles multiple users
- **Fallback resilience**: Extension works offline with local storage

## Security

- API key stored server-side (not in extension code)
- CORS restricted to specific extension ID
- Rate limiting: 100 requests per 15 minutes per IP
- MongoDB credentials not exposed to client

## Future Enhancements

- [ ] User authentication with OAuth
- [ ] Real-time leaderboards
- [ ] Historical trend analysis dashboard
- [ ] Export purchase history as CSV
- [ ] Social sharing features
- [ ] Multi-device plant synchronization

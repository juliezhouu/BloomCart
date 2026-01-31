# API Keys Setup Guide

## 1. Gemini API Key Setup

### Get Your Gemini API Key:
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API key"
4. Copy the generated API key

### Update Your Environment:
1. Open `/backend/.env`
2. Replace `YOUR_NEW_GEMINI_API_KEY_HERE` with your actual API key:
   ```
   GEMINI_API_KEY=AIzaSy...your_actual_key_here
   ```

## 2. Climatiq API Key Setup (Optional)

### Get Your Climatiq API Key:
1. Visit [Climatiq.io](https://www.climatiq.io/)
2. Sign up for a free account
3. Go to your dashboard to get your API key

### Update Your Environment:
1. Open `/backend/.env`
2. Update the Climatiq API key:
   ```
   CLIMATIQ_API_KEY=your_climatiq_key_here
   ```

## 3. Restart the Server

After updating the API keys:
```bash
cd backend
npm start
```

## Testing

Test the API with:
```bash
curl -X POST http://localhost:3000/api/analyze-product \
  -H "Content-Type: application/json" \
  -d '{
    "scrapedData": {
      "title": "Apple iPhone 15 Pro",
      "asin": "B0CHX1W5Y7",
      "category": "Electronics",
      "price": "$999.99"
    }
  }'
```

## Current Status

✅ **Backend server is running**
✅ **Gemini integration is configured with fallback**
✅ **Extension can communicate with backend**
⚠️ **API keys need to be updated with valid credentials**

The system will work with fallback logic even without API keys, but for best results, configure both Gemini and Climatiq API keys.
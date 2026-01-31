# BloomCart Quick Start Guide 🚀

Get BloomCart running in under 10 minutes!

## Step 1: Set Up MongoDB (5 minutes)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up for a free account
3. Create a free cluster (M0)
4. Click "Connect" → "Connect your application"
5. Copy the connection string
6. Open `backend/.env` and replace:
   ```env
   MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/bloomcart
   ```
   with your connection string

## Step 2: Get Climatiq API Key (2 minutes)

1. Go to [Climatiq](https://www.climatiq.io/)
2. Sign up for a free account
3. Go to API Keys section
4. Copy your API key
5. Open `backend/.env` and replace:
   ```env
   CLIMATIQ_API_KEY=YOUR_CLIMATIQ_KEY_HERE
   ```
   with your API key

Your Gemini API key is already configured!

## Step 3: Start the Backend (1 minute)

```bash
cd backend
npm run dev
```

You should see:
```
🚀 BloomCart backend running on port 3000
✅ MongoDB Atlas connected successfully
```

## Step 4: Load Chrome Extension (2 minutes)

1. Open Chrome
2. Go to `chrome://extensions/`
3. Turn on "Developer mode" (top right toggle)
4. Click "Load unpacked"
5. Select the `extension` folder from this project
6. Copy the Extension ID (under the extension name)
7. Update `backend/.env`:
   ```env
   ALLOWED_ORIGINS=chrome-extension://YOUR_EXTENSION_ID_HERE
   ```
8. Restart the backend server (Ctrl+C, then `npm run dev` again)

## Step 5: Test It! (2 minutes)

1. Go to any Amazon product page, for example:
   - https://www.amazon.com/dp/B08N5WRWNW
2. You should see:
   - A plant animation in the bottom-right corner 🌱
   - A green leaf tab on the right edge
3. Click the leaf tab to see the product rating
4. Click "Track Purchase" to update your plant
5. Click the BloomCart extension icon to see your stats

## Troubleshooting

### Backend won't start?
- Make sure MongoDB URI is correct
- Check all API keys are set
- Run `npm install` in the backend folder

### Extension not working?
- Check backend is running at http://localhost:3000
- Verify CORS is set with your extension ID
- Open DevTools (F12) and check Console for errors

### No rating showing?
- Wait a few seconds for analysis to complete
- Check Network tab in DevTools for failed requests
- Verify you're on an Amazon product page

### Plant not animating?
- The placeholder animation is simple
- You can replace `extension/assets/animations/plant.json` with a better one from [LottieFiles](https://lottiefiles.com/)

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Customize the rating thresholds in `backend/src/services/rating.js`
- Replace the plant animation with your own design
- Add extension icons for a polished look

## Need Help?

Check these files:
- `README.md` - Full documentation
- `backend/src/` - Backend code
- `extension/` - Extension code

Happy sustainable shopping! 🌿

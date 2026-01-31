# BloomCart Deployment Guide

This guide covers deploying BloomCart to production.

## Production Checklist

Before deploying, ensure you have:

- [ ] Valid MongoDB Atlas connection
- [ ] Gemini API key with sufficient quota
- [ ] Climatiq API key with appropriate plan
- [ ] Domain name (for backend API)
- [ ] Chrome Web Store developer account ($5 one-time fee)

---

## Backend Deployment

### Option 1: Heroku (Recommended for beginners)

1. **Create Heroku account** at [heroku.com](https://www.heroku.com/)

2. **Install Heroku CLI**
   ```bash
   brew install heroku/brew/heroku  # macOS
   # or download from https://devcenter.heroku.com/articles/heroku-cli
   ```

3. **Login to Heroku**
   ```bash
   heroku login
   ```

4. **Create Heroku app**
   ```bash
   cd backend
   heroku create bloomcart-api
   ```

5. **Set environment variables**
   ```bash
   heroku config:set MONGODB_URI="your_mongodb_uri"
   heroku config:set GEMINI_API_KEY="your_gemini_key"
   heroku config:set CLIMATIQ_API_KEY="your_climatiq_key"
   heroku config:set NODE_ENV="production"
   heroku config:set ALLOWED_ORIGINS="chrome-extension://YOUR_EXTENSION_ID"
   ```

6. **Deploy**
   ```bash
   git init
   git add .
   git commit -m "Initial deployment"
   heroku git:remote -a bloomcart-api
   git push heroku main
   ```

7. **Verify deployment**
   ```bash
   heroku open /health
   ```

Your API will be at: `https://bloomcart-api.herokuapp.com`

### Option 2: Railway

1. Go to [railway.app](https://railway.app/)
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your BloomCart repository
5. Set root directory to `backend`
6. Add environment variables in Settings
7. Deploy!

### Option 3: Render

1. Go to [render.com](https://render.com/)
2. Create a new Web Service
3. Connect your GitHub repository
4. Set root directory to `backend`
5. Build command: `npm install`
6. Start command: `npm start`
7. Add environment variables
8. Deploy!

### Option 4: DigitalOcean App Platform

1. Go to [DigitalOcean](https://www.digitalocean.com/)
2. Create new App
3. Connect GitHub repository
4. Configure service:
   - Source directory: `backend`
   - Build command: `npm install`
   - Run command: `npm start`
5. Add environment variables
6. Deploy!

---

## Extension Deployment

### Prepare for Chrome Web Store

1. **Update manifest version**
   ```json
   {
     "version": "1.0.0"
   }
   ```

2. **Update API URL in extension**
   Edit `extension/background/service-worker.js`:
   ```javascript
   const API_BASE_URL = 'https://your-api-domain.com/api';
   ```

3. **Create extension icons**
   - Required sizes: 16x16, 48x48, 128x128 pixels
   - Place in `extension/assets/icons/`
   - Use high-quality PNGs

4. **Add screenshots for store listing**
   - Create 1280x800 or 640x400 screenshots
   - Show key features (plant, rating tab, popup)

5. **Write store description**
   - Focus on benefits: sustainability, gamification, easy to use
   - Include keywords: sustainable shopping, carbon footprint, eco-friendly

6. **Create promotional images**
   - Small tile: 440x280
   - Large tile: 920x680
   - Marquee: 1400x560

### Package Extension

1. **Remove development files**
   ```bash
   cd extension
   rm -rf .DS_Store
   ```

2. **Create ZIP file**
   ```bash
   zip -r bloomcart-extension.zip . -x "*.git*" -x "node_modules/*"
   ```

### Submit to Chrome Web Store

1. **Create Developer Account**
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Pay $5 one-time registration fee

2. **Upload Extension**
   - Click "New Item"
   - Upload `bloomcart-extension.zip`

3. **Fill Store Listing**
   - **Name:** BloomCart - Sustainable Shopping on Amazon
   - **Summary:** Turn sustainable shopping into a virtual garden
   - **Description:** (Use full description from README.md)
   - **Category:** Shopping
   - **Language:** English

4. **Upload Assets**
   - Extension icon
   - Screenshots (at least 1, recommended 3-5)
   - Promotional tiles

5. **Privacy Policy**
   - Required if you collect user data
   - Host on GitHub Pages or your website

6. **Submit for Review**
   - Review can take 1-3 days
   - Address any feedback from Google

---

## Update Backend CORS for Production

After extension is published, update backend:

```env
ALLOWED_ORIGINS=chrome-extension://PUBLISHED_EXTENSION_ID
```

You can support multiple extension IDs:
```javascript
// backend/src/config/cors.js
const allowedOrigins = [
  'chrome-extension://DEV_EXTENSION_ID',
  'chrome-extension://PROD_EXTENSION_ID'
];
```

---

## Environment Variables for Production

### Backend (.env.production)

```env
# Server
PORT=3000
NODE_ENV=production

# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/bloomcart

# API Keys
GEMINI_API_KEY=your_production_gemini_key
CLIMATIQ_API_KEY=your_production_climatiq_key

# CORS
ALLOWED_ORIGINS=chrome-extension://PUBLISHED_EXTENSION_ID

# Rate Limiting (stricter for production)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=50

# Logging
LOG_LEVEL=error
```

---

## Monitoring & Analytics

### Backend Monitoring

**Option 1: LogTail (Recommended)**
```bash
npm install @logtail/node @logtail/winston
```

**Option 2: Sentry**
```bash
npm install @sentry/node
```

**Option 3: New Relic**
- Sign up at [newrelic.com](https://newrelic.com/)
- Add APM agent to backend

### Extension Analytics

**Chrome Extension Analytics:**
1. Use Google Analytics for Chrome Extensions
2. Track:
   - Extension installations
   - Product ratings viewed
   - Purchases tracked
   - Plant health distribution

---

## Security Best Practices

### Backend Security

1. **Use HTTPS only**
   - Most hosting providers provide free SSL

2. **Rate limiting**
   - Already implemented
   - Consider lowering limits for production

3. **Input validation**
   - Already implemented with Mongoose schemas
   - Add additional validation if needed

4. **API key rotation**
   - Rotate Gemini and Climatiq keys regularly
   - Store in environment variables, never in code

5. **MongoDB security**
   - Use MongoDB Atlas IP whitelist
   - Enable database authentication
   - Use strong passwords

### Extension Security

1. **Content Security Policy**
   - Already configured in manifest.json

2. **Permissions**
   - Only request necessary permissions
   - Current permissions are minimal

3. **Secure communication**
   - Only communicate with your API domain
   - Use HTTPS for all API calls

---

## Scaling Considerations

### Backend Scaling

**Database:**
- MongoDB Atlas auto-scales
- Consider dedicated cluster for high traffic
- Add database indexes (already configured)

**API Server:**
- Most platforms auto-scale
- Consider caching layer (Redis) for frequently accessed products
- Use MongoDB TTL indexes for cache invalidation

**External APIs:**
- Monitor Gemini and Climatiq quotas
- Implement caching to reduce API calls
- Consider fallback to Gemini estimates more often

### Extension Scaling

**Chrome Storage:**
- Limit: 5MB for local storage
- Only store essential data
- Clear old history entries

**Performance:**
- Lazy load Lottie animations
- Cache product ratings
- Debounce API calls

---

## Cost Estimation (Monthly)

### Free Tier (Development)
- MongoDB Atlas: Free (M0 cluster)
- Heroku: Free (with limits)
- Gemini API: Free quota (limited)
- Climatiq API: Free tier (limited)
- **Total: $0**

### Low Traffic (~1000 users)
- MongoDB Atlas: $9/month (M2 cluster)
- Heroku: $7/month (Hobby dyno)
- Gemini API: ~$5/month
- Climatiq API: ~$10/month
- **Total: ~$31/month**

### Medium Traffic (~10,000 users)
- MongoDB Atlas: $57/month (M10 cluster)
- DigitalOcean: $12/month (App Platform)
- Gemini API: ~$50/month
- Climatiq API: ~$100/month
- **Total: ~$219/month**

---

## Maintenance

### Weekly Tasks
- Check error logs
- Monitor API quotas
- Review user feedback

### Monthly Tasks
- Update dependencies
- Review analytics
- Optimize slow queries
- Check for Chrome extension policy updates

### Quarterly Tasks
- Audit security
- Review API costs
- Consider new features
- Update documentation

---

## Rollback Plan

If deployment fails:

1. **Backend rollback:**
   ```bash
   heroku releases:rollback
   ```

2. **Extension rollback:**
   - Upload previous version to Chrome Web Store
   - Mark new version as disabled

3. **Database rollback:**
   - Restore from MongoDB Atlas backup
   - Backups are automatic in Atlas

---

## Support After Launch

### User Support Channels
- GitHub Issues
- Chrome Web Store reviews
- Support email
- FAQ page

### Common User Issues
1. Extension not loading → Check Chrome version
2. No ratings showing → Check backend status
3. Plant not animating → Clear extension cache

---

## Success Metrics

Track these KPIs:

- **User Engagement:**
  - Daily active users
  - Products rated per user
  - Purchases tracked

- **Technical:**
  - API response time
  - Error rate
  - API quota usage

- **Business:**
  - User retention (7-day, 30-day)
  - Average plant health
  - Sustainable vs unsustainable purchases ratio

---

## Next Steps After Deployment

1. Gather user feedback
2. Add requested features
3. Optimize performance
4. Expand to other shopping sites
5. Build community around sustainable shopping

Good luck with your deployment! 🚀🌱

# BloomCart

Chrome extension that analyzes Amazon products using Gemini API (web scraping) and Climatiq's carbon data (along with water usage, recyclability, and other environmental databases), providing A-E sustainability ratings while visualizing your environmental impact through an animated plant that grows with eco-friendly choices and wilts with unsustainable items added to your cart. Features MongoDB-backed purchase tracking and a clean floating tab UI.

## 📋 Rating System

| Grade | Score (kg CO2e/kg) | Frame Change | Impact |
|-------|-------------------|--------------|---------|
| A | < 2 | +10 | Excellent - Low carbon footprint |
| B | 2-5 | +5 | Good - Below average emissions |
| C | 5-10 | -5 | Average - Moderate carbon impact |
| D | 10-20 | -10 | Poor - High carbon emissions |
| E | > 20 | -15 | Very Poor - Significant environmental impact |


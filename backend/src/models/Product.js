import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  asin: {
    type: String,
    required: true,
    unique: true,
    index: true,
    uppercase: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  brand: {
    type: String,
    trim: true,
    default: 'Unknown'
  },
  weight: {
    value: { type: Number, required: true },
    unit: { type: String, enum: ['kg', 'g', 'lb', 'oz'], default: 'kg' }
  },
  materials: [{
    type: String,
    trim: true
  }],
  category: {
    type: String,
    trim: true
  },
  // Overall sustainability score (0-100)
  overallScore: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  // Component scores (0-100)
  environmental: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  social: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  economic: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  carbonFootprint: {
    co2e: { type: Number, required: true }, // in kg CO2e
    dataQuality: { type: Number, min: 1, max: 3 }, // Climatiq quality rating
    source: { type: String, enum: ['climatiq', 'gemini_estimate'], required: true },
    suggestionId: String, // Climatiq suggestion ID
    calculatedAt: { type: Date, default: Date.now }
  },
  rating: {
    grade: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'E'],
      required: true
    },
    score: { type: Number, required: true }, // CO2e per kg
    description: String,
    frameChange: Number // Frame progression for plant animation
  },
  metadata: {
    scrapedData: mongoose.Schema.Types.Mixed, // Raw scraped data
    lastUpdated: { type: Date, default: Date.now },
    analysisVersion: { type: String, default: '1.0' }
  }
}, {
  timestamps: true
});

// Index for efficient lookups
productSchema.index({ 'rating.grade': 1 });
productSchema.index({ createdAt: -1 });

// Virtual for rating color
productSchema.virtual('ratingColor').get(function() {
  const colors = { A: '#00C851', B: '#7CB342', C: '#FFD600', D: '#FF9800', E: '#F44336' };
  return colors[this.rating.grade];
});

export default mongoose.model('Product', productSchema);

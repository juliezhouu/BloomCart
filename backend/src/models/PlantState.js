import mongoose from 'mongoose';

const plantStateSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  currentFrame: {
    type: Number,
    default: 0,
    min: 0,
    max: 100 // Adjust based on your Lottie animation frames
  },
  totalPurchases: {
    type: Number,
    default: 0
  },
  sustainablePurchases: {
    type: Number,
    default: 0
  },
  stats: {
    totalCO2eSaved: { type: Number, default: 0 },
    averageRating: { type: String, default: null },
    streakDays: { type: Number, default: 0 }
  },
  history: [{
    rating: String,
    frameChange: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Update lastUpdated on save
plantStateSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

export default mongoose.model('PlantState', plantStateSchema);

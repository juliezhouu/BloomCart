import mongoose from 'mongoose';

const purchaseSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  asin: {
    type: String,
    required: true,
    uppercase: true
  },
  productTitle: {
    type: String,
    required: true
  },
  rating: {
    grade: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'E'],
      required: true
    },
    score: Number
  },
  carbonFootprint: {
    co2e: Number,
    source: String
  },
  frameChange: {
    type: Number,
    required: true
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
purchaseSchema.index({ userId: 1, purchaseDate: -1 });
purchaseSchema.index({ 'rating.grade': 1 });

export default mongoose.model('Purchase', purchaseSchema);

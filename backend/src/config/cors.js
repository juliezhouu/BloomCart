import cors from 'cors';

// Critical: Chrome extensions use chrome-extension:// protocol
// You'll need to update this with your actual extension ID after creating it
export const corsOptions = {
  origin: function (origin, callback) {
    console.log('CORS request from origin:', origin);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if origin matches chrome-extension:// pattern
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }

    // For development, allow localhost and null origins
    if (process.env.NODE_ENV === 'development') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

export default cors(corsOptions);

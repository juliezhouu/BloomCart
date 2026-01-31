# BloomCart API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication
No authentication required for local development. For production, consider adding API keys or JWT tokens.

---

## Endpoints

### 1. Analyze Product

Analyzes an Amazon product and returns a sustainability rating.

**Endpoint:** `POST /api/analyze-product`

**Request Body:**
```json
{
  "scrapedData": {
    "asin": "B08N5WRWNW",
    "title": "Stainless Steel Water Bottle",
    "details": {
      "Item Weight": "1.2 pounds",
      "Product Dimensions": "10 x 3 x 3 inches"
    },
    "category": "Kitchen & Dining",
    "description": "Reusable stainless steel water bottle...",
    "url": "https://www.amazon.com/dp/B08N5WRWNW"
  }
}
```

**Response (Success):**
```json
{
  "product": {
    "asin": "B08N5WRWNW",
    "title": "Stainless Steel Water Bottle",
    "weight": {
      "value": 0.544,
      "unit": "kg"
    },
    "materials": ["stainless steel", "plastic"],
    "category": "Kitchen & Dining",
    "carbonFootprint": {
      "co2e": 2.5,
      "dataQuality": 1.2,
      "source": "climatiq",
      "suggestionId": "suggest_abc123"
    },
    "rating": {
      "grade": "B",
      "score": 4.59,
      "description": "Good - Below average emissions",
      "frameChange": 5
    }
  },
  "cached": false
}
```

**Response (Cached):**
```json
{
  "product": { ... },
  "cached": true
}
```

**Error Responses:**
- `400` - Missing required data
- `500` - Server error

---

### 2. Get Product Rating (Cached)

Retrieves a cached product rating by ASIN.

**Endpoint:** `GET /api/product-rating/:asin`

**Parameters:**
- `asin` (path) - Amazon Standard Identification Number

**Example:**
```
GET /api/product-rating/B08N5WRWNW
```

**Response:**
```json
{
  "product": {
    "asin": "B08N5WRWNW",
    "title": "Stainless Steel Water Bottle",
    "rating": {
      "grade": "B",
      "score": 4.59,
      "description": "Good - Below average emissions",
      "frameChange": 5
    },
    "carbonFootprint": {
      "co2e": 2.5,
      "dataQuality": 1.2,
      "source": "climatiq"
    }
  }
}
```

**Error Responses:**
- `404` - Product not found
- `500` - Server error

---

### 3. Get Plant State

Retrieves a user's plant state.

**Endpoint:** `GET /api/plant-state/:userId`

**Parameters:**
- `userId` (path) - Unique user identifier

**Example:**
```
GET /api/plant-state/user_1234567890_abc123
```

**Response:**
```json
{
  "plantState": {
    "userId": "user_1234567890_abc123",
    "currentFrame": 45,
    "totalPurchases": 12,
    "sustainablePurchases": 8,
    "stats": {
      "totalCO2eSaved": 15.3,
      "averageRating": "B",
      "streakDays": 5
    },
    "history": [
      {
        "rating": "A",
        "frameChange": 10,
        "timestamp": "2026-01-31T10:30:00.000Z"
      }
    ]
  }
}
```

**Notes:**
- Creates a new plant state if user doesn't exist
- Initial state: `currentFrame: 0, totalPurchases: 0, sustainablePurchases: 0`

---

### 4. Update Plant State

Updates plant state after a purchase is tracked.

**Endpoint:** `POST /api/plant-state/update`

**Request Body:**
```json
{
  "userId": "user_1234567890_abc123",
  "rating": "B",
  "frameChange": 5,
  "ratingScore": 4.59,
  "asin": "B08N5WRWNW",
  "productTitle": "Stainless Steel Water Bottle",
  "carbonFootprint": {
    "co2e": 2.5,
    "dataQuality": 1.2,
    "source": "climatiq"
  }
}
```

**Response:**
```json
{
  "plantState": {
    "userId": "user_1234567890_abc123",
    "currentFrame": 50,
    "totalPurchases": 13,
    "sustainablePurchases": 9,
    "history": [
      {
        "rating": "B",
        "frameChange": 5,
        "timestamp": "2026-01-31T10:45:00.000Z"
      }
    ]
  }
}
```

**Notes:**
- Frame is bounded between 0-100
- Sustainable purchases = A or B ratings
- Creates purchase record in database
- Updates plant state history

---

## Data Models

### Product Model
```typescript
{
  asin: string;           // Unique product identifier
  title: string;          // Product name
  weight: {
    value: number;
    unit: 'kg' | 'g' | 'lb' | 'oz';
  };
  materials: string[];    // Extracted materials
  category: string;       // Product category
  carbonFootprint: {
    co2e: number;         // kg CO2 equivalent
    dataQuality: number;  // 1-3 (Climatiq quality rating)
    source: 'climatiq' | 'gemini_estimate';
    suggestionId?: string;
  };
  rating: {
    grade: 'A' | 'B' | 'C' | 'D' | 'E';
    score: number;        // CO2e per kg
    description: string;
    frameChange: number;  // -15 to +10
  };
}
```

### PlantState Model
```typescript
{
  userId: string;
  currentFrame: number;        // 0-100
  totalPurchases: number;
  sustainablePurchases: number; // A or B ratings
  stats: {
    totalCO2eSaved: number;
    averageRating: string;
    streakDays: number;
  };
  history: Array<{
    rating: string;
    frameChange: number;
    timestamp: Date;
  }>;
}
```

### Purchase Model
```typescript
{
  userId: string;
  asin: string;
  productTitle: string;
  rating: {
    grade: string;
    score: number;
  };
  carbonFootprint: {
    co2e: number;
    source: string;
  };
  frameChange: number;
  timestamp: Date;
}
```

---

## Rating Algorithm

**Formula:** `score = co2e / weightInKg`

**Thresholds:**
| Grade | Score Range | Frame Change | Description |
|-------|-------------|--------------|-------------|
| A | < 2 | +10 | Excellent |
| B | 2-5 | +5 | Good |
| C | 5-10 | -5 | Average |
| D | 10-20 | -10 | Poor |
| E | > 20 | -15 | Very Poor |

---

## External APIs Used

### Gemini AI
**Purpose:** Clean and structure product data

**Model:** `gemini-2.0-flash-exp`

**Input:** Raw Amazon scraped data

**Output:** Structured JSON with:
- Cleaned title
- Extracted weight (converted to kg)
- Materials list
- Product category
- Description for carbon analysis

### Climatiq API
**Purpose:** Calculate carbon footprint

**Endpoints Used:**
1. `POST /autopilot/v1-preview4/suggest` - Get emission factor suggestions
2. `POST /autopilot/v1-preview4/estimate` - Calculate CO2e based on suggestion

**Fallback:** Gemini AI estimates CO2e if Climatiq fails or returns low-quality data (quality > 2.5)

---

## Error Handling

All endpoints return standardized error responses:

```json
{
  "error": "Error message here",
  "details": "Additional error details (if available)"
}
```

**Common Errors:**
- `400` - Bad Request (missing or invalid data)
- `404` - Not Found (product or user not found)
- `500` - Internal Server Error (API failures, database errors)

---

## Rate Limiting

- **Window:** 15 minutes (900,000 ms)
- **Max Requests:** 100 per IP
- **Applies to:** All `/api/*` endpoints

**Rate Limit Response:**
```json
{
  "message": "Too many requests from this IP, please try again later."
}
```

---

## Health Check

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-31T10:00:00.000Z",
  "uptime": 12345.67
}
```

---

## Chrome Extension Integration

The extension communicates with the API through the background service worker:

1. Content script scrapes Amazon product page
2. Sends message to background service worker
3. Background worker makes API request
4. Response sent back to content script
5. UI updated with rating and plant animation

**Message Flow:**
```
Content Script → Background Worker → Backend API
                                          ↓
Chrome Storage ← Background Worker ← MongoDB
```

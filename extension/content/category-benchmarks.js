/**
 * BloomCart Category Benchmarks & Sustainability Data
 * Provides: category benchmarks, material recyclability lookup,
 * percentile calculations, real-world equivalents, SVG icons
 */

// ============================================================
// Category-based sustainability benchmarks (for percentile math)
// ============================================================
const CATEGORY_BENCHMARKS = {
  electronics: {
    avgCo2e: 50, avgWater: 12000, avgEnergy: 70,
    avgRecyclability: 50, avgWeightKg: 2.0,
    stdDevCo2e: 30, stdDevWater: 6000, stdDevEnergy: 40
  },
  clothing: {
    avgCo2e: 15, avgWater: 2700, avgEnergy: 15,
    avgRecyclability: 30, avgWeightKg: 0.5,
    stdDevCo2e: 10, stdDevWater: 1500, stdDevEnergy: 10
  },
  furniture: {
    avgCo2e: 100, avgWater: 8000, avgEnergy: 40,
    avgRecyclability: 65, avgWeightKg: 15.0,
    stdDevCo2e: 50, stdDevWater: 4000, stdDevEnergy: 25
  },
  food: {
    avgCo2e: 5, avgWater: 1000, avgEnergy: 3,
    avgRecyclability: 75, avgWeightKg: 1.0,
    stdDevCo2e: 4, stdDevWater: 800, stdDevEnergy: 2.5
  },
  books: {
    avgCo2e: 2, avgWater: 400, avgEnergy: 2,
    avgRecyclability: 75, avgWeightKg: 0.8,
    stdDevCo2e: 1.5, stdDevWater: 250, stdDevEnergy: 1.5
  },
  toys: {
    avgCo2e: 10, avgWater: 3000, avgEnergy: 8,
    avgRecyclability: 40, avgWeightKg: 1.5,
    stdDevCo2e: 7, stdDevWater: 2000, stdDevEnergy: 5
  },
  beauty: {
    avgCo2e: 8, avgWater: 2000, avgEnergy: 5,
    avgRecyclability: 40, avgWeightKg: 0.3,
    stdDevCo2e: 5, stdDevWater: 1200, stdDevEnergy: 3
  },
  kitchen: {
    avgCo2e: 25, avgWater: 5000, avgEnergy: 20,
    avgRecyclability: 70, avgWeightKg: 2.0,
    stdDevCo2e: 15, stdDevWater: 3000, stdDevEnergy: 12
  },
  sports: {
    avgCo2e: 18, avgWater: 3500, avgEnergy: 12,
    avgRecyclability: 35, avgWeightKg: 1.5,
    stdDevCo2e: 12, stdDevWater: 2000, stdDevEnergy: 8
  },
  home: {
    avgCo2e: 20, avgWater: 4000, avgEnergy: 15,
    avgRecyclability: 55, avgWeightKg: 2.5,
    stdDevCo2e: 14, stdDevWater: 2500, stdDevEnergy: 10
  },
  office: {
    avgCo2e: 15, avgWater: 2500, avgEnergy: 10,
    avgRecyclability: 60, avgWeightKg: 1.0,
    stdDevCo2e: 10, stdDevWater: 1500, stdDevEnergy: 7
  },
  default: {
    avgCo2e: 20, avgWater: 3000, avgEnergy: 10,
    avgRecyclability: 50, avgWeightKg: 1.0,
    stdDevCo2e: 12, stdDevWater: 2000, stdDevEnergy: 7
  }
};

// ============================================================
// Material recyclability scores (0-100)
// ============================================================
const MATERIAL_RECYCLABILITY = {
  aluminum: 95,
  steel: 90,
  glass: 90,
  metal: 85,
  cardboard: 80,
  paper: 75,
  wood: 65,
  electronic: 50,
  ceramic: 45,
  plastic: 40,
  rubber: 35,
  textile: 30,
  leather: 25,
  mixed: 20,
  composite: 15
};

// ============================================================
// Real-world equivalents for contextual display
// ============================================================
const REAL_WORLD_EQUIVALENTS = {
  co2e: {
    drivingKmPerKg: 4.0,
    treeDaysPerKg: 0.045,
    smartphoneChargesPerKg: 122
  },
  water: {
    showersPerLiter: 1 / 60,
    drinkingDaysPerLiter: 1 / 2
  },
  energy: {
    phoneChargesPerKwh: 33,
    ledBulbHoursPerKwh: 100
  }
};

// ============================================================
// Percentile calculation (normal distribution CDF)
// ============================================================
function calculatePercentile(value, mean, stdDev) {
  if (stdDev === 0) return 50;
  const z = (value - mean) / stdDev;
  // Abramowitz & Stegun approximation of the normal CDF
  const absZ = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * absZ);
  const d = 0.3989422804014327; // 1/sqrt(2*PI)
  const p = d * Math.exp(-z * z / 2) *
    (t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))));
  const cdf = z > 0 ? (1 - p) : p;
  return Math.round(cdf * 100);
}

/**
 * Get sustainability percentile (lower impact = higher percentile = better)
 */
function getSustainabilityPercentile(value, mean, stdDev) {
  const rawPercentile = calculatePercentile(value, mean, stdDev);
  // Invert: lower value (less CO2, less water, less energy) = better = higher percentile
  return Math.max(1, Math.min(99, 100 - rawPercentile));
}

/**
 * Compute all percentiles for a product from local benchmarks
 */
function computeLocalPercentiles(product) {
  const cat = (product.sustainabilityData?.productCategory || 'default').toLowerCase();
  const bench = CATEGORY_BENCHMARKS[cat] || CATEGORY_BENCHMARKS.default;

  const co2e = product.carbonFootprint?.co2e || 3;
  const water = product.sustainabilityData?.waterUsage || co2e * 75;
  const energy = product.sustainabilityData?.energyUsage || co2e * 0.5;
  const recyclability = product.sustainabilityData?.recyclability || 50;

  const carbonPctile = getSustainabilityPercentile(co2e, bench.avgCo2e, bench.stdDevCo2e);
  const waterPctile = getSustainabilityPercentile(water, bench.avgWater, bench.stdDevWater);
  const energyPctile = getSustainabilityPercentile(energy, bench.avgEnergy, bench.stdDevEnergy);
  // Recyclability: higher is already better, so direct percentile
  const recyclePctile = Math.max(1, Math.min(99, Math.round(recyclability)));

  const overall = Math.round((carbonPctile * 0.35 + waterPctile * 0.25 + energyPctile * 0.25 + recyclePctile * 0.15));

  return {
    overall: Math.max(1, Math.min(99, overall)),
    carbon: carbonPctile,
    water: waterPctile,
    energy: energyPctile,
    recyclability: recyclePctile
  };
}

/**
 * Get percentiles: prefer AI-provided, fall back to local computation
 */
function getProductPercentiles(product) {
  if (product.percentileRanking &&
      typeof product.percentileRanking.overall === 'number' &&
      product.percentileRanking.overall > 0) {
    return product.percentileRanking;
  }
  return computeLocalPercentiles(product);
}

// ============================================================
// Material-based recyclability calculator
// ============================================================
function calculateRecyclabilityFromMaterials(materials) {
  if (!materials || materials.length === 0) return null;
  const scores = materials.map(m => {
    const key = m.toLowerCase();
    for (const [material, score] of Object.entries(MATERIAL_RECYCLABILITY)) {
      if (key.includes(material)) return score;
    }
    return 30; // unknown material
  });
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// ============================================================
// Contextual real-world equivalent strings
// ============================================================
function getContextString(metric, value) {
  const eq = REAL_WORLD_EQUIVALENTS;
  switch (metric) {
    case 'co2e': {
      const km = (value * eq.co2e.drivingKmPerKg).toFixed(0);
      return `Equivalent to driving ${km} km`;
    }
    case 'water': {
      const showers = Math.round(value * eq.water.showersPerLiter);
      if (showers <= 1) return `Less than 1 shower`;
      return `Equivalent to ${showers} showers`;
    }
    case 'energy': {
      const charges = Math.round(value * eq.energy.phoneChargesPerKwh);
      return `Equivalent to ${charges} phone charges`;
    }
    case 'recyclability': {
      if (value >= 80) return 'Highly recyclable materials';
      if (value >= 50) return 'Partially recyclable';
      return 'Difficult to recycle';
    }
    default:
      return '';
  }
}

/**
 * Ordinal suffix helper: 1 -> "1st", 2 -> "2nd", 72 -> "72nd"
 */
function ordinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ============================================================
// SVG Icons (inline, no emoji)
// ============================================================
const METRIC_ICONS = {
  carbon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="#FF6B6B" stroke-width="1.5"/>
    <path d="M2 12h20" stroke="#FF6B6B" stroke-width="1.5"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" stroke="#FF6B6B" stroke-width="1.5"/>
  </svg>`,
  water: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69z" stroke="#4DABF7" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  energy: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2" stroke="#F59F00" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
  </svg>`,
  recyclability: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7.5 7.67V3L3.83 6.67 7.5 10.33V6h5.17" stroke="#51CF66" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M16.5 16.33V21l3.67-3.67L16.5 13.67V18h-5.17" stroke="#51CF66" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M3 12.5h4.5L5.25 8.83" stroke="#51CF66" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M21 11.5h-4.5l2.25 3.67" stroke="#51CF66" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`
};

// ============================================================
// Learn More content for each metric
// ============================================================
const LEARN_MORE_CONTENT = {
  carbon: {
    what: 'Total greenhouse gas emissions across the product lifecycle: raw material extraction, manufacturing, packaging, and disposal.',
    how: 'Estimated using AI lifecycle analysis based on product type, materials, weight, and manufacturing complexity.',
    tip: 'Choose products made from recycled or sustainably sourced materials. Look for carbon-neutral certifications.'
  },
  water: {
    what: 'Total freshwater consumed during raw material production and manufacturing. Includes agricultural irrigation, industrial cooling, and processing.',
    how: 'AI-estimated based on material type and category. Textiles and food products typically have the highest water footprints.',
    tip: 'Organic cotton uses less water than conventional. Recycled materials skip water-intensive raw material processing.'
  },
  energy: {
    what: 'Electricity and fuel consumed during manufacturing, assembly, and quality testing.',
    how: 'Estimated from product complexity, manufacturing processes, and material processing requirements.',
    tip: 'Simpler products with fewer components use less manufacturing energy. Look for energy-efficient production certifications.'
  },
  recyclability: {
    what: 'How easily the product materials can be separated and recycled at end of life through standard municipal or specialized recycling.',
    how: 'Calculated from primary material composition. Mono-material products score highest; mixed materials score lowest.',
    tip: 'Aluminum (95%), glass (90%), and steel (90%) are the most recyclable. Avoid mixed-material composites when possible.'
  }
};

// Make everything globally accessible for content.js
window.CATEGORY_BENCHMARKS = CATEGORY_BENCHMARKS;
window.MATERIAL_RECYCLABILITY = MATERIAL_RECYCLABILITY;
window.REAL_WORLD_EQUIVALENTS = REAL_WORLD_EQUIVALENTS;
window.METRIC_ICONS = METRIC_ICONS;
window.LEARN_MORE_CONTENT = LEARN_MORE_CONTENT;
window.getProductPercentiles = getProductPercentiles;
window.computeLocalPercentiles = computeLocalPercentiles;
window.calculateRecyclabilityFromMaterials = calculateRecyclabilityFromMaterials;
window.getContextString = getContextString;
window.ordinalSuffix = ordinalSuffix;

/**
 * Comprehensive Sustainability Scoring Service
 * Calculates detailed sustainability metrics across multiple dimensions
 */

class SustainabilityScorer {
  constructor() {
    // Weight distribution for overall score
    this.weights = {
      carbon: 0.30,      // 30%
      water: 0.15,       // 15%
      energy: 0.15,      // 15%
      transport: 0.15,   // 15%
      endOfLife: 0.15,   // 15%
      packaging: 0.10    // 10%
    };

    // Category-based emission factors (kg CO2e)
    this.carbonFactors = {
      electronics: { base: 50, perKg: 20 },
      clothing: { base: 15, perKg: 8 },
      furniture: { base: 100, perKg: 5 },
      food: { base: 5, perKg: 3 },
      books: { base: 2, perKg: 1.5 },
      toys: { base: 10, perKg: 6 },
      beauty: { base: 8, perKg: 4 },
      default: { base: 20, perKg: 5 }
    };

    // Water usage multipliers (liters per kg CO2)
    this.waterMultipliers = {
      clothing: 150,
      textiles: 150,
      food: 100,
      electronics: 50,
      furniture: 80,
      beauty: 60,
      default: 75
    };

    // Material recyclability scores (0-100)
    this.materialRecyclability = {
      plastic: 40,
      metal: 85,
      glass: 90,
      paper: 75,
      cardboard: 80,
      aluminum: 95,
      steel: 90,
      wood: 65,
      textile: 30,
      electronic: 50,
      mixed: 20
    };
  }

  /**
   * Calculate overall sustainability score
   * @param {Object} product - Product data with sustainability info
   * @returns {Object} Comprehensive scoring breakdown
   */
  calculateOverallScore(product) {
    const scores = {
      carbon: this.scoreCarbonEmissions(product),
      water: this.scoreWaterFootprint(product),
      energy: this.scoreEnergyUse(product),
      transport: this.scoreTransportation(product),
      endOfLife: this.scoreEndOfLife(product),
      packaging: this.scorePackaging(product)
    };

    // Calculate weighted overall score
    const overallScore = Object.entries(scores).reduce((total, [key, score]) => {
      return total + (score.score * this.weights[key]);
    }, 0);

    return {
      overallScore: Math.round(overallScore),
      breakdown: scores,
      grade: this.getGrade(overallScore),
      metrics: this.estimateMetrics(product, scores)
    };
  }

  /**
   * Score carbon emissions (0-100, higher is better)
   */
  scoreCarbonEmissions(product) {
    const category = this.getCategoryKey(product.category);
    const factors = this.carbonFactors[category] || this.carbonFactors.default;
    
    // Estimate weight (if not provided)
    const weight = product.weight || this.estimateWeight(product);
    
    // Calculate carbon footprint
    const carbonFootprint = factors.base + (factors.perKg * weight);
    
    // Score based on carbon intensity (lower is better)
    // Excellent: < 10 kg, Poor: > 100 kg
    const carbonScore = Math.max(0, Math.min(100, 100 - (carbonFootprint / 100) * 100));

    return {
      score: carbonScore,
      value: carbonFootprint.toFixed(2),
      unit: 'kg CO2e',
      rating: this.getRating(carbonScore)
    };
  }

  /**
   * Score water footprint
   */
  scoreWaterFootprint(product) {
    const category = this.getCategoryKey(product.category);
    const multiplier = this.waterMultipliers[category] || this.waterMultipliers.default;
    
    // Base on carbon footprint
    const carbonScore = this.scoreCarbonEmissions(product);
    const waterUsage = parseFloat(carbonScore.value) * multiplier;
    
    // Score: Excellent: < 500L, Poor: > 5000L
    const waterScore = Math.max(0, Math.min(100, 100 - (waterUsage / 5000) * 100));

    return {
      score: waterScore,
      value: Math.round(waterUsage),
      unit: 'liters',
      rating: this.getRating(waterScore)
    };
  }

  /**
   * Score energy usage
   */
  scoreEnergyUse(product) {
    const category = this.getCategoryKey(product.category);
    const carbonScore = this.scoreCarbonEmissions(product);
    
    // Approximate energy: 0.4-0.6 kWh per kg CO2
    const energyFactor = category === 'electronics' ? 0.8 : 0.5;
    const energyUsage = parseFloat(carbonScore.value) * energyFactor;
    
    // Score: Excellent: < 5 kWh, Poor: > 50 kWh
    const energyScore = Math.max(0, Math.min(100, 100 - (energyUsage / 50) * 100));

    return {
      score: energyScore,
      value: energyUsage.toFixed(1),
      unit: 'kWh',
      rating: this.getRating(energyScore)
    };
  }

  /**
   * Score transportation impact
   */
  scoreTransportation(product) {
    // Estimate based on origin and shipping method
    const origin = product.origin || product.country || 'Unknown';
    const shippingMethod = product.shipping || 'standard';
    
    let transportScore = 50; // Default medium
    
    // Adjust for origin
    if (origin.toLowerCase().includes('local') || origin.toLowerCase().includes('usa')) {
      transportScore += 20;
    } else if (origin.toLowerCase().includes('china') || origin.toLowerCase().includes('asia')) {
      transportScore -= 20;
    }
    
    // Adjust for shipping method
    if (shippingMethod.toLowerCase().includes('express') || shippingMethod.toLowerCase().includes('air')) {
      transportScore -= 15;
    } else if (shippingMethod.toLowerCase().includes('ground') || shippingMethod.toLowerCase().includes('ship')) {
      transportScore += 10;
    }
    
    transportScore = Math.max(0, Math.min(100, transportScore));

    return {
      score: transportScore,
      value: origin,
      unit: 'origin',
      rating: this.getRating(transportScore)
    };
  }

  /**
   * Score end-of-life recyclability
   */
  scoreEndOfLife(product) {
    const materials = this.identifyMaterials(product);
    
    // Calculate average recyclability
    const recyclability = materials.reduce((sum, material) => {
      return sum + (this.materialRecyclability[material] || 30);
    }, 0) / materials.length;

    return {
      score: recyclability,
      value: Math.round(recyclability),
      unit: '%',
      rating: this.getRating(recyclability)
    };
  }

  /**
   * Score packaging sustainability
   */
  scorePackaging(product) {
    let packagingScore = 50; // Default
    
    const category = this.getCategoryKey(product.category);
    const title = (product.title || '').toLowerCase();
    const description = (product.description || '').toLowerCase();
    
    // Check for eco-friendly packaging keywords
    const ecoKeywords = ['recyclable', 'minimal packaging', 'plastic-free', 'biodegradable', 'compostable'];
    const badKeywords = ['excessive packaging', 'single-use', 'non-recyclable'];
    
    ecoKeywords.forEach(keyword => {
      if (title.includes(keyword) || description.includes(keyword)) {
        packagingScore += 10;
      }
    });
    
    badKeywords.forEach(keyword => {
      if (title.includes(keyword) || description.includes(keyword)) {
        packagingScore -= 15;
      }
    });
    
    // Category-based defaults
    if (category === 'electronics') packagingScore -= 10;
    if (category === 'books') packagingScore += 15;
    if (category === 'food') packagingScore -= 5;
    
    packagingScore = Math.max(0, Math.min(100, packagingScore));

    return {
      score: packagingScore,
      value: packagingScore > 70 ? 'Minimal' : packagingScore > 40 ? 'Moderate' : 'Excessive',
      unit: 'rating',
      rating: this.getRating(packagingScore)
    };
  }

  /**
   * Estimate comprehensive metrics
   */
  estimateMetrics(product, scores) {
    return {
      carbonFootprint: parseFloat(scores.carbon.value),
      waterUsage: scores.water.value,
      energyUsage: parseFloat(scores.energy.value),
      recyclability: scores.endOfLife.value,
      transportDistance: this.estimateTransportDistance(scores.transport.value),
      packagingType: scores.packaging.value
    };
  }

  /**
   * Helper: Get category key
   */
  getCategoryKey(category) {
    if (!category) return 'default';
    const cat = category.toLowerCase();
    for (const key of Object.keys(this.carbonFactors)) {
      if (cat.includes(key)) return key;
    }
    return 'default';
  }

  /**
   * Helper: Estimate product weight
   */
  estimateWeight(product) {
    const category = this.getCategoryKey(product.category);
    const weights = {
      electronics: 2.0,
      clothing: 0.5,
      furniture: 15.0,
      food: 1.0,
      books: 0.8,
      toys: 1.5,
      beauty: 0.3,
      default: 1.0
    };
    return weights[category] || weights.default;
  }

  /**
   * Helper: Identify materials from product
   */
  identifyMaterials(product) {
    const text = `${product.title || ''} ${product.description || ''}`.toLowerCase();
    const materials = [];
    
    Object.keys(this.materialRecyclability).forEach(material => {
      if (text.includes(material)) {
        materials.push(material);
      }
    });
    
    // Default if none found
    if (materials.length === 0) {
      const category = this.getCategoryKey(product.category);
      if (category === 'electronics') materials.push('electronic');
      else if (category === 'clothing') materials.push('textile');
      else materials.push('mixed');
    }
    
    return materials;
  }

  /**
   * Helper: Estimate transport distance
   */
  estimateTransportDistance(origin) {
    const distances = {
      'local': '< 100 miles',
      'usa': '500-1000 miles',
      'china': '5000+ miles',
      'asia': '5000+ miles',
      'europe': '3000-5000 miles',
      'unknown': 'Unknown'
    };
    
    const originLower = origin.toLowerCase();
    for (const [key, distance] of Object.entries(distances)) {
      if (originLower.includes(key)) return distance;
    }
    return distances.unknown;
  }

  /**
   * Helper: Get letter grade
   */
  getGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'A-';
    if (score >= 75) return 'B+';
    if (score >= 70) return 'B';
    if (score >= 65) return 'B-';
    if (score >= 60) return 'C+';
    if (score >= 55) return 'C';
    if (score >= 50) return 'C-';
    if (score >= 45) return 'D+';
    if (score >= 40) return 'D';
    return 'F';
  }

  /**
   * Helper: Get rating label
   */
  getRating(score) {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    if (score >= 20) return 'Poor';
    return 'Very Poor';
  }
}

export default SustainabilityScorer;

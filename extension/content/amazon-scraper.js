/**
 * Amazon Product Page Scraper
 * Extracts product information from Amazon product pages
 */

const AmazonScraper = {
  /**
   * Check if current page is an Amazon product page
   */
  isProductPage() {
    const url = window.location.href;
    return url.includes('/dp/') || url.includes('/gp/product/');
  },

  /**
   * Extract ASIN from URL or page
   */
  getASIN() {
    // Try URL first
    const urlMatch = window.location.href.match(/\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})/);
    if (urlMatch) {
      return urlMatch[1] || urlMatch[2];
    }

    // Try meta tag
    const asinMeta = document.querySelector('input[name="ASIN"]');
    if (asinMeta) {
      return asinMeta.value;
    }

    // Try hidden input
    const hiddenAsin = document.querySelector('#ASIN');
    if (hiddenAsin) {
      return hiddenAsin.value;
    }

    return null;
  },

  /**
   * Extract product title
   */
  getTitle() {
    const selectors = [
      '#productTitle',
      '#title',
      'h1.product-title',
      'h1 span#productTitle'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    return 'Unknown Product';
  },

  /**
   * Extract product details (weight, dimensions, materials)
   */
  getProductDetails() {
    const details = {};

    // Try technical details table
    const techTable = document.querySelector('#productDetails_techSpec_section_1');
    if (techTable) {
      const rows = techTable.querySelectorAll('tr');
      rows.forEach(row => {
        const th = row.querySelector('th');
        const td = row.querySelector('td');
        if (th && td) {
          const key = th.textContent.trim();
          const value = td.textContent.trim();
          details[key] = value;
        }
      });
    }

    // Try product information section
    const productInfo = document.querySelector('#productDetails_detailBullets_sections1');
    if (productInfo) {
      const rows = productInfo.querySelectorAll('tr');
      rows.forEach(row => {
        const th = row.querySelector('th');
        const td = row.querySelector('td');
        if (th && td) {
          const key = th.textContent.trim();
          const value = td.textContent.trim();
          details[key] = value;
        }
      });
    }

    // Try feature bullets for details
    const featureBullets = document.querySelectorAll('#feature-bullets li:not(.aok-hidden)');
    const features = [];
    featureBullets.forEach(bullet => {
      const text = bullet.textContent.trim();
      if (text) features.push(text);
    });
    if (features.length > 0) {
      details['Features'] = features.join(' | ');
    }

    return details;
  },

  /**
   * Extract product brand
   */
  getBrand() {
    const selectors = [
      '#bylineInfo',
      'a#brand',
      '.po-brand .po-break-word',
      'tr.po-brand td.a-span9',
      '[data-feature-name="bylineInfo"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        let brandText = element.textContent.trim();
        // Remove "Visit the ... Store" or "Brand: " prefixes
        brandText = brandText.replace(/^(Visit the |Brand:\s*)/i, '');
        brandText = brandText.replace(/\s+Store$/i, '');
        return brandText;
      }
    }

    return 'Unknown';
  },

  /**
   * Extract product category
   */
  getCategory() {
    // Try breadcrumbs
    const breadcrumbs = document.querySelector('#wayfinding-breadcrumbs_feature_div');
    if (breadcrumbs) {
      const links = breadcrumbs.querySelectorAll('a');
      if (links.length > 0) {
        return links[links.length - 1].textContent.trim();
      }
    }

    // Try department
    const dept = document.querySelector('.nav-a-content');
    if (dept) {
      return dept.textContent.trim();
    }

    return 'General';
  },

  /**
   * Extract product description
   */
  getDescription() {
    const selectors = [
      '#productDescription p',
      '#feature-bullets',
      '.a-unordered-list.a-vertical.a-spacing-mini'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim().substring(0, 500); // Limit length
      }
    }

    return '';
  },

  /**
   * Scrape all product data
   */
  scrapeProduct() {
    if (!this.isProductPage()) {
      return null;
    }

    const asin = this.getASIN();
    if (!asin) {
      console.warn('BloomCart: Could not extract ASIN from page');
      return null;
    }

    const scrapedData = {
      asin,
      title: this.getTitle(),
      brand: this.getBrand(),
      details: this.getProductDetails(),
      category: this.getCategory(),
      description: this.getDescription(),
      url: window.location.href,
      scrapedAt: new Date().toISOString()
    };

    console.log('BloomCart: Scraped product data', scrapedData);
    return scrapedData;
  }
};

// Make available globally
window.AmazonScraper = AmazonScraper;

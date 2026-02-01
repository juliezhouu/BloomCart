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
   * Extract product price
   */
  getPrice() {
    const selectors = [
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.a-price .a-offscreen',
      '#corePrice_feature_div .a-price .a-offscreen',
      '#price_inside_buybox',
      '#newBuyBoxPrice',
      'span.a-price span.a-offscreen',
      '#tp_price_block_total_price_ww .a-offscreen'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent.trim();
        if (text && text.match(/\$|£|€|\d/)) {
          return text;
        }
      }
    }

    return '';
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
      price: this.getPrice(),
      details: this.getProductDetails(),
      category: this.getCategory(),
      description: this.getDescription(),
      url: window.location.href,
      scrapedAt: new Date().toISOString()
    };

    console.log('BloomCart: Scraped product data', scrapedData);
    return scrapedData;
  },

  /**
   * Check if current page is an Amazon cart page
   */
  isCartPage() {
    const url = window.location.href;
    return url.includes('/cart') || url.includes('/gp/cart');
  },

  /**
   * Scrape all items from the Amazon cart page (live DOM).
   * Scoped to the ACTIVE cart only (excludes Save for Later, recommendations, etc.)
   */
  scrapeCartItems() {
    const items = [];
    const seen = new Set();

    // Find the active cart container
    const activeCart =
      document.querySelector('#activeCartViewForm') ||
      document.querySelector('#sc-active-cart') ||
      document.querySelector('#sc-cart-container');

    const searchRoot = activeCart || document;
    console.log('BloomCart: Scraping cart. Active cart container found:', !!activeCart);

    // Check element is NOT in Save for Later / recommendations
    function isInActiveCart(el) {
      if (activeCart) return activeCart.contains(el);
      const saved = document.querySelector('#sc-saved-cart, #savedCartViewForm');
      if (saved && saved.contains(el)) return false;
      if (el.closest('[class*="recommendation"], [class*="sims-"], [id*="sims-"]')) return false;
      return true;
    }

    // Find [data-asin] elements in active cart
    const asinEls = searchRoot.querySelectorAll('[data-asin]');
    asinEls.forEach(el => {
      const asin = el.getAttribute('data-asin');
      if (!asin || asin === '' || seen.has(asin)) return;
      if (!isInActiveCart(el)) return;

      // Use the top-level item container
      const container = el.closest('.sc-list-item') || el.closest('[data-item-index]') || el;
      const containerAsin = container.getAttribute('data-asin') || asin;
      if (containerAsin !== asin && seen.has(containerAsin)) return;

      // Skip containers with promotional/credit card content
      const containerText = container.textContent.toLowerCase();
      if (containerText.includes('credit card') || 
          containerText.includes('mastercard') || 
          containerText.includes('rewards card') ||
          containerText.includes('amazon card') ||
          containerText.includes('visa card') ||
          containerText.includes('apply now') ||
          containerText.includes('get approved')) {
        return;
      }

      // Find title
      const titleSelectors = [
        '.sc-product-title a', 'a.sc-product-link', '.sc-item-title-content a',
        '.a-truncate-cut', '.sc-product-title', 'span.a-truncate-full',
        'a[href*="/dp/"]', 'a.a-link-normal[href*="/dp/"]'
      ];
      let title = '';
      for (const sel of titleSelectors) {
        const tel = container.querySelector(sel);
        if (tel) {
          const text = tel.textContent.trim();
          if (text && text.length > 3) { 
            title = text; 
            break; 
          }
        }
      }
      if (!title) return;

      // Additional title filtering for credit cards
      const titleLower = title.toLowerCase();
      if (titleLower.includes('credit card') || 
          titleLower.includes('mastercard') || 
          titleLower.includes('rewards card') ||
          titleLower.includes('amazon card') ||
          titleLower.includes('visa card')) {
        return;
      }

      seen.add(asin);
      title = title.replace(/\s+/g, ' ').trim();

      const priceEl = container.querySelector(
        '.sc-product-price, .sc-price, .a-price .a-offscreen'
      );
      const price = priceEl ? priceEl.textContent.trim() : '';

      items.push({
        asin,
        title,
        price,
        brand: '',
        category: '',
        description: title,
        details: {},
        url: window.location.href,
        scrapedAt: new Date().toISOString()
      });
    });

    // Fallback: find product links with ASINs in active cart
    if (items.length === 0) {
      const links = searchRoot.querySelectorAll('a[href*="/dp/"]');
      links.forEach(link => {
        if (!isInActiveCart(link)) return;
        const href = link.getAttribute('href') || '';
        const match = href.match(/\/dp\/([A-Z0-9]{10})/);
        if (!match) return;
        const asin = match[1];
        if (seen.has(asin)) return;
        const title = link.textContent.trim().replace(/\s+/g, ' ');
        if (!title || title.length < 3) return;
        
        // Filter out credit card offers
        const titleLower = title.toLowerCase();
        if (titleLower.includes('credit card') || 
            titleLower.includes('mastercard') || 
            titleLower.includes('rewards card') ||
            titleLower.includes('amazon card') ||
            titleLower.includes('visa card')) {
          return;
        }
        
        seen.add(asin);

        const container = link.closest('.sc-list-item, [data-asin], [data-item-index]') || link.parentElement;
        const priceEl = container ? container.querySelector('.a-price .a-offscreen, .sc-product-price') : null;

        items.push({
          asin,
          title,
          price: priceEl ? priceEl.textContent.trim() : '',
          brand: '',
          category: '',
          description: title,
          details: {},
          url: window.location.href,
          scrapedAt: new Date().toISOString()
        });
      });
    }

    console.log('BloomCart: Scraped cart items:', items.length);
    if (items.length === 0) {
      const asinCount = document.querySelectorAll('[data-asin]').length;
      console.warn('BloomCart: No items parsed. Total [data-asin] on page:', asinCount);
    }
    return items;
  }
};

// Make available globally
window.AmazonScraper = AmazonScraper;

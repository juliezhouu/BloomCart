/**
 * Lottie Library Loader
 * Loads Lottie animation library into content script context
 */

(function() {
  // Check if Lottie is already loaded
  if (window.lottie) {
    console.log('BloomCart: Lottie already loaded');
    return;
  }

  // Create script element to load Lottie from CDN
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js';
  script.onload = () => {
    console.log('BloomCart: Lottie library loaded successfully');
  };
  script.onerror = () => {
    console.error('BloomCart: Failed to load Lottie library');
  };

  document.head.appendChild(script);
})();

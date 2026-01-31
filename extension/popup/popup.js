/**
 * BloomCart Popup Script
 * Displays plant stats and recent activity
 */

document.addEventListener('DOMContentLoaded', async () => {
  console.log('BloomCart Popup: Initializing...');

  // Load plant state from Chrome storage
  const { plantState, userId } = await new Promise((resolve) => {
    chrome.storage.local.get(['plantState', 'userId'], resolve);
  });

  console.log('BloomCart Popup: Loaded state', { plantState, userId });

  if (plantState) {
    displayPlantStats(plantState);
  } else {
    console.warn('BloomCart Popup: No plant state found');
  }
});

/**
 * Display plant statistics
 */
function displayPlantStats(plantState) {
  // Plant health (current frame as percentage)
  const healthElement = document.getElementById('plant-health');
  healthElement.textContent = `${plantState.currentFrame}%`;

  // Total purchases
  const totalPurchasesElement = document.getElementById('total-purchases');
  totalPurchasesElement.textContent = plantState.totalPurchases || 0;

  // Sustainable purchases
  const sustainablePurchasesElement = document.getElementById('sustainable-purchases');
  sustainablePurchasesElement.textContent = plantState.sustainablePurchases || 0;

  // Progress bar
  const progressElement = document.getElementById('plant-progress');
  progressElement.style.width = `${plantState.currentFrame}%`;

  // Recent activity
  if (plantState.history && plantState.history.length > 0) {
    displayRecentActivity(plantState.history);
  }

  console.log('BloomCart Popup: Stats displayed', plantState);
}

/**
 * Display recent purchase activity
 */
function displayRecentActivity(history) {
  const activityList = document.getElementById('activity-list');
  activityList.innerHTML = '';

  // Show last 5 activities
  const recentHistory = history.slice(-5).reverse();

  const ratingColors = {
    'A': '#00C851',
    'B': '#7CB342',
    'C': '#FFD600',
    'D': '#FF9800',
    'E': '#F44336'
  };

  recentHistory.forEach((activity) => {
    const activityItem = document.createElement('div');
    activityItem.className = 'activity-item';

    const timeAgo = getTimeAgo(new Date(activity.timestamp));
    const changeClass = activity.frameChange > 0 ? 'positive' : 'negative';
    const changeText = activity.frameChange > 0
      ? `+${activity.frameChange} frames`
      : `${activity.frameChange} frames`;

    activityItem.innerHTML = `
      <div class="activity-rating" style="background-color: ${ratingColors[activity.rating]}">
        ${activity.rating}
      </div>
      <div class="activity-details">
        <div class="activity-time">${timeAgo}</div>
        <div class="activity-change ${changeClass}">${changeText}</div>
      </div>
    `;

    activityList.appendChild(activityItem);
  });
}

/**
 * Get time ago string
 */
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

/**
 * Listen for storage changes to update UI in real-time
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.plantState) {
    console.log('BloomCart Popup: Plant state updated', changes.plantState.newValue);
    displayPlantStats(changes.plantState.newValue);
  }
});

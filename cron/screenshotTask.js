const { takeScreenshot } = require('../utils/screenshotService');

/**
 * Cron task to take a screenshot of a specified URL
 * @param {string} url - The URL to capture
 * @param {string} [outputFolder='screenshots'] - Where to save the screenshot
 * @returns {Promise<void>}
 */
async function captureUrlScreenshot(url, outputFolder = 'screenshots') {
  console.log(`Taking screenshot of ${url}`);
  
  try {
    const screenshotPath = await takeScreenshot(url, outputFolder, 0.6);
    console.log(`✅ Screenshot task completed successfully: ${screenshotPath}`);
    return screenshotPath;
  } catch (error) {
    console.error(`❌ Screenshot task failed:`, error);
    throw error;
  }
}

// If this file is run directly (not imported)
if (require.main === module) {
  // Get URL from command line arguments
  const url = process.argv[2];
  const outputFolder = process.argv[3] || 'screenshots';
  
  if (!url) {
    console.error('Please provide a URL as an argument');
    process.exit(1);
  }
  
  captureUrlScreenshot(url, outputFolder)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = captureUrlScreenshot;

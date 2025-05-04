const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { 
  getAvailabilityUrlsToProcess,
  recordAvailabilityScreenshot,
  storeAvailabilityResults,
  deactivateOldAvailabilityUrls,
  recordFailedAvailabilityScreenshotAttempt
} = require('../database/availabilityDb');
const captureUrlScreenshot = require('../cron/screenshotTask');

/**
 * Delete screenshot file if it exists
 * @param {string} screenshotPath - Path to the screenshot file
 */
function deleteScreenshot(screenshotPath) {
  if (screenshotPath && fs.existsSync(screenshotPath)) {
    try {
      fs.unlinkSync(screenshotPath);
      console.log(`Deleted screenshot: ${screenshotPath}`);
    } catch (deleteError) {
      console.error(`Error deleting screenshot ${screenshotPath}:`, deleteError);
    }
  }
}

/**
 * Process a single URL - take screenshot and analyze it
 * @param {Object} urlData - URL record from database
 * @returns {Promise<void>}
 */
async function processUrl(urlData) {
  try {
    console.log(`Processing URL: ${urlData.url}`);
    
    // Take screenshot
    const screenshotPath = await captureUrlScreenshot(urlData.url);
    
    // Record screenshot in database
    console.log(`Recording screenshot: ${screenshotPath}`, urlData, urlData.id, screenshotPath);
    const screenshotRecord = await recordAvailabilityScreenshot(urlData.id, screenshotPath);
    
    // Resolve the correct path for the screenshot
    const resolvedScreenshotPath = path.resolve(__dirname, '../screenshots', path.basename(screenshotPath));

    // Run Python analysis on the screenshot
    console.log(`Analyzing screenshot: ${resolvedScreenshotPath}`);
    const pythonScript = path.resolve(__dirname, '../python/analyze_availability_image.py');
    const analysisOutput = execSync(`python "${pythonScript}" "${resolvedScreenshotPath}"`, { 
      encoding: 'utf8',
      maxBuffer: 1024 * 1024, // 1MB buffer for larger outputs
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf8',
        PYTHONLEGACYWINDOWSSTDIO: '0', // Disable legacy stdio mode on Windows
        PYTHONUTF8: '1' // Force UTF-8 encoding
      }
    });

    try {
      // Remove "Raw Response:" prefix and extract only the first JSON object
      let jsonText = analysisOutput.trim();
      
      // Find the first occurrence of a JSON object
      const firstJsonStart = jsonText.indexOf('{');
      const firstJsonEnd = jsonText.indexOf('}') + 1;
      
      if (firstJsonStart !== -1 && firstJsonEnd !== -1) {
        jsonText = jsonText.substring(firstJsonStart, firstJsonEnd);
      }
      
      console.log('Processing JSON:', jsonText);
      const analysisResults = JSON.parse(jsonText);

      if (!analysisResults.isProductPage) {
        recordFailedAvailabilityScreenshotAttempt(urlData.id);
      }
      
      // Store analysis results
      await storeAvailabilityResults(screenshotRecord.id, analysisResults);
    } catch (error) {
      console.error('Error parsing analysis output:', error);
      console.debug('Raw output:', analysisOutput);
      
      recordFailedAvailabilityScreenshotAttempt(urlData.id);

      throw new Error('Failed to parse analysis results');
    } finally {
      // Delete screenshot file after processing, regardless of success or failure
      // deleteScreenshot(resolvedScreenshotPath);
    }
  } catch (error) {
    console.error(`Error processing URL ${urlData.url}:`, error);

    recordFailedAvailabilityScreenshotAttempt(urlData.id);
  } finally {
    // Delete screenshot file after processing, regardless of success or failure
    // deleteScreenshot(resolvedScreenshotPath);
  }
}

/**
 * Process all URLs that need to be checked
 * @returns {Promise<void>}
 */
async function processAllAvailabilityDueUrls() {
  try {
    const urlsToProcess = await getAvailabilityUrlsToProcess();

    console.log('Deactivating old URLs...');
    deactivateOldAvailabilityUrls();
    
    if (urlsToProcess.length === 0) {
      console.log('No URLs to process at this time');
      return;
    }
    
    console.log(`Found ${urlsToProcess.length} URLs to process`);
    
    // Process each URL sequentially to avoid overwhelming the system
    for (const url of urlsToProcess) {
      await processUrl(url);
    }
    
    console.log('URL processing completed');
  } catch (error) {
    console.error('Error processing URLs:', error);
  }
}

// If this file is run directly
if (require.main === module) {
  processAllAvailabilityDueUrls()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { processAllAvailabilityDueUrls };

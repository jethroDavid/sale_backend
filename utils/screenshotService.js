const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp'); // You'll need to install this: npm install sharp

/**
 * Takes a screenshot of the specified URL and saves it to the screenshots folder
 * @param {string} url - The URL to take a screenshot of
 * @param {string} [outputFolder='screenshots'] - Folder to save screenshots (relative to project root)
 * @param {number} [scaleFactor=0.6] - Factor to scale image by (0.6 = 60% of original size)
 * @returns {Promise<string>} - Path to the saved screenshot (relative path)
 */
async function takeScreenshot(url, outputFolder = 'screenshots', scaleFactor = 0.4) {
  try {
    // Create browser instance
    const browser = await puppeteer.launch({
      headless: 'new'
    });
    
    // Create a new page and navigate to URL
    const page = await browser.newPage();
    
    // Set viewport to desktop dimensions
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });
    
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    // Create output folder if it doesn't exist
    const screenshotDir = path.resolve(process.cwd(), outputFolder);
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    // Generate filename with timestamp and URL info
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const urlSlug = new URL(url).hostname.replace(/[^a-z0-9]/gi, '-');
    const filename = `${timestamp}-${urlSlug}.png`;
    const tempFilePath = path.join(screenshotDir, `temp_${filename}`);
    const filePath = path.join(screenshotDir, filename);
    
    // Create relative path using backslashes for Windows style
    const relativePath = `\/${outputFolder}\/${filename}`;
    
    // Take screenshot and save to temporary file
    await page.screenshot({ path: tempFilePath, fullPage: false });
    
    // Close browser
    await browser.close();
    
    // Resize image to the specified scale
    await sharp(tempFilePath)
      .resize({ 
        width: Math.round(1920 * scaleFactor),
        height: Math.round(1080 * scaleFactor),
        fit: 'inside'
      })
      .toFile(filePath);
      
    // Remove temporary file
    fs.unlinkSync(tempFilePath);
    
    console.log(`Returning relative path: ${relativePath}`);
    
    // Return relative path instead of absolute path
    return relativePath;
  } catch (error) {
    console.error(`Error taking screenshot of ${url}:`, error);
    throw error;
  }
}

module.exports = { takeScreenshot };

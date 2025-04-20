const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp'); // You'll need to install this: npm install sharp

/**
 * Gets the file size in KB
 * @param {string} filePath - Path to the file
 * @returns {number} - Size in KB
 */
function getFileSizeInKB(filePath) {
  const stats = fs.statSync(filePath);
  return stats.size / 1024; // Convert bytes to KB
}

/**
 * Takes a screenshot of the specified URL and saves it to the screenshots folder
 * @param {string} url - The URL to take a screenshot of
 * @param {string} [outputFolder='screenshots'] - Folder to save screenshots (relative to project root)
 * @param {number} [scaleFactor=0.4] - Factor to scale image by (0.4 = 40% of original size)
 * @param {number} [minSizeKB=10] - Minimum acceptable screenshot size in KB
 * @returns {Promise<string>} - Path to the saved screenshot (relative path)
 */
async function takeScreenshot(url, outputFolder = 'screenshots', scaleFactor = 0.4, minSizeKB = 10) {
  try {
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
    
    // Launch browser with more realistic user agent and additional options
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--disable-features=IsolateOrigins',
        '--disable-site-isolation-trials',
        '--disable-features=BlockInsecurePrivateNetworkRequests',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=site-per-process'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set a more realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    
    // Set extra HTTP headers to appear more like a regular browser
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
    });
    
    // Emulate viewport with more realistic settings
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: true,
      isMobile: false,
    });
    
    // Set cookie acceptance behavior
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    
    // Intercept and allow requests to avoid certain blocks
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      request.continue();
    });
    
    // Navigate to the page with extended timeout and wait conditions
    await page.goto(url, { 
      waitUntil: ['networkidle2', 'domcontentloaded', 'load'],
      timeout: 30000 
    });
    
    // Perform random mouse movements to simulate human behavior
    await page.mouse.move(100, 100);
    await page.mouse.move(400, 300);
    await page.mouse.move(600, 500);
    
    // Scroll down and up the page to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Take the screenshot
    await page.screenshot({ path: tempFilePath, fullPage: false });
    await browser.close();
    
    // Check file size
    const firstSize = getFileSizeInKB(tempFilePath);
    console.log(`First screenshot size: ${firstSize.toFixed(2)}KB`);
    
    if (firstSize >= minSizeKB) {
      // First attempt was successful, resize and return
      await sharp(tempFilePath)
        .resize({ 
          width: Math.round(1920 * scaleFactor),
          height: Math.round(1080 * scaleFactor),
          fit: 'inside'
        })
        .toFile(filePath);
        
      fs.unlinkSync(tempFilePath);
      return relativePath;
    }
    
    // Second attempt with additional techniques
    console.log(`Screenshot too small (${firstSize.toFixed(2)}KB < ${minSizeKB}KB), retrying with enhanced approach...`);
    
    const browser2 = await puppeteer.launch({
      headless: 'new',
      args: [
        '--disable-features=IsolateOrigins',
        '--disable-site-isolation-trials',
        '--disable-features=BlockInsecurePrivateNetworkRequests',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=site-per-process'
      ]
    });
    
    const page2 = await browser2.newPage();
    
    // Use a different user agent for second attempt
    await page2.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0');
    
    await page2.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
    });
    
    await page2.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });
    
    // More advanced webdriver evasion techniques
    await page2.evaluateOnNewDocument(() => {
      // Hide automation indicators
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      
      // Mock permissions API
      if (!('permissions' in navigator)) {
        navigator.permissions = {
          query: async ({ name }) => {
            return { state: 'granted', onchange: null };
          }
        };
      }
      
      // Override property descriptors to mask automation
      const overrideDescriptor = (obj, prop, getter) => {
        try {
          Object.defineProperty(obj, prop, { get: getter });
        } catch (e) {}
      };
      
      // Mock plugins and mimeTypes
      overrideDescriptor(navigator, 'plugins', () => {
        const plugins = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
        ];
        return plugins;
      });
    });
    
    // Navigate with retry logic
    let retries = 0;
    const maxRetries = 3;
    let navigationSuccess = false;
    
    while (retries < maxRetries && !navigationSuccess) {
      try {
        await page2.goto(url, { 
          waitUntil: ['networkidle2', 'domcontentloaded'],
          timeout: 45000 
        });
        navigationSuccess = true;
      } catch (error) {
        console.log(`Navigation attempt ${retries + 1} failed: ${error.message}`);
        retries++;
        if (retries >= maxRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait before retry
      }
    }
    
    // Interact with the page more naturally
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page2.mouse.move(150, 150);
    await page2.mouse.move(450, 350);
    
    // Scroll behavior
    await page2.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 4);
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page2.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page2.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Take screenshot
    await page2.screenshot({ path: tempFilePath, fullPage: false });
    await browser2.close();
    
    // Check file size
    const secondSize = getFileSizeInKB(tempFilePath);
    console.log(`Second screenshot size: ${secondSize.toFixed(2)}KB`);
    
    if (secondSize >= minSizeKB) {
      // Second attempt was successful, resize and return
      await sharp(tempFilePath)
        .resize({ 
          width: Math.round(1920 * scaleFactor),
          height: Math.round(1080 * scaleFactor),
          fit: 'inside'
        })
        .toFile(filePath);
        
      fs.unlinkSync(tempFilePath);
      return relativePath;
    }
    
    // If all attempts fail, resize and return what we have
    console.log(`Final screenshot size: ${secondSize.toFixed(2)}KB - using best available`);
    
    await sharp(tempFilePath)
      .resize({ 
        width: Math.round(1920 * scaleFactor),
        height: Math.round(1080 * scaleFactor),
        fit: 'inside'
      })
      .toFile(filePath);
      
    fs.unlinkSync(tempFilePath);
    
    return relativePath;
  } catch (error) {
    console.error(`Error taking screenshot of ${url}:`, error);
    throw error;
  }
}

module.exports = { takeScreenshot };

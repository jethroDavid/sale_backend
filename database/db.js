const mysql = require('mysql2/promise');
require('dotenv').config({ path: __dirname + '/../.env' });

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

/**
 * Get a connection from the pool
 * @returns {Promise<mysql.Connection>} - A connection instance
 */
async function getConnection() {
  return pool.getConnection();
}

/**
 * Add a URL to monitor with user association
 * @param {string} url - The URL to monitor
 * @param {number} frequencyHours - How often to check the URL in hours
 * @param {string} email - User's email address
 * @returns {Promise<Object>} Result of the operation
 */
async function addMonitoredUrl(url, frequencyHours, email) {
  const connection = await getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Get user ID from email
    const [userRows] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    
    if (userRows.length === 0) {
      throw new Error('User not found');
    }
    
    const userId = userRows[0].id;
    
    // Insert URL or get existing URL ID
    // Reset last_checked to NULL to ensure it's checked in the next cycle
    const [urlResult] = await connection.execute(
      'INSERT INTO monitored_urls (url, frequency_hours, last_checked, active, failed_attempts, status) VALUES (?, ?, NULL, TRUE, 0, "active") ' +
      'ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), frequency_hours=?, last_checked=NULL, active=TRUE, failed_attempts=0, status="active"',
      [url, frequencyHours, frequencyHours]
    );
    
    const urlId = urlResult.insertId;
    
    // Create user-URL association
    await connection.execute(
      'INSERT INTO user_urls (user_id, url_id) VALUES (?, ?) ' +
      'ON DUPLICATE KEY UPDATE id=id', // Do nothing if already exists
      [userId, urlId]
    );
    
    await connection.commit();
    
    return {
      urlId,
      userId,
      url,
      frequencyHours
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get URLs that need to be checked based on their frequency
 * @returns {Promise<Array>} - Array of URLs to check
 */
async function getUrlsToProcess() {
  try {
    const [rows] = await pool.execute(
      `SELECT id, url, frequency_hours, last_checked 
       FROM monitored_urls 
       WHERE active = TRUE AND (
         last_checked IS NULL OR 
         TIMESTAMPDIFF(HOUR, last_checked, NOW()) >= frequency_hours
       )
       LIMIT 10`
    );
    
    return rows;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

/**
 * Record a screenshot in the database
 * @param {number} urlId - The ID of the URL
 * @param {string} screenshotPath - Path to the screenshot file
 * @returns {Promise<Object>} - The inserted record
 */
async function recordScreenshot(urlId, screenshotPath) {
  try {
    // Update the last_checked timestamp and reset failed attempts on success
    await pool.execute(
      `UPDATE monitored_urls SET last_checked = NOW(), failed_attempts = 0 WHERE id = ?`,
      [urlId]
    );
    
    // Insert screenshot record
    const [result] = await pool.execute(
      `INSERT INTO screenshots (url_id, screenshot_path) VALUES (?, ?)`,
      [urlId, screenshotPath]
    );
    
    return {
      id: result.insertId,
      urlId,
      screenshotPath
    };
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

/**
 * Record a failed screenshot attempt and deactivate URL after 3 failures
 * @param {number} urlId - The ID of the URL
 * @returns {Promise<Object>} - Result with updated status
 */
async function recordFailedScreenshotAttempt(urlId) {
  try {
    // Update last_checked and increment failed_attempts
    await pool.execute(
      `UPDATE monitored_urls 
       SET last_checked = NOW(), 
           failed_attempts = failed_attempts + 1,
           active = IF(failed_attempts >= 3, FALSE, TRUE),
           status = IF(failed_attempts >= 3, 'error', status)
       WHERE id = ?`,
      [urlId]
    );
    
    // Get updated URL record
    const [rows] = await pool.execute(
      `SELECT id, url, failed_attempts, active, status 
       FROM monitored_urls 
       WHERE id = ?`,
      [urlId]
    );
    
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

/**
 * Store the analysis results in the database
 * @param {number} screenshotId - The ID of the screenshot
 * @param {Object} analysisResults - The analysis results
 * @returns {Promise<Object>} - The inserted record
 */
async function storeAnalysisResults(screenshotId, analysisResults) {
  try {
    // Mark the screenshot as analyzed
    await pool.execute(
      `UPDATE screenshots SET analyzed = TRUE WHERE id = ?`,
      [screenshotId]
    );
    
    // Insert analysis results including discount_details
    const [result] = await pool.execute(
      `INSERT INTO analysis_results (
        screenshot_id, is_ecommerce, is_product_page, is_on_sale, 
        confidence, product_name, price, currency, 
        discount_percentage, other_insights, discount_details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        screenshotId,
        analysisResults.isEcommerce || false,
        analysisResults.isProductPage || false,
        analysisResults.isOnSale || false,
        analysisResults.confidence || 0,
        analysisResults.productName || null,
        analysisResults.price || null,
        analysisResults.currency || null,
        analysisResults.discountPercentage || null,
        analysisResults.otherInsights || null,
        analysisResults.discountDetails || null
      ]
    );
    
    return {
      id: result.insertId,
      screenshotId,
      ...analysisResults
    };
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

/**
 * Mark a sale notification as sent
 * @param {number} analysisId - The ID of the analysis record
 * @returns {Promise<Object>} - The updated record
 */
async function markNotificationSent(analysisId) {
  try {
    const [result] = await pool.execute(
      `UPDATE analysis_results SET notification_sent = TRUE WHERE id = ?`,
      [analysisId]
    );
    
    return result;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

/**
 * Get unsent sale notifications
 * @returns {Promise<Array>} - Array of analysis results with on sale items
 */
async function getUnsentSaleNotifications() {
  try {
    const [rows] = await pool.execute(
      `SELECT ar.*, s.screenshot_path, mu.url, mu.id AS url_id
       FROM analysis_results ar
       JOIN screenshots s ON ar.screenshot_id = s.id
       JOIN monitored_urls mu ON s.url_id = mu.id
       WHERE ar.is_on_sale = TRUE
       AND ar.notification_sent = FALSE`
    );
    
    return rows;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

/**
 * Create a new user with email and password
 * @param {string} email - User's email
 * @param {string} passwordHash - Hashed password
 * @param {string} name - User's name (optional)
 * @returns {Promise<Object>} - The inserted user record
 */
async function createUser(email, passwordHash, name = null) {
  try {
    const [result] = await pool.execute(
      `INSERT INTO users (email, password_hash, name, auth_type) 
       VALUES (?, ?, ?, 'email')`,
      [email, passwordHash, name]
    );
    
    return {
      id: result.insertId,
      email,
      name
    };
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

/**
 * Create or update a user authenticated with Google
 * @param {string} email - User's email
 * @param {string} name - User's name
 * @param {string} googleId - Google's unique identifier
 * @returns {Promise<Object>} - The user record
 */
async function createOrUpdateGoogleUser(email, name = '', googleId) {
  try {
    const [existingUsers] = await pool.execute(
      `SELECT * FROM users WHERE email = ?`,
      [email]
    );
    
    if (existingUsers.length > 0) {
      // Update existing user with Google info
      await pool.execute(
        `UPDATE users SET google_id = ?, name = COALESCE(?, name), 
         auth_type = CASE WHEN auth_type = 'email' THEN 'both' ELSE 'google' END
         WHERE email = ?`,
        [googleId, name, email]
      );
      
      return {
        id: existingUsers[0].id,
        email,
        name: name || existingUsers[0].name
      };
    } else {
      // Create new user with Google info
      const [result] = await pool.execute(
        `INSERT INTO users (email, name, google_id, auth_type) 
         VALUES (?, ?, ?, 'google')`,
        [email, name, googleId]
      );
      
      return {
        id: result.insertId,
        email,
        name
      };
    }
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

/**
 * Get user by email
 * @param {string} email - User's email
 * @returns {Promise<Object|null>} - The user record or null
 */
async function getUserByEmail(email) {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM users WHERE email = ?`,
      [email]
    );
    
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

/**
 * Get user by ID
 * @param {number} id - User's ID
 * @returns {Promise<Object|null>} - The user record or null
 */
async function getUserById(id) {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM users WHERE id = ?`,
      [id]
    );
    
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

/**
 * Get all monitored URLs for a specific user
 * @param {number} userId - The user's ID
 * @param {string|Date} [fromDate] - Optional start date filter (inclusive)
 * @param {string|Date} [toDate] - Optional end date filter (inclusive)
 * @returns {Promise<Array>} - Array of monitored URLs
 */
async function getUserMonitoredUrls(userId, fromDate = null, toDate = null) {
  try {
    let query = `SELECT mu.id, mu.url, mu.frequency_hours, mu.last_checked, mu.created_at, mu.active, mu.failed_attempts, mu.status
       FROM monitored_urls mu
       JOIN user_urls uu ON mu.id = uu.url_id
       WHERE uu.user_id = ?`;
    
    const params = [userId];
    
    if (fromDate) {
      query += ` AND mu.created_at >= ?`;
      params.push(fromDate);
    }
    
    if (toDate) {
      query += ` AND mu.created_at <= ?`;
      params.push(toDate);
    }
    
    query += ` ORDER BY mu.created_at DESC`;
    
    const [rows] = await pool.execute(query, params);
    
    return rows;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

async function getUserUrlAnalysisResults(userId, urlId) {
  try {
    const [rows] = await pool.execute(
      `SELECT ar.*, mu.url, mu.frequency_hours, mu.last_checked, ar.created_at, mu.active
       FROM analysis_results ar
       JOIN screenshots s ON ar.screenshot_id = s.id
       JOIN monitored_urls mu ON s.url_id = mu.id
       JOIN user_urls uu ON mu.id = uu.url_id
       WHERE uu.user_id = ? AND mu.id = ?
       ORDER BY ar.created_at DESC
       LIMIT 6`,
      [userId, urlId]
    );
    
    return rows;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

/**
 * Deactivate monitored URLs that are older than 3 months
 * @returns {Promise<Object>} - The result of the update operation
 */
async function deactivateOldUrls() {
  try {
    const [result] = await pool.execute(
      `UPDATE monitored_urls
       SET active = FALSE
       WHERE active = TRUE 
       AND last_checked IS NOT NULL
       AND DATEDIFF(NOW(), created_at) > 90`
    );
    
    return {
      affectedRows: result.affectedRows,
      message: `Deactivated ${result.affectedRows} old monitored URLs`
    };
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

/**
 * Delete a URL association for a specific user
 * @param {number} userId - The user's ID
 * @param {number} urlId - The URL ID to delete
 * @returns {Promise<Object>} - Result of the deletion operation
 */
async function deleteUserUrl(userId, urlId) {
  try {
    const [result] = await pool.execute(
      `DELETE FROM user_urls 
       WHERE user_id = ? AND url_id = ?`,
      [userId, urlId]
    );
    
    // Check if any other users are monitoring this URL
    const [remainingUsers] = await pool.execute(
      `SELECT COUNT(*) as count FROM user_urls WHERE url_id = ?`,
      [urlId]
    );
    
    // If no other users are monitoring this URL, deactivate it
    if (remainingUsers[0].count === 0) {
      await pool.execute(
        `UPDATE monitored_urls SET active = FALSE WHERE id = ?`,
        [urlId]
      );
    }
    
    return {
      success: result.affectedRows > 0,
      affectedRows: result.affectedRows,
      message: result.affectedRows > 0 
        ? 'URL successfully removed from user monitoring list' 
        : 'No matching URL found for this user'
    };
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

/**
 * Get all users monitoring a specific URL
 * @param {number} urlId - The monitored URL ID
 * @returns {Promise<Array>} - Array of users with emails
 */
async function getUsersMonitoringUrl(urlId) {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.email, u.name
       FROM users u
       JOIN user_urls uu ON u.id = uu.user_id
       WHERE uu.url_id = ?`,
      [urlId]
    );
    
    return rows;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

/**
 * Deactivate a monitored URL
 * @param {number} urlId - The URL ID to deactivate
 * @returns {Promise<Object>} - Result of the update operation
 */
async function deactivateMonitoredUrl(urlId) {
  try {
    const [result] = await pool.execute(
      `UPDATE monitored_urls SET active = FALSE, status = 'paused' WHERE id = ?`,
      [urlId]
    );
    
    return {
      success: result.affectedRows > 0,
      message: `URL with ID ${urlId} has been deactivated`
    };
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

module.exports = {
  pool,
  getConnection,
  addMonitoredUrl,
  getUrlsToProcess,
  recordScreenshot,
  recordFailedScreenshotAttempt,
  storeAnalysisResults,
  markNotificationSent,
  getUnsentSaleNotifications,
  createUser,
  createOrUpdateGoogleUser,
  getUserByEmail,
  getUserById,
  getUserMonitoredUrls,
  deactivateOldUrls,
  getUserUrlAnalysisResults,
  deleteUserUrl,
  getUsersMonitoringUrl,
  deactivateMonitoredUrl
};

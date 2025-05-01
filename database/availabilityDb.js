const mysql = require('mysql2/promise');
const { pool, getConnection } = require('./db'); // Reuse connection pool from main db file

/**
 * Add a URL to monitor for availability with user association
 * @param {string} url - The URL to monitor
 * @param {number} frequencyHours - How often to check the URL in hours
 * @param {string} email - User's email address
 * @returns {Promise<Object>} Result of the operation
 */
async function addAvailabilityUrl(url, frequencyHours, email) {
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
      'INSERT INTO availability_urls (url, frequency_hours, last_checked, active, failed_attempts, status) VALUES (?, ?, NULL, TRUE, 0, "active") ' +
      'ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), frequency_hours=?, last_checked=NULL, active=TRUE, failed_attempts=0, status="active"',
      [url, frequencyHours, frequencyHours]
    );
    
    const urlId = urlResult.insertId;
    
    // Create user-URL association
    await connection.execute(
      'INSERT INTO availability_user_urls (user_id, url_id) VALUES (?, ?) ' +
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
 * Get availability URLs that need to be checked based on their frequency
 * @returns {Promise<Array>} - Array of URLs to check
 */
async function getAvailabilityUrlsToProcess() {
  try {
    const [rows] = await pool.execute(
      `SELECT id, url, frequency_hours, last_checked 
       FROM availability_urls 
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
 * Record a screenshot in the database for availability
 * @param {number} urlId - The ID of the URL
 * @param {string} screenshotPath - Path to the screenshot file
 * @returns {Promise<Object>} - The inserted record
 */
async function recordAvailabilityScreenshot(urlId, screenshotPath) {
  try {
    // Update the last_checked timestamp and reset failed attempts on success
    await pool.execute(
      `UPDATE availability_urls SET last_checked = NOW(), failed_attempts = 0 WHERE id = ?`,
      [urlId]
    );
    
    // Insert screenshot record
    const [result] = await pool.execute(
      `INSERT INTO availability_screenshots (url_id, screenshot_path) VALUES (?, ?)`,
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
async function recordFailedAvailabilityScreenshotAttempt(urlId) {
  try {
    // Update last_checked and increment failed_attempts
    await pool.execute(
      `UPDATE availability_urls 
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
       FROM availability_urls 
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
 * Store the availability analysis results in the database
 * @param {number} screenshotId - The ID of the screenshot
 * @param {Object} analysisResults - The analysis results
 * @returns {Promise<Object>} - The inserted record
 */
async function storeAvailabilityResults(screenshotId, analysisResults) {
  try {
    // Mark the screenshot as analyzed
    await pool.execute(
      `UPDATE availability_screenshots SET analyzed = TRUE WHERE id = ?`,
      [screenshotId]
    );
    
    // Insert availability analysis results
    const [result] = await pool.execute(
      `INSERT INTO availability_results (
        screenshot_id, is_ecommerce, is_product_page, is_available, 
        confidence, product_name, stock_status, availability_details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        screenshotId,
        analysisResults.isEcommerce || false,
        analysisResults.isProductPage || false,
        analysisResults.isAvailable || false,
        analysisResults.confidence || 0,
        analysisResults.productName || null,
        analysisResults.stockStatus || null,
        analysisResults.availabilityDetails || null,
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
 * Mark an availability notification as sent
 * @param {number} analysisId - The ID of the analysis record
 * @returns {Promise<Object>} - The updated record
 */
async function markAvailabilityNotificationSent(analysisId) {
  try {
    const [result] = await pool.execute(
      `UPDATE availability_results SET notification_sent = TRUE WHERE id = ?`,
      [analysisId]
    );
    
    return result;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

/**
 * Get unsent availability notifications
 * @returns {Promise<Array>} - Array of analysis results with availability status changes
 */
async function getUnsentAvailabilityNotifications() {
  try {
    const [rows] = await pool.execute(
      `SELECT ar.*, s.screenshot_path, au.url, au.id AS url_id
       FROM availability_results ar
       JOIN availability_screenshots s ON ar.screenshot_id = s.id
       JOIN availability_urls au ON s.url_id = au.id
       WHERE ar.is_available = TRUE
       AND ar.notification_sent = FALSE`
    );
    
    return rows;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

/**
 * Get all monitored availability URLs for a specific user
 * @param {number} userId - The user's ID
 * @param {string|Date} [fromDate] - Optional start date filter (inclusive)
 * @param {string|Date} [toDate] - Optional end date filter (inclusive)
 * @returns {Promise<Array>} - Array of monitored URLs
 */
async function getUserAvailabilityUrls(userId, fromDate = null, toDate = null) {
  try {
    let query = `SELECT au.id, au.url, au.frequency_hours, au.last_checked, au.created_at, au.active, au.failed_attempts, au.status
       FROM availability_urls au
       JOIN availability_user_urls auu ON au.id = auu.url_id
       WHERE auu.user_id = ?`;
    
    const params = [userId];
    
    if (fromDate) {
      query += ` AND au.created_at >= ?`;
      params.push(fromDate);
    }
    
    if (toDate) {
      query += ` AND au.created_at <= ?`;
      params.push(toDate);
    }
    
    query += ` ORDER BY au.created_at DESC`;
    
    const [rows] = await pool.execute(query, params);
    
    return rows;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

/**
 * Get availability analysis results for a specific URL monitored by a user
 * @param {number} userId - The user's ID
 * @param {number} urlId - The URL ID to get results for
 * @returns {Promise<Array>} - Array of availability analysis results
 */
async function getUserUrlAvailabilityResults(userId, urlId) {
  try {
    const [rows] = await pool.execute(
      `SELECT ar.*, au.url, au.frequency_hours, au.last_checked, ar.created_at, au.active
       FROM availability_results ar
       JOIN availability_screenshots s ON ar.screenshot_id = s.id
       JOIN availability_urls au ON s.url_id = au.id
       JOIN availability_user_urls auu ON au.id = auu.url_id
       WHERE auu.user_id = ? AND au.id = ?
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
 * Deactivate monitored availability URLs that are older than 3 months
 * @returns {Promise<Object>} - The result of the update operation
 */
async function deactivateOldAvailabilityUrls() {
  try {
    const [result] = await pool.execute(
      `UPDATE availability_urls
       SET active = FALSE
       WHERE active = TRUE 
       AND last_checked IS NOT NULL
       AND DATEDIFF(NOW(), created_at) > 90`
    );
    
    return {
      affectedRows: result.affectedRows,
      message: `Deactivated ${result.affectedRows} old availability URLs`
    };
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

/**
 * Delete an availability URL association for a specific user
 * @param {number} userId - The user's ID
 * @param {number} urlId - The URL ID to delete
 * @returns {Promise<Object>} - Result of the deletion operation
 */
async function deleteUserAvailabilityUrl(userId, urlId) {
  try {
    const [result] = await pool.execute(
      `DELETE FROM availability_user_urls 
       WHERE user_id = ? AND url_id = ?`,
      [userId, urlId]
    );
    
    // Check if any other users are monitoring this URL
    const [remainingUsers] = await pool.execute(
      `SELECT COUNT(*) as count FROM availability_user_urls WHERE url_id = ?`,
      [urlId]
    );
    
    // If no other users are monitoring this URL, deactivate it
    if (remainingUsers[0].count === 0) {
      await pool.execute(
        `UPDATE availability_urls SET active = FALSE WHERE id = ?`,
        [urlId]
      );
    }
    
    return {
      success: result.affectedRows > 0,
      affectedRows: result.affectedRows,
      message: result.affectedRows > 0 
        ? 'Availability URL successfully removed from user monitoring list' 
        : 'No matching availability URL found for this user'
    };
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

/**
 * Get all users monitoring a specific availability URL
 * @param {number} urlId - The monitored URL ID
 * @returns {Promise<Array>} - Array of users with emails
 */
async function getUsersMonitoringAvailabilityUrl(urlId) {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.email, u.name
       FROM users u
       JOIN availability_user_urls auu ON u.id = auu.user_id
       WHERE auu.url_id = ?`,
      [urlId]
    );
    
    return rows;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

/**
 * Deactivate a monitored availability URL
 * @param {number} urlId - The URL ID to deactivate
 * @returns {Promise<Object>} - Result of the update operation
 */
async function deactivateAvailabilityUrl(urlId) {
  try {
    const [result] = await pool.execute(
      `UPDATE availability_urls SET active = FALSE, status = 'paused' WHERE id = ?`,
      [urlId]
    );
    
    return {
      success: result.affectedRows > 0,
      message: `Availability URL with ID ${urlId} has been deactivated`
    };
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

module.exports = {
  addAvailabilityUrl,
  getAvailabilityUrlsToProcess,
  recordAvailabilityScreenshot,
  recordFailedAvailabilityScreenshotAttempt,
  storeAvailabilityResults,
  markAvailabilityNotificationSent,
  getUnsentAvailabilityNotifications,
  getUserAvailabilityUrls,
  getUserUrlAvailabilityResults,
  deactivateOldAvailabilityUrls,
  deleteUserAvailabilityUrl,
  getUsersMonitoringAvailabilityUrl,
  deactivateAvailabilityUrl
};

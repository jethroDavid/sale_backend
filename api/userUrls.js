const express = require('express');
const { getUserMonitoredUrls, getUserUrlAnalysisResults, deleteUserUrl } = require('../database/db');
const router = express.Router();

/**
 * Get all monitored URLs for the logged-in user
 * GET /api/user-urls
 */
router.get('/', async (req, res) => {
  try {
    let { fromDate, toDate } = req.query;

    // Get user ID from the authenticated request
    const userId = req.user.id;
    
    // Get all URLs for this user
    const urls = await getUserMonitoredUrls(userId, fromDate, toDate);
    
    // Format response
    const formattedUrls = urls.map(url => ({
      id: url.id,
      url: url.url,
      frequency: url.frequency_hours === 24 ? 'daily' : 
                 url.frequency_hours === 12 ? '12hr' : '6hr',
      lastChecked: url.last_checked,
      createdAt: url.created_at,
      status: url.status,
      active: url.active,
      is_ecommerce: url.is_ecommerce,
      is_projuct_page: url.is_projuct_page,
      is_on_sale: url.is_on_sale,
      product_name: url.product_name,
      price: url.price,
      currency: url.currency,
      discount_percentage: url.discount_percentage,
      other_insights: url.other_insights,
      failed_attempts: url.failed_attempts,
    }));
    
    res.json({
      success: true,
      message: 'Fetched user URLs successfully',
      result: formattedUrls
    });
  } catch (error) {
    console.error('Error fetching user URLs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch URLs' });
  }
});

/**
 * Get all monitored URLs for the logged-in user
 * GET /api/user-url/analysis
 * Body: { urlId: string }
 */
router.get('/analysis', async (req, res ) => {
  try {
    let { urlId } = req.query;

    if (!urlId) {
      return res.status(400).json({ success: false, error: 'URL ID is required' });
    }

    // Get user ID from the authenticated request
    const userId = req.user.id;
    
    // Get all Analysis for this user
    const analysis = await getUserUrlAnalysisResults(userId, urlId);
    
    res.json({
      success: true,
      message: 'Fetched user URLs successfully',
      result: analysis
    });
  } catch (error) {
    console.error('Error fetching user Analysis:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch Analysis' });
  }
});

/**
 * Delete a URL from the user's monitored list
 * DELETE /api/user-urls/:urlId
 */
router.delete('/:urlId', async (req, res) => {
  try {
    const userId = req.user.id;
    const urlId = req.params.urlId;
    
    if (!urlId) {
      return res.status(400).json({ success: false, error: 'URL ID is required' });
    }
    
    console.log(userId, urlId);

    const result = await deleteUserUrl(userId, urlId);
    
    if (result.success) {
      return res.json({
        success: true,
        message: result.message
      });
    } else {
      return res.status(404).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error deleting URL:', error);
    res.status(500).json({ success: false, error: 'Failed to delete URL' });
  }
});

module.exports = router;

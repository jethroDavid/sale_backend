const express = require('express');
const { addMonitoredUrl } = require('../database/db');
const { addAvailabilityUrl } = require('../database/availabilityDb');
const router = express.Router();

// Convert human-readable frequency to hours
const frequencyMap = {
  '6hr': 6,
  '12hr': 12,
  'daily': 24
};

/**
 * Register a URL for monitoring
 * POST /api/register-url
 * Body: { url: string, frequency: '6hr'|'12hr'|'daily', email: string }
 */
router.post('/', async (req, res) => {
  try {
    let { url, frequency, email } = req.body;

    if (!frequency) {
      frequency = 'daily';
    }

    if (!email) {
      email = req.user.email;
    }
    
    // Validate inputs
    if (!url || !frequency || !email) {
      return res.status(400).json({ success: false, error: 'URL, frequency, and email are required' });
    }
    
    // Convert frequency to hours
    const frequencyHours = frequencyMap[frequency];
    if (!frequencyHours) {
      return res.status(400).json({ success: false, error: 'Invalid frequency. Use 6hr, 12hr, or daily' });
    }
    
    // Add URL to database with user association
    const result = await addMonitoredUrl(url, frequencyHours, email);
    
    res.status(201).json({
      success: true,
      message: 'URL registered successfully',
      result
    });
  } catch (error) {
    console.error('Error registering URL:', error);
    res.status(500).json({ success: false, error: 'Server error registering URL' });
  }
});

/**
 * Register a URL for monitoring
 * POST /api/register-url/availability
 * Body: { url: string, frequency: '6hr'|'12hr'|'daily', email: string }
 */
router.post('/availability', async (req, res) => {
  try {
    let { url, frequency, email } = req.body;

    if (!frequency) {
      frequency = 'daily';
    }

    if (!email) {
      email = req.user.email;
    }
    
    // Validate inputs
    if (!url || !frequency || !email) {
      return res.status(400).json({ success: false, error: 'URL, frequency, and email are required' });
    }
    
    // Convert frequency to hours
    const frequencyHours = frequencyMap[frequency];
    if (!frequencyHours) {
      return res.status(400).json({ success: false, error: 'Invalid frequency. Use 6hr, 12hr, or daily' });
    }
    
    // Add URL to database with user association
    const result = await addAvailabilityUrl(url, frequencyHours, email);
    
    res.status(201).json({
      success: true,
      message: 'URL registered successfully',
      result
    });
  } catch (error) {
    console.error('Error registering URL:', error);
    res.status(500).json({ success: false, error: 'Server error registering URL' });
  }
});

module.exports = router;

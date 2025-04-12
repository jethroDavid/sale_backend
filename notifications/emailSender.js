const nodemailer = require('nodemailer');
require('dotenv').config();
const { getUnsentSaleNotifications, markNotificationSent } = require('../database/db');

// Configure email transport
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.example.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

/**
 * Send sale notification email
 * @param {Object} saleData - Sale notification data
 * @returns {Promise<boolean>} - Whether email was sent successfully
 */
async function sendSaleEmail(saleData) {
  try {
    const {
      url,
      product_name,
      price,
      currency,
      discount_percentage,
      confidence,
      screenshot_path
    } = saleData;
    
    const subject = `SALE ALERT: ${product_name || 'Product'} on sale!`;
    
    // Build email HTML
    const html = `
      <h2>Sale Alert!</h2>
      <p>We've detected a sale on a product you're monitoring:</p>
      <ul>
        <li><strong>Product:</strong> ${product_name || 'Unknown'}</li>
        <li><strong>Price:</strong> ${currency || ''}${price || 'Unknown'}</li>
        <li><strong>Discount:</strong> ${discount_percentage ? discount_percentage + '%' : 'Unknown'}</li>
        <li><strong>Confidence:</strong> ${Math.round(confidence * 100)}%</li>
        <li><strong>URL:</strong> <a href="${url}">${url}</a></li>
      </ul>
      <p>Visit the website to see the sale!</p>
    `;
    
    // Send email
    const info = await transporter.sendMail({
      from: `"Sale Alert" <${process.env.EMAIL_FROM || 'noreply@example.com'}>`,
      to: process.env.EMAIL_TO || 'user@example.com',
      subject,
      html
    });
    
    console.log(`Email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

/**
 * Process unsent sale notifications
 * @returns {Promise<void>}
 */
async function processUnsentNotifications() {
  try {
    const notifications = await getUnsentSaleNotifications();
    
    if (notifications.length === 0) {
      console.log('No unsent notifications');
      return;
    }
    
    console.log(`Found ${notifications.length} unsent notifications`);
    
    for (const notification of notifications) {
      const emailSent = await sendSaleEmail(notification);
      
      if (emailSent) {
        // Mark as sent
        await markNotificationSent(notification.id);
      }
    }
    
    console.log('Notification processing complete');
  } catch (error) {
    console.error('Error processing notifications:', error);
  }
}

// If this file is run directly
if (require.main === module) {
  processUnsentNotifications()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { processUnsentNotifications };

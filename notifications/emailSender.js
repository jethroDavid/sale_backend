const nodemailer = require('nodemailer');
require('dotenv').config();
const { 
  getUnsentSaleNotifications, 
  markNotificationSent, 
  getUsersMonitoringUrl,
  deactivateMonitoredUrl 
} = require('../database/db');

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_SMTP_PORT || 587,
  secure: process.env.EMAIL_SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

/**
 * Send sale notification email to a specific user
 * @param {Object} saleData - Sale notification data
 * @param {string} userEmail - Email of the recipient
 * @param {string} userName - Name of the recipient (optional)
 * @returns {Promise<boolean>} - Whether email was sent successfully
 */
async function sendSaleEmail(saleData, userEmail, userName = '') {
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
    
    // Build email HTML with styling similar to the app
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${subject}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f7fa; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(90deg, #3880ff, #3dc2ff); padding: 20px; border-radius: 24px 24px 0 0; }
          .title { color: white; font-size: 28px; font-weight: 800; margin: 0; text-align: center; }
          .subtitle { color: rgba(255,255,255,0.9); font-size: 18px; text-align: center; margin-top: 10px; }
          .card { background: white; border-radius: 0 0 24px 24px; padding: 30px; box-shadow: 0 12px 28px rgba(0, 0, 0, 0.1); }
          .product-info { margin-bottom: 25px; }
          .product-name { font-size: 22px; font-weight: 700; margin-bottom: 15px; color: #333; }
          .info-item { display: flex; margin-bottom: 15px; align-items: center; }
          .info-label { font-weight: 600; width: 120px; color: #777; }
          .info-value { font-weight: 700; color: #333; }
          .price-value { font-size: 20px; color: #3880ff; }
          .discount { background: #ffece8; color: #ff4961; padding: 5px 10px; border-radius: 10px; font-weight: 700; }
          .confidence { background: #e0f7ff; color: #0cd1e8; padding: 5px 10px; border-radius: 10px; font-weight: 700; }
          .cta-button { display: block; background: linear-gradient(90deg, #3880ff, #3dc2ff); color: white !important; text-decoration: none; padding: 16px 20px; border-radius: 16px; font-weight: 700; text-align: center; margin-top: 25px; font-size: 16px; }
          .footer { margin-top: 20px; text-align: center; color: #777; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="title">Sale Alert!</h1>
            <p class="subtitle">Hello${userName ? ' ' + userName : ''}! We've detected a sale for you.</p>
          </div>
          <div class="card">
            <div class="product-info">
              <h2 class="product-name">${product_name || 'Product'}</h2>
              
              <div class="info-item">
                <span class="info-label">Price:</span>
                <span class="info-value price-value">${currency || ''}${price || 'Unknown'}</span>
              </div>
              
              <div class="info-item">
                <span class="info-label">Discount:</span>
                <span class="info-value"><span class="discount">${discount_percentage ? Math.round(discount_percentage) + '%' : 'N/A'}</span></span>
              </div>
            </div>
            
            <a href="${url}" class="cta-button">View This Deal Now</a>
            
            <div class="footer">
              <p>You're receiving this email because you're monitoring this product with SaleSavie.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    
    // Create email data for Nodemailer
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@example.com',
      to: userEmail,
      subject,
      html
    };

    console.log(`Sending email to ${userEmail}`);
    
    // Send email using Nodemailer
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`Email sent to ${userEmail}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`Error sending email to ${userEmail}:`, error);
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
    
    console.log(`Found ${notifications.length} unsent notifications`, notifications);
    
    for (const notification of notifications) {
      // Get all users monitoring this URL
      const urlId = notification.url_id;
      const users = await getUsersMonitoringUrl(urlId);
      
      if (users.length === 0) {
        console.log(`No users monitoring URL ID ${urlId}`);
        await markNotificationSent(notification.id);
        continue;
      }
      
      console.log(`Sending notification to ${users.length} users for URL ID ${urlId}`);
      
      let allEmailsSent = true;
      for (const user of users) {
        const emailSent = await sendSaleEmail(notification, user.email, user.name);
        if (!emailSent) {
          allEmailsSent = false;
        }
      }
      
      if (allEmailsSent) {
        // Mark as sent
        await markNotificationSent(notification.id);
        
        // Deactivate the monitored URL
        await deactivateMonitoredUrl(urlId);
        console.log(`Deactivated URL ID ${urlId} after sending notifications`);
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

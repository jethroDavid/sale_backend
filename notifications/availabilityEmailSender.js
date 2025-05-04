const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const {
  getUnsentAvailabilityNotifications, 
  markAvailabilityNotificationSent,
  getUsersMonitoringAvailabilityUrl,
  deactivateAvailabilityUrl
} = require('../database/availabilityDb');

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
 * Generate a random quirky donation message and button text
 * @returns {Object} Object containing message and buttonText
 */
function getRandomDonationMessage() {
  try {
    // Read donation messages from JSON file
    const filePath = path.join(__dirname, '../data/donationMessages.json');
    const donationData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Select a random message from the array
    return donationData[Math.floor(Math.random() * donationData.length)];
  } catch (error) {
    console.error('Error loading donation messages:', error);
    // Fallback in case of error
    return {
      message: "Our server hamsters need coffee to keep running on their wheels! A small donation helps keep those little paws moving and your deals flowing. 🐹☕",
      buttonText: "Feed a Hamster 🐹"
    };
  }
}

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
      stock_status,
    } = saleData;
    
    const subject = `AVAILABILITY ALERT: ${product_name || 'Product'} is now available!`;
    
    // Get a random donation message and button text
    const donation = getRandomDonationMessage();
    
    // Build email HTML with styling similar to the checker page
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${subject}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: linear-gradient(135deg, #f3f7fc 0%, #dce9fa 100%); color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(90deg, #4a3f9f, #ff577f); padding: 20px; border-radius: 24px 24px 0 0; position: relative; overflow: hidden; }
          .header::before { content: ''; position: absolute; top: -50px; right: -50px; width: 150px; height: 150px; border-radius: 50%; background: linear-gradient(45deg, rgba(56, 128, 255, 0.15), rgba(61, 194, 255, 0.15)); z-index: 0; }
          .title { color: white; font-size: 28px; font-weight: 800; margin: 0; text-align: center; position: relative; }
          .subtitle { color: rgba(255,255,255,0.9); font-size: 18px; text-align: center; margin-top: 10px; position: relative; }
          .card { background: white; border-radius: 0 0 24px 24px; padding: 30px; box-shadow: 0 12px 28px rgba(0, 0, 0, 0.1); position: relative; }
          .card::after { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 6px; background: linear-gradient(90deg, #3dc2ff, #5260ff); }
          .product-info { margin-bottom: 25px; }
          .product-name { font-size: 22px; font-weight: 700; margin-bottom: 15px; color: #333; position: relative; }
          .product-name::after { content: ''; position: absolute; bottom: -10px; left: 0; width: 60px; height: 4px; background: linear-gradient(90deg, #3dc2ff, #5260ff); border-radius: 4px; }
          .info-item { display: flex; margin-bottom: 15px; align-items: center; background: rgba(243, 247, 252, 0.8); padding: 12px 16px; border-radius: 14px; }
          .info-label { font-weight: 600; width: 120px; color: #777; }
          .info-value { font-weight: 700; color: #333; }
          .status-badge { background: #e0f7ff; color: #0cd1e8; padding: 8px 14px; border-radius: 10px; font-weight: 700; display: inline-block; box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12); }
          .cta-button { display: block; background: linear-gradient(90deg, #4a3f9f, #ff577f); color: white !important; text-decoration: none; padding: 16px 20px; border-radius: 14px; font-weight: 700; text-align: center; margin-top: 25px; font-size: 16px; box-shadow: 0 6px 16px rgba(56, 128, 255, 0.35); transition: all 0.3s ease; }
          .cta-button:hover { box-shadow: 0 8px 20px rgba(56, 128, 255, 0.45); transform: translateY(-3px); }
          .footer { margin-top: 30px; text-align: center; color: #777; font-size: 14px; padding: 20px; background: rgba(243, 247, 252, 0.8); border-radius: 14px; }
          @media (max-width: 500px) {
            .header, .card { border-radius: 16px; }
            .title { font-size: 24px; }
            .subtitle { font-size: 16px; }
            .product-name { font-size: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="title">Great News! It's Available!</h1>
            <p class="subtitle">Hey${userName ? ' ' + userName : ' there'}! That item you've been waiting for just came back in stock!</p>
          </div>
          <div class="card">
            <div class="product-info">
              <h2 class="product-name">${product_name || 'Product'}</h2>
              
              <div class="info-item">
                <span class="info-label">Status:</span>
                <span class="info-value">Back in Stock! 🎉</span>
              </div>
            </div>
            
            <a href="${url}" class="cta-button">Grab Yours Now!</a>
            
            <div class="footer">
              <p>You're getting this heads-up because you asked us to watch this product for you. 
              Hope this helps you snag what you've been waiting for!</p>
            </div>
            
            <div style="margin-top: 25px; padding: 15px; background: #fff8e1; border-radius: 12px; border-left: 4px solid #ffb300; text-align: center;">
              <p style="font-size: 15px; margin-bottom: 15px; color: #5f4b32;">
                <strong>Love our product alerts?</strong> ${donation.message}
              </p>
              <a href="https://www.paypal.com/ncp/payment/X53JZ9ZFAW79S" style="display: inline-block; background: #0070ba; color: white; padding: 10px 18px; border-radius: 20px; text-decoration: none; font-weight: bold; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                ${donation.buttonText}
              </a>
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
async function processUnsentAvailabilityNotifications() {
  try {
    const notifications = await getUnsentAvailabilityNotifications();
    
    if (notifications.length === 0) {
      console.log('No unsent notifications');
      return;
    }
    
    console.log(`Found ${notifications.length} unsent notifications`, notifications);
    
    for (const notification of notifications) {
      // Get all users monitoring this URL
      const urlId = notification.url_id;
      const users = await getUsersMonitoringAvailabilityUrl(urlId);
      
      if (users.length === 0) {
        console.log(`No users monitoring URL ID ${urlId}`);
        await markAvailabilityNotificationSent(notification.id);
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
        await markAvailabilityNotificationSent(notification.id);
        
        // Deactivate the monitored URL
        await deactivateAvailabilityUrl(urlId);
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
  processUnsentAvailabilityNotifications()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { processUnsentAvailabilityNotifications };

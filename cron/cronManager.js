const cron = require('node-cron');
const { processAllDueUrls } = require('../scheduler/processUrls');
const { processAllAvailabilityDueUrls } = require('../scheduler/processAvailabilityUrls');
const { processUnsentNotifications } = require('../notifications/emailSender');
const { processUnsentAvailabilityNotifications } = require('../notifications/availabilityEmailSender');

// Schedule URL processing every 5 minutes
const urlProcessingJob = cron.schedule('*/5 * * * *', async () => {
  console.log('Running scheduled URL processing job...');
  await processAllDueUrls();
  await processAllAvailabilityDueUrls();
});

// Schedule notification processing every 10 minutes
const notificationJob = cron.schedule('*/10 * * * *', async () => {
  console.log('Running scheduled notification job...');
  await processUnsentNotifications();
  await processUnsentAvailabilityNotifications();
});

// Start all jobs
function startAllJobs() {
  urlProcessingJob.start();
  notificationJob.start();
  console.log('All scheduled jobs started');

    // Run the jobs immediately for testing
    (async () => {
      console.log('Running URL processing job immediately for testing...');
      // await processAllDueUrls();
      // await processUnsentNotifications();
      await processAllAvailabilityDueUrls();
      await processUnsentAvailabilityNotifications();
    })();
}

// Stop all jobs
function stopAllJobs() {
  urlProcessingJob.stop();
  notificationJob.stop();
  console.log('All scheduled jobs stopped');
}

// If this file is run directly
if (require.main === module) {
  startAllJobs();
  
  // Handle process termination
  process.on('SIGINT', () => {
    stopAllJobs();
    process.exit(0);
  });
}

module.exports = { startAllJobs, stopAllJobs };

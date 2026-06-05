// backend/services/bullService.js

const { Queue } = require('bullmq');
require('dotenv').config();

// Redis connection configuration
// BullMQ uses Redis to store jobs
const connection = {
  host: process.env.UPSTASH_REDIS_HOST,
  port: process.env.UPSTASH_REDIS_PORT,
  password: process.env.UPSTASH_REDIS_PASSWORD,
  tls: {}  // Required for Upstash
};

// Create queue named email-scan
// All scan jobs go into this queue
const emailScanQueue = new Queue('email-scan', { connection });

// Add a new scan job to queue
const addScanJob = async (data) => {
  await emailScanQueue.add(
    'scan-gmail',  // Job name
    data,          // Job data { userId, gmailAddress }
    {
      attempts: 3,  // Retry 3 times if fails
      backoff: {
        type: 'exponential',
        delay: 5000  // Wait longer between each retry
      }
    }
  );
  console.log('Scan job added for:', data.gmailAddress);
};

module.exports = { addScanJob, emailScanQueue };
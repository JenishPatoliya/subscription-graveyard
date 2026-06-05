// backend/workers/emailWorker.js

const { Worker } = require('bullmq');
const supabase = require('../config/supabase');
const gmailService = require('../services/gmailService');
const { parseEmailForSubscription } = require('../services/aiService');
require('dotenv').config();

// Same Redis connection as queue
const connection = {
  host: process.env.UPSTASH_REDIS_HOST,
  port: process.env.UPSTASH_REDIS_PORT,
  password: process.env.UPSTASH_REDIS_PASSWORD,
  tls: {}
};

// Helper to pause execution
// Used to avoid hitting Gmail API too fast
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── MAIN JOB PROCESSOR ──────────────────────────────

// This function runs for every job in queue
const processJob = async (job) => {
  const { userId, gmailAddress } = job.data;
  console.log(`Starting scan for ${gmailAddress}`);

  try {
    // ── Get Gmail account from database ──
    const { data: gmailAccount } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('gmail_address', gmailAddress)
      .single();

    if (!gmailAccount) {
      throw new Error('Gmail account not found in database');
    }

    // ── Create Gmail client with stored tokens ──
    const gmail = gmailService.createGmailClient(
      gmailAccount.access_token,
      gmailAccount.refresh_token
    );

    // ── Search for receipt emails ──
    const messages = await gmailService.searchReceiptEmails(gmail, 500);
    console.log(`Found ${messages.length} potential receipt emails`);

    let emailsScanned = 0;

    // ── Process emails in batches of 10 ──
    // Processing all at once crashes the app
    const batchSize = 10;
    
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);

      // Process batch emails simultaneously
      await Promise.all(batch.map(async (message) => {
        try {
          // ── Skip already processed emails ──
          // gmail_message_id is unique for each email
          const { data: existingReceipt } = await supabase
            .from('receipts')
            .select('id')
            .eq('gmail_message_id', message.id)
            .single();

          // Already processed this email before — skip it
          if (existingReceipt) return;

          // ── Get email content ──
          const emailData = await gmailService.getEmailContent(
            gmail,
            message.id
          );

          // ── Send to AI for parsing ──
          const result = await parseEmailForSubscription(emailData);

          // Only save if AI found subscription info
          if (result.isSubscription && result.serviceName && result.amount) {
            
            // ── Check if subscription already exists ──
            // Same service might have multiple receipts
            const { data: existingSub } = await supabase
              .from('subscriptions')
              .select('*')
              .eq('user_id', userId)
              .ilike('service_name', result.serviceName)
              .single();

            if (existingSub) {
              // ── Update existing subscription ──
              await supabase
                .from('subscriptions')
                .update({
                  total_spent: existingSub.total_spent + result.amount,
                  total_receipts: existingSub.total_receipts + 1,
                  // Update last receipt date if newer
                  last_receipt_date: result.receiptDate > existingSub.last_receipt_date
                    ? result.receiptDate
                    : existingSub.last_receipt_date,
                  next_renewal_date: result.renewalDate || existingSub.next_renewal_date,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingSub.id);

              // Save this receipt
              await supabase.from('receipts').insert({
                user_id: userId,
                subscription_id: existingSub.id,
                gmail_message_id: message.id,
                amount: result.amount,
                receipt_date: result.receiptDate,
                raw_subject: emailData.subject
              });

            } else {
              // ── Create new subscription ──
              const { data: newSub } = await supabase
                .from('subscriptions')
                .insert({
                  user_id: userId,
                  source_gmail: gmailAddress,
                  service_name: result.serviceName,
                  amount: result.amount,
                  currency: result.currency || 'INR',
                  category: result.category,
                  first_receipt_date: result.receiptDate,
                  last_receipt_date: result.receiptDate,
                  next_renewal_date: result.renewalDate,
                  total_receipts: 1,
                  total_spent: result.amount,
                  cancel_url: result.cancelUrl
                })
                .select()
                .single();

              if (newSub) {
                // Save first receipt
                await supabase.from('receipts').insert({
                  user_id: userId,
                  subscription_id: newSub.id,
                  gmail_message_id: message.id,
                  amount: result.amount,
                  receipt_date: result.receiptDate,
                  raw_subject: emailData.subject
                });

                // Schedule renewal alert if date found
                if (result.renewalDate) {
                  const alertDate = new Date(result.renewalDate);
                  alertDate.setDate(alertDate.getDate() - 3);

                  await supabase.from('alerts').insert({
                    user_id: userId,
                    subscription_id: newSub.id,
                    alert_date: alertDate.toISOString().split('T')[0],
                    days_before: 3
                  });
                }
              }
            }
          }

          emailsScanned++;

        } catch (err) {
          // Don't let one email failure stop entire scan
          console.error('Error processing email:', err.message);
        }
      }));

      // Update progress in database
      // Frontend polls this to show progress
      await supabase
        .from('gmail_accounts')
        .update({ emails_scanned: emailsScanned })
        .eq('id', gmailAccount.id);

      // Pause 1 second between batches
      // Prevents hitting Gmail API rate limits
      await sleep(1000);
    }

    // ── Mark scan as complete ──
    await supabase
      .from('gmail_accounts')
      .update({
        last_scanned: new Date().toISOString(),
        emails_scanned: emailsScanned
      })
      .eq('id', gmailAccount.id);

    console.log(`Scan complete for ${gmailAddress}`);
    console.log(`Emails scanned: ${emailsScanned}`);

  } catch (err) {
    console.error('Worker job failed:', err);
    throw err;  // Throwing causes BullMQ to retry
  }
};

// ─── START WORKER ────────────────────────────────────

// Worker listens to email-scan queue
// concurrency 2 means process 2 jobs at same time
const worker = new Worker('email-scan', processJob, {
  connection,
  concurrency: 2
});

// Log success
worker.on('completed', job => {
  console.log(`Job ${job.id} completed successfully`);
});

// Log failures
worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

console.log('Email scan worker is running...');

module.exports = worker;
const { Worker } = require('bullmq')
const { Redis } = require('ioredis')
const supabase = require('../config/supabase')
const gmailService = require('../services/gmailService')
const { parseEmailForSubscription } = require('../services/aiService')
require('dotenv').config()

const connection = new Redis({
  host: process.env.UPSTASH_REDIS_HOST,
  port: parseInt(process.env.UPSTASH_REDIS_PORT || '6379', 10),
  password: process.env.UPSTASH_REDIS_PASSWORD,
  tls: {},
  maxRetriesPerRequest: null
})

connection.on('connect', () => {
  console.log('Redis connected successfully')
})

connection.on('error', (err) => {
  console.log('Redis connection error:', err.message)
})

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const processJob = async (job) => {
  const { userId, gmailAddress } = job.data
  console.log(`Starting real Gmail scan for ${gmailAddress}`)

  // Step 1 — Get stored tokens
  const { data: gmailAccount } = await supabase
    .from('gmail_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('gmail_address', gmailAddress)
    .single()

  if (!gmailAccount) {
    throw new Error('Gmail account not found')
  }

  let emailsScanned = 0
  let subscriptionsFound = 0

  try {
    // Step 2 — Create Gmail client with tokens
    const gmail = gmailService.createGmailClient(
      gmailAccount.access_token,
      gmailAccount.refresh_token
    )

    // Step 3 — Search Gmail
    // Gmail filters on their servers
    // Only returns billing emails
    const messages = await gmailService.searchReceiptEmails(gmail)
    
    console.log(`Processing ${messages.length} emails for ${gmailAddress}`)

    // Step 4 — Process in batches of 5
    // Small batches = safe and reliable
    const batchSize = 5

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize)

      for (const message of batch) {
        try {
          // Skip if already processed this email
          const { data: existing } = await supabase
            .from('receipts')
            .select('id')
            .eq('gmail_message_id', message.id)
            .single()

          if (existing) {
            emailsScanned++
            continue
          }

          // Get email content
          // Only gets subject, sender, date, snippet
          // Never reads full email body
          const emailData = await gmailService.getEmailContent(
            gmail,
            message.id
          )

          // After getting email content
          console.log('---')
          console.log('Subject:', emailData.subject)
          console.log('Snippet:', emailData.snippet)

          // Send to AI for parsing
          const result = await parseEmailForSubscription(emailData)

          // Block Udemy and Coursera course purchases or promotional emails
          if (result.isSubscription && result.serviceName) {
            const nameLower = result.serviceName.toLowerCase();
            if (nameLower.includes('udemy') || nameLower.includes('coursera')) {
              const textToCheck = (emailData.subject + ' ' + (emailData.body || '')).toLowerCase();
              const hasBillingConfirmation = ['receipt', 'invoice', 'charged', 'billed', 'payment success', 'transaction successful', 'paid'].some(w => textToCheck.includes(w));
              const hasPromoKeywords = ['save', 'upgrade', 'discount', 'grow', 'coupon', 'try', 'offer'].some(w => textToCheck.includes(w));
              
              // If it contains "course", "order", promo keywords, or lacks absolute billing terms, set to false
              if (!hasBillingConfirmation || hasPromoKeywords || textToCheck.includes('course') || textToCheck.includes('order')) {
                result.isSubscription = false;
                console.log(`[Filter] Automatically ignored Udemy/Coursera order/promo: "${emailData.subject}"`);
              }
            }
          }

          // After AI parsing
          console.log('AI Result:', JSON.stringify(result))
          console.log('---')

          if (result.isSubscription && result.serviceName && result.amount) {
            // Estimate renewal date if not explicitly found
            if (!result.renewalDate) {
              const baseDate = result.receiptDate ? new Date(result.receiptDate) : new Date();
              baseDate.setMonth(baseDate.getMonth() + 1);
              result.renewalDate = baseDate.toISOString().split('T')[0];
            }

            // Safety check 1: Amount must exist and be reasonable
            if (!result.amount || result.amount <= 0 || result.amount > 50000) {
              console.log('Invalid amount, skipping:', result.amount)
              continue
            }

            // Safety check 2: Renewal date must be in future or recent past (not more than 1 year ago)
            if (result.renewalDate) {
              const renewal = new Date(result.renewalDate)
              const oneYearAgo = new Date()
              oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
              
              if (renewal < oneYearAgo) {
                console.log('Renewal date too old, skipping:', result.renewalDate)
                continue
              }
            }

            // Safety check 3: Block known non-subscription senders
            const blockedSenders = [
              'reddit',
              'quora', 
              'twitter',
              'instagram',
              'facebook',
              'linkedin notification',
              'cashfree',
              'razorpay'
            ]
            
            const fromLower = emailData.from.toLowerCase()
            const isBlocked = blockedSenders.some(s => fromLower.includes(s))
            
            if (isBlocked) {
              console.log('Blocked sender, skipping:', emailData.from)
              continue
            }

            // All checks passed - save subscription
            console.log('SAVING:', result.serviceName, result.amount)
            
            // Check if subscription already exists
            const { data: existingSubs } = await supabase
              .from('subscriptions')
              .select('*')
              .eq('user_id', userId)
              .ilike('service_name', `%${result.serviceName}%`);

            const existingSub = existingSubs && existingSubs.length > 0 ? existingSubs[0] : null;

            if (existingSub) {
              // Update existing subscription
              await supabase
                .from('subscriptions')
                .update({
                  total_spent: Number(existingSub.total_spent) + Number(result.amount),
                  total_receipts: existingSub.total_receipts + 1,
                  last_receipt_date: result.receiptDate || existingSub.last_receipt_date,
                  next_renewal_date: result.renewalDate || existingSub.next_renewal_date,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingSub.id)

              // Save receipt record
              await supabase.from('receipts').insert({
                user_id: userId,
                subscription_id: existingSub.id,
                gmail_message_id: message.id,
                amount: result.amount,
                receipt_date: result.receiptDate,
                raw_subject: emailData.subject
              })

            } else {
              // Create new subscription
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
                .single()

              if (newSub) {
                // Save receipt
                await supabase.from('receipts').insert({
                  user_id: userId,
                  subscription_id: newSub.id,
                  gmail_message_id: message.id,
                  amount: result.amount,
                  receipt_date: result.receiptDate,
                  raw_subject: emailData.subject
                })

                // Schedule renewal alert
                if (result.renewalDate) {
                  const alertDate = new Date(result.renewalDate)
                  alertDate.setDate(alertDate.getDate() - 3)

                  await supabase.from('alerts').insert({
                    user_id: userId,
                    subscription_id: newSub.id,
                    alert_date: alertDate.toISOString().split('T')[0],
                    days_before: 3
                  })
                }

                subscriptionsFound++
                console.log(`New subscription found: ${result.serviceName} ₹${result.amount}`)
              }
            }
          }

          emailsScanned++

        } catch (err) {
          // IMPORTANT - catch error and CONTINUE
          // Do not let one email stop others
          console.log('Error on email, skipping:', err.message)
          emailsScanned++
          continue  // ← This is critical
        }

        // Small delay between each email
        // Prevents hitting Gmail API too fast
        await sleep(300)
      }

      // Update progress after each batch
      await supabase
        .from('gmail_accounts')
        .update({ emails_scanned: emailsScanned })
        .eq('id', gmailAccount.id)

      console.log(`Progress: ${emailsScanned}/${messages.length} emails processed`)

      // Pause between batches
      await sleep(500)
    }

    // --- POST-SCAN CLEANUP ---
    try {
      const { data: subsToCleanup } = await supabase
        .from('subscriptions')
        .select('id, service_name, total_receipts')
        .eq('user_id', userId)
        .lte('total_receipts', 1);

      if (subsToCleanup) {
        for (const sub of subsToCleanup) {
          const name = sub.service_name.toLowerCase();
          if (name.includes('udemy') || name.includes('coursera')) {
            // Delete receipts first
            await supabase.from('receipts').delete().eq('subscription_id', sub.id);
            // Delete subscription
            await supabase.from('subscriptions').delete().eq('id', sub.id);
            subscriptionsFound = Math.max(0, subscriptionsFound - 1);
            console.log(`[Cleanup] Removed single-receipt course purchase: ${sub.service_name}`);
          }
        }
      }
    } catch (cleanupErr) {
      console.error('Post-scan cleanup failed:', cleanupErr.message);
    }
  } catch (scanErr) {
    console.error(`Gmail scanning encountered an error:`, scanErr.message)
  } finally {
    // Always mark scan complete in the database to prevent the frontend from getting stuck
    await supabase
      .from('gmail_accounts')
      .update({
        last_scanned: new Date().toISOString(),
        emails_scanned: emailsScanned
      })
      .eq('id', gmailAccount.id)

    console.log(`Scan complete!`)
    console.log(`Emails processed: ${emailsScanned}`)
    console.log(`New subscriptions found: ${subscriptionsFound}`)
  }
}

// Start worker
const worker = new Worker('email-scan', processJob, {
  connection,
  concurrency: 1
})

worker.on('completed', job => {
  console.log(`Scan job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  console.error(`Scan job ${job.id} failed:`, err.message)
})

console.log('Email worker running and waiting for jobs...')

module.exports = worker
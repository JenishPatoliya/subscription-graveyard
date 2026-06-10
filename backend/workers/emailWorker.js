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
  
  console.log('=== SCAN STARTED ===')
  console.log('Gmail:', gmailAddress)

  const { data: gmailAccount } = await supabase
    .from('gmail_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('gmail_address', gmailAddress)
    .single()

  if (!gmailAccount) {
    console.log('Gmail account not found in database')
    return
  }

  let emailsScanned = 0
  let subscriptionsFound = 0

  try {
    const gmail = gmailService.createGmailClient(
      gmailAccount.access_token,
      gmailAccount.refresh_token
    )

    const messages = await gmailService.searchReceiptEmails(gmail)
    console.log(`Processing ${messages.length} emails`)

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]
      
      try {
        console.log(`Email ${i + 1} of ${messages.length}`)

        // Get email content
        const emailData = await gmailService.getEmailContent(
          gmail,
          message.id
        )

        console.log('Subject:', emailData.subject)

        // Parse with AI
        const result = await parseEmailForSubscription(emailData)
        console.log('AI Result:', result.isSubscription, result.serviceName, result.amount)

        // Only save if valid subscription
        if (
          result.isSubscription === true &&
          result.serviceName &&
          result.amount &&
          result.amount > 0 &&
          result.amount < 50000
        ) {
          // Check if subscription already exists
          const { data: existing } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .ilike('service_name', `%${result.serviceName}%`)
            .maybeSingle()

          if (existing) {
            // Update existing
            await supabase
              .from('subscriptions')
              .update({
                total_spent: Number(existing.total_spent) + Number(result.amount),
                total_receipts: existing.total_receipts + 1,
                last_receipt_date: result.receiptDate || existing.last_receipt_date,
                next_renewal_date: result.renewalDate || existing.next_renewal_date,
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id)

            // Save receipt only if not duplicate
            const { data: existingReceipt } = await supabase
              .from('receipts')
              .select('id')
              .eq('gmail_message_id', message.id)
              .maybeSingle()

            if (!existingReceipt) {
              await supabase.from('receipts').insert({
                user_id: userId,
                subscription_id: existing.id,
                gmail_message_id: message.id,
                amount: result.amount,
                receipt_date: result.receiptDate,
                raw_subject: emailData.subject
              })
            }

            console.log('Updated:', existing.service_name)

          } else {
            // Create new subscription
            const { data: newSub, error: subError } = await supabase
              .from('subscriptions')
              .insert({
                user_id: userId,
                source_gmail: gmailAddress,
                service_name: result.serviceName,
                amount: result.amount,
                currency: result.currency || 'INR',
                category: result.category || 'Other',
                first_receipt_date: result.receiptDate,
                last_receipt_date: result.receiptDate,
                next_renewal_date: result.renewalDate,
                total_receipts: 1,
                total_spent: result.amount,
                cancel_url: result.cancelUrl
              })
              .select()
              .single()

            if (subError) {
              console.log('Save error:', subError.message)
            } else if (newSub) {
              // Save receipt
              await supabase.from('receipts').insert({
                user_id: userId,
                subscription_id: newSub.id,
                gmail_message_id: message.id,
                amount: result.amount,
                receipt_date: result.receiptDate,
                raw_subject: emailData.subject
              })

              // Schedule alert
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
              console.log('SAVED:', result.serviceName, '₹' + result.amount)
            }
          }
        }

        emailsScanned++

      } catch (err) {
        console.log('Email error, skipping:', err.message)
        emailsScanned++
      }

      // Update progress
      await supabase
        .from('gmail_accounts')
        .update({ emails_scanned: emailsScanned })
        .eq('id', gmailAccount.id)

      await sleep(400)
    }

  } catch (err) {
    console.error('Scan error:', err.message)
  } finally {
    await supabase
      .from('gmail_accounts')
      .update({
        last_scanned: new Date().toISOString(),
        emails_scanned: emailsScanned
      })
      .eq('id', gmailAccount.id)

    console.log('=== SCAN COMPLETE ===')
    console.log('Emails processed:', emailsScanned)
    console.log('New subscriptions:', subscriptionsFound)
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
const Groq = require('groq-sdk')
require('dotenv').config()

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// Known Indian subscription services
// AI uses this as reference
const INDIAN_SERVICES = [
  'Netflix', 'Spotify', 'Amazon Prime', 'Hotstar',
  'YouTube Premium', 'Google One', 'iCloud',
  'ChatGPT', 'Canva', 'Adobe', 'Notion',
  'NordVPN', 'LinkedIn', 'GitHub', 'Dropbox',
  'Microsoft 365', 'Zoom', 'Slack', 'Figma',
  'Midjourney', 'Claude', 'Grammarly',
  'Swiggy One',
  'Zomato Pro', 'Jio', 'Airtel', 'BSNL',
  'MX Player', 'SonyLIV', 'ZEE5', 'Voot'
]

const CANCEL_URLS = {
  'netflix': 'https://www.netflix.com/cancelplan',
  'spotify': 'https://www.spotify.com/account/subscription',
  'amazon': 'https://www.amazon.in/mc/pipelines/cancellation',
  'hotstar': 'https://www.hotstar.com/in/subscribe',
  'youtube': 'https://www.youtube.com/paid_memberships',
  'google': 'https://myaccount.google.com/payments-and-subscriptions',
  'icloud': 'https://support.apple.com/billing',
  'chatgpt': 'https://chat.openai.com/account/billing',
  'openai': 'https://platform.openai.com/account/billing',
  'canva': 'https://www.canva.com/settings/purchase',
  'adobe': 'https://account.adobe.com/plans',
  'notion': 'https://www.notion.so/profile/billing',
  'nordvpn': 'https://my.nordaccount.com/subscriptions',
  'linkedin': 'https://www.linkedin.com/premium/cancel',
  'github': 'https://github.com/settings/billing',
  'dropbox': 'https://www.dropbox.com/account/plan',
  'microsoft': 'https://account.microsoft.com/services',
  'zoom': 'https://zoom.us/billing',
  'slack': 'https://slack.com/account/settings',
  'figma': 'https://www.figma.com/settings',
  'grammarly': 'https://account.grammarly.com/subscription',
  'coursera': 'https://www.coursera.org/account-settings',
  'udemy': 'https://www.udemy.com/account-settings',
  'sonyliv': 'https://www.sonyliv.com/settings',
  'zee5': 'https://www.zee5.com/subscription',
  'mxplayer': 'https://www.mxplayer.in/subscription'
}

const getCancelUrl = (serviceName) => {
  if (!serviceName) return null
  const lower = serviceName.toLowerCase()
  for (const [key, url] of Object.entries(CANCEL_URLS)) {
    if (lower.includes(key)) return url
  }
  return null
}

const getCategory = (serviceName) => {
  if (!serviceName) return 'Other'
  const lower = serviceName.toLowerCase()
  if (['canva', 'adobe', 'figma'].some(s => lower.includes(s)))
    return 'Design'
  if (['spotify', 'apple music', 'youtube music', 'mxplayer'].some(s => lower.includes(s)))
    return 'Music'
  if (['netflix', 'hotstar', 'prime video', 'zee5', 'sony', 'voot'].some(s => lower.includes(s)))
    return 'Entertainment'
  if (['chatgpt', 'openai', 'claude', 'gemini', 'midjourney', 'grammarly'].some(s => lower.includes(s)))
    return 'AI Tools'
  if (['notion', 'evernote', 'todoist', 'slack', 'zoom'].some(s => lower.includes(s)))
    return 'Productivity'
  if (['nordvpn', 'expressvpn', 'surfshark'].some(s => lower.includes(s)))
    return 'Security'
  if (['github', 'gitlab', 'vercel', 'aws', 'digitalocean'].some(s => lower.includes(s)))
    return 'Developer Tools'
  if (['linkedin', 'coursera', 'udemy'].some(s => lower.includes(s)))
    return 'Career'
  if (['google one', 'icloud', 'dropbox'].some(s => lower.includes(s)))
    return 'Storage'
  return 'Other'
}

const parseEmailForSubscription = async (emailData) => {
  const { subject, from, date, snippet, body } = emailData

  const fullContent = body || snippet

  // PRE-CHECKS BEFORE CALLING AI
  // These save API calls and are 100% accurate

  const subjectLower = subject.toLowerCase()
  const fromLower = from.toLowerCase()
  const contentLower = fullContent.toLowerCase()

  // Block 1 - Bad senders immediately
  const blockedSenders = [
    'reddit.com',
    'redditmail.com',
    'quora.com',
    'twitter.com',
    'instagram.com',
    'facebook.com',
    'linkedin.com',
    'youtube.com/notification',
    'students.udemy.com',
    'hello@udemy',
    'noreply@udemy',
    'medium.com',
    'substack.com'
  ]

  for (const blocked of blockedSenders) {
    if (fromLower.includes(blocked)) {
      console.log('BLOCKED SENDER:', from)
      return { isSubscription: false }
    }
  }

  // Block 2 - Bad subject keywords immediately
  const blockedSubjects = [
    'payment failed',
    'payment declined',
    'payment issue',
    'declined',
    'suspended due to',
    'needs attention',
    'update payment',
    'subscription suspended',
    'subscription canceled',
    'subscription cancelled',
    'has been canceled',
    'has been cancelled',
    'changes to your',
    'save with',
    'invest in',
    'limited time',
    'special offer',
    'discount',
    'unsubscribe',
    'digest',
    'newsletter',
    'weekly roundup',
    'daily digest',
    'verify your',
    'confirm your email',
    'welcome to',
    'getting started',
    'tips for',
    'introducing'
  ]

  for (const blocked of blockedSubjects) {
    if (subjectLower.includes(blocked)) {
      console.log('BLOCKED SUBJECT:', subject)
      return { isSubscription: false }
    }
  }

  // Block 3 - Payment gateway emails without renewal
  // Cashfree, Razorpay = one time payments
  const oneTimeGateways = [
    'cashfree',
    'razorpay',
    'instamojo',
    'payu',
    'ccavenue'
  ]

  for (const gateway of oneTimeGateways) {
    if (fromLower.includes(gateway) || contentLower.includes(gateway)) {
      // These are payment gateways
      // Almost always one time payments
      // Check if renewal date exists in content
      const hasRenewal =
        contentLower.includes('next billing') ||
        contentLower.includes('renewal date') ||
        contentLower.includes('renews on') ||
        contentLower.includes('next payment') ||
        contentLower.includes('auto-renew') ||
        contentLower.includes('monthly plan') ||
        contentLower.includes('annual plan')

      if (!hasRenewal) {
        console.log('ONE TIME PAYMENT GATEWAY:', gateway)
        return { isSubscription: false }
      }
    }
  }

  // Block 4 - Must have payment success signal
  const hasSuccess =
    contentLower.includes('payment successful') ||
    contentLower.includes('paid successfully') ||
    contentLower.includes('payment confirmed') ||
    contentLower.includes('thank you for your payment') ||
    contentLower.includes('subscription renewed') ||
    contentLower.includes('subscription active') ||
    (contentLower.includes('your subscription') && contentLower.includes('renewed')) ||
    contentLower.includes('receipt') ||
    contentLower.includes('invoice') ||
    contentLower.includes('successfully processed') ||
    contentLower.includes('payment method ending') ||
    contentLower.includes('processed your payment') ||
    contentLower.includes('billing event') ||
    contentLower.includes('charged') ||
    contentLower.includes('billed') ||
    contentLower.includes('transaction successful')

  if (!hasSuccess) {
    console.log('NO SUCCESS SIGNAL:', subject)
    return { isSubscription: false }
  }

  // Block 5 - Must have an amount
  const amountRegex = /₹\s*[\d,]+|rs\.?\s*[\d,]+|inr\s*[\d,]+|\$\s*[\d.]+|usd\s*[\d.]+|[€£]\s*[\d.,]+|(?:total|amount|price|charge|charged|price of|sum of)\s*(?:of|is|was|to)?\s*[\d,.]+/i
  const hasAmount = amountRegex.test(fullContent)

  if (!hasAmount) {
    console.log('NO AMOUNT FOUND:', subject)
    return { isSubscription: false }
  }

  // PASSED ALL CHECKS - Now ask AI
  console.log('SENDING TO AI:', subject)

  const prompt = `
Analyze this payment email carefully.

Subject: ${subject}
From: ${from}
Full Content: ${fullContent.substring(0, 1500)}

This email passed basic checks - it has a payment amount
and success signal. Now determine if it is RECURRING.

Answer these questions:
Q1: Is there a "next billing date" or "renewal date" mentioned?
Q2: Does it mention "monthly" or "annual" subscription?
Q3: Is this a one-time purchase or recurring charge?

Return ONLY this JSON:
{
  "isSubscription": true or false,
  "serviceName": "exact service name or null",
  "amount": exact number like 119 or null,
  "currency": "INR or USD or null",
  "receiptDate": "YYYY-MM-DD or null",
  "renewalDate": "YYYY-MM-DD or null"
}

Rules:
- isSubscription TRUE only if recurring payment confirmed
- amount must be exact number found in email
- renewalDate must be explicitly stated in email if present (return null if not mentioned)
- One time course or product purchase = false
`

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0
    })

    const text = response.choices[0].message.content.trim()
    const cleaned = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    console.log('AI says:', parsed.isSubscription, 'for:', subject)

    if (parsed.isSubscription && parsed.serviceName) {
      parsed.category = getCategory(parsed.serviceName)
      parsed.cancelUrl = getCancelUrl(parsed.serviceName)
    }

    return parsed

  } catch (err) {
    console.error('AI error:', err.message)
    return { isSubscription: false }
  }
}

module.exports = { parseEmailForSubscription }
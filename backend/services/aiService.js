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
  'Coursera', 'Udemy', 'Swiggy One',
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
  const { subject, from, date, snippet } = emailData

  const prompt = `
You are analyzing an email to find subscription payment info.

Email Subject: ${subject}
Email From: ${from}
Email Date: ${date}
Email Preview: ${snippet}

Known subscription services for reference:
${INDIAN_SERVICES.join(', ')}

Return ONLY a JSON object. No extra text. No markdown.

{
  "isSubscription": true or false,
  "serviceName": "exact service name or null",
  "amount": number only no symbols or null,
  "currency": "INR or USD or null",
  "billingCycle": "monthly or yearly or null",
  "receiptDate": "YYYY-MM-DD or null",
  "renewalDate": "YYYY-MM-DD or null"
}

Rules:
- isSubscription true only if this is a payment receipt or renewal notice
- Extract exact service name as it appears
- Amount must be number only like 499 not Rs.499 or ₹499
- If amount is in USD multiply by 83 for INR equivalent
- receiptDate is when payment was made
- renewalDate is when next payment is due
- Return null for uncertain fields
- If this is just a promotional email not a receipt return isSubscription false
`

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.1
    })

    const text = response.choices[0].message.content.trim()
    
    // Clean any markdown
    const cleaned = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    if (parsed.isSubscription && parsed.serviceName) {
      parsed.category = getCategory(parsed.serviceName)
      parsed.cancelUrl = getCancelUrl(parsed.serviceName)
    }

    return parsed

  } catch (err) {
    console.error('AI parsing error:', err.message)
    return { isSubscription: false }
  }
}

module.exports = { parseEmailForSubscription }
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

  const prompt = `
You are a strict payment receipt detector.

Email Subject: ${subject}
Email From: ${from}
Email Preview: ${snippet}

STRICT RULES - return isSubscription TRUE only if:
1. Email contains an actal payment amount clearly stated
2. Email confirms payment was SUCCESSFUL not failed
3. Email shows a RECURRING billing date not one time
4. All three must be present: amount + success + renewal date

Return isSubscription FALSE if:
- Payment was declined or failed
- This is a one time purchase no renewal date
- This is a notification or policy change email
- This is a marketing or promotional email
- Amount is not clearly stated in email
- Email is a Reddit or social media notification
- No explicit renewal date mentioned

Return ONLY this JSON no extra text:
{
  "isSubscription": true or false,
  "serviceName": "exact name or null",
  "amount": exact number from email or null,
  "currency": "INR or USD or null",
  "receiptDate": "YYYY-MM-DD or null",
  "renewalDate": "YYYY-MM-DD or null"
}

If ANY doubt return isSubscription false.
Better to miss than wrong detect.
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
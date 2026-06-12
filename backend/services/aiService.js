// backend/services/aiService.js
// Hybrid subscription detector: Rule-based first, AI fallback

const Groq = require('groq-sdk')
require('dotenv').config()

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ═══════════════════════════════════════════════════════════════
// KNOWN SERVICES DATABASE (50+ services)
// Keywords are matched against subject + body + from
// ═══════════════════════════════════════════════════════════════

const KNOWN_SERVICES = [
  // Entertainment
  { name: 'Netflix', keywords: ['netflix'], category: 'Entertainment', cancelUrl: 'https://www.netflix.com/cancelplan' },
  { name: 'Amazon Prime', keywords: ['amazon prime', 'prime membership', 'prime video'], category: 'Entertainment', cancelUrl: 'https://www.amazon.in/gp/primecentral' },
  { name: 'Disney+ Hotstar', keywords: ['hotstar', 'disney+', 'disney plus'], category: 'Entertainment', cancelUrl: 'https://www.hotstar.com/account/subscription' },
  { name: 'Sony LIV', keywords: ['sonyliv', 'sony liv'], category: 'Entertainment', cancelUrl: 'https://www.sonyliv.com' },
  { name: 'ZEE5', keywords: ['zee5'], category: 'Entertainment', cancelUrl: 'https://www.zee5.com' },
  { name: 'Hulu', keywords: ['hulu'], category: 'Entertainment', cancelUrl: 'https://secure.hulu.com/account' },
  { name: 'HBO Max', keywords: ['hbo max', 'hbo'], category: 'Entertainment', cancelUrl: 'https://www.hbomax.com' },
  { name: 'Crunchyroll', keywords: ['crunchyroll'], category: 'Entertainment', cancelUrl: 'https://www.crunchyroll.com/account' },
  { name: 'JioCinema', keywords: ['jiocinema', 'jio cinema'], category: 'Entertainment', cancelUrl: 'https://www.jiocinema.com' },

  // Music
  { name: 'Spotify Premium', keywords: ['spotify'], category: 'Music', cancelUrl: 'https://www.spotify.com/account/subscription' },
  { name: 'YouTube Premium', keywords: ['youtube premium', 'youtube music', 'yt premium'], category: 'Music', cancelUrl: 'https://www.youtube.com/paid_memberships' },
  { name: 'Apple Music', keywords: ['apple music'], category: 'Music', cancelUrl: 'https://support.apple.com/en-in/HT202039' },
  { name: 'JioSaavn', keywords: ['jiosaavn', 'jio saavn', 'saavn'], category: 'Music', cancelUrl: 'https://www.jiosaavn.com' },
  { name: 'Gaana Plus', keywords: ['gaana'], category: 'Music', cancelUrl: 'https://gaana.com' },
  { name: 'Wynk Music', keywords: ['wynk'], category: 'Music', cancelUrl: 'https://wynk.in' },

  // AI Tools
  { name: 'ChatGPT Plus', keywords: ['chatgpt', 'openai', 'chat gpt'], category: 'AI Tools', cancelUrl: 'https://chat.openai.com/account/billing' },
  { name: 'Claude Pro', keywords: ['claude', 'anthropic'], category: 'AI Tools', cancelUrl: 'https://claude.ai/settings' },
  { name: 'Gemini Advanced', keywords: ['gemini advanced', 'google one ai'], category: 'AI Tools', cancelUrl: 'https://one.google.com' },
  { name: 'Midjourney', keywords: ['midjourney'], category: 'AI Tools', cancelUrl: 'https://www.midjourney.com/account' },
  { name: 'Grammarly', keywords: ['grammarly'], category: 'AI Tools', cancelUrl: 'https://account.grammarly.com/subscription' },
  { name: 'Jasper AI', keywords: ['jasper ai', 'jasper.ai'], category: 'AI Tools', cancelUrl: 'https://www.jasper.ai' },
  { name: 'Perplexity Pro', keywords: ['perplexity'], category: 'AI Tools', cancelUrl: 'https://www.perplexity.ai' },

  // Design
  { name: 'Canva Pro', keywords: ['canva'], category: 'Design', cancelUrl: 'https://www.canva.com/settings/purchase' },
  { name: 'Adobe Creative Cloud', keywords: ['adobe', 'creative cloud'], category: 'Design', cancelUrl: 'https://account.adobe.com/plans' },
  { name: 'Figma', keywords: ['figma'], category: 'Design', cancelUrl: 'https://www.figma.com/settings' },

  // Productivity
  { name: 'Notion', keywords: ['notion'], category: 'Productivity', cancelUrl: 'https://www.notion.so/profile/billing' },
  { name: 'Microsoft 365', keywords: ['microsoft 365', 'office 365', 'microsoft subscription'], category: 'Productivity', cancelUrl: 'https://account.microsoft.com/services' },
  { name: 'Google One', keywords: ['google one', 'google storage'], category: 'Productivity', cancelUrl: 'https://one.google.com' },
  { name: 'iCloud+', keywords: ['icloud'], category: 'Productivity', cancelUrl: 'https://support.apple.com/en-in/HT202039' },
  { name: 'Evernote', keywords: ['evernote'], category: 'Productivity', cancelUrl: 'https://www.evernote.com/Settings.action' },
  { name: 'Todoist', keywords: ['todoist'], category: 'Productivity', cancelUrl: 'https://todoist.com/app/settings/account' },
  { name: 'Zoom', keywords: ['zoom'], category: 'Productivity', cancelUrl: 'https://zoom.us/account' },
  { name: 'Slack', keywords: ['slack'], category: 'Productivity', cancelUrl: 'https://slack.com/account/settings' },

  // Security / VPN
  { name: 'NordVPN', keywords: ['nordvpn', 'nord vpn'], category: 'Security', cancelUrl: 'https://my.nordaccount.com/subscriptions' },
  { name: 'ExpressVPN', keywords: ['expressvpn', 'express vpn'], category: 'Security', cancelUrl: 'https://www.expressvpn.com/accounts' },
  { name: 'Surfshark', keywords: ['surfshark'], category: 'Security', cancelUrl: 'https://my.surfshark.com/account' },
  { name: '1Password', keywords: ['1password'], category: 'Security', cancelUrl: 'https://my.1password.com/settings/billing' },
  { name: 'LastPass', keywords: ['lastpass'], category: 'Security', cancelUrl: 'https://lastpass.com/account.php' },

  // Developer Tools
  { name: 'GitHub', keywords: ['github'], category: 'Developer Tools', cancelUrl: 'https://github.com/settings/billing' },
  { name: 'GitLab', keywords: ['gitlab'], category: 'Developer Tools', cancelUrl: 'https://gitlab.com/-/profile/billing' },
  { name: 'Vercel', keywords: ['vercel'], category: 'Developer Tools', cancelUrl: 'https://vercel.com/account' },
  { name: 'Netlify', keywords: ['netlify'], category: 'Developer Tools', cancelUrl: 'https://app.netlify.com/account/billing' },
  { name: 'Heroku', keywords: ['heroku'], category: 'Developer Tools', cancelUrl: 'https://dashboard.heroku.com/account/billing' },
  { name: 'DigitalOcean', keywords: ['digitalocean'], category: 'Developer Tools', cancelUrl: 'https://cloud.digitalocean.com/account/billing' },

  // Career
  { name: 'LinkedIn Premium', keywords: ['linkedin premium', 'linkedin'], category: 'Career', cancelUrl: 'https://www.linkedin.com/premium/manage-subscription' },

  // Storage
  { name: 'Dropbox', keywords: ['dropbox'], category: 'Storage', cancelUrl: 'https://www.dropbox.com/account/plan' },
  { name: 'Google Drive', keywords: ['google drive', 'google storage'], category: 'Storage', cancelUrl: 'https://one.google.com' },
  { name: 'OneDrive', keywords: ['onedrive'], category: 'Storage', cancelUrl: 'https://account.microsoft.com/services' },

  // Telecom (India)
  { name: 'Jio', keywords: ['jio recharge', 'jio plan', 'reliance jio'], category: 'Telecom', cancelUrl: 'https://www.jio.com' },
  { name: 'Airtel', keywords: ['airtel recharge', 'airtel plan', 'bharti airtel'], category: 'Telecom', cancelUrl: 'https://www.airtel.in' },

  // Education
  { name: 'Coursera Plus', keywords: ['coursera'], category: 'Education', cancelUrl: 'https://www.coursera.org/account-settings' },
  { name: 'Skillshare', keywords: ['skillshare'], category: 'Education', cancelUrl: 'https://www.skillshare.com/settings/payments' },
  { name: 'Duolingo Plus', keywords: ['duolingo'], category: 'Education', cancelUrl: 'https://www.duolingo.com/settings/subscription' },
  { name: 'Unacademy', keywords: ['unacademy'], category: 'Education', cancelUrl: 'https://unacademy.com' },

  // Fitness
  { name: 'Strava', keywords: ['strava'], category: 'Fitness', cancelUrl: 'https://www.strava.com/account' },
  { name: 'Fitbit Premium', keywords: ['fitbit'], category: 'Fitness', cancelUrl: 'https://www.fitbit.com/settings/subscription' },
  { name: 'Cult.fit', keywords: ['cult.fit', 'cultfit', 'curefit'], category: 'Fitness', cancelUrl: 'https://www.cult.fit' },

  // News / Reading
  { name: 'Medium', keywords: ['medium membership'], category: 'News', cancelUrl: 'https://medium.com/me/settings' },
  { name: 'The Ken', keywords: ['the ken'], category: 'News', cancelUrl: 'https://the-ken.com' },
  { name: 'Kindle Unlimited', keywords: ['kindle unlimited'], category: 'News', cancelUrl: 'https://www.amazon.in/kindle-dbs/hz/subscribe/ku' },
  { name: 'Audible', keywords: ['audible'], category: 'News', cancelUrl: 'https://www.audible.in/account' },
]

// ═══════════════════════════════════════════════════════════════
// BLOCKED PATTERNS (definitely NOT subscriptions)
// ═══════════════════════════════════════════════════════════════

const BLOCKED_SENDERS = [
  'noreply@reddit.com', 'redditmail.com',
  'quora.com', 'twitter.com', 'x.com',
  'instagram.com', 'facebook.com',
  'youtube.com/notification',
  'hello@mail.grammarly.com', 'mail.grammarly.com',
  'newsletters-noreply@linkedin.com', 'messages-noreply@linkedin.com',
  'e.linkedin.com', 'linkedin.com/notification',
  'jobalerts-noreply@linkedin.com', 'insights@',
  // Stock brokers / trading platforms
  'angelone.in', 'angelbroking.in',
  'zerodha.com', 'kite.zerodha.com',
  'groww.in', 'upstox.com',
  'icici.com', 'icicidirect.com',
  'hdfcsec.com', 'kotak.com',
  'motilal.com', 'sharekhan.com',
  '5paisa.com', 'dhan.co',
  // Banks
  'hdfcbank.com', 'sbi.co.in', 'icicibank.com',
  'axisbank.com', 'kotak.com', 'yesbank.in',
  'federalbank.co.in', 'indusind.com',
  // Stock exchanges
  'nse.co.in', 'bseindia.com',
  // News / social that isn't subscription
  'join.netflix.com', 'pinterest.com'
]

const BLOCKED_SUBJECT_PHRASES = [
  'payment failed', 'payment declined', 'payment issue',
  'suspended due to', 'needs attention', 'update payment',
  'order shipped', 'order delivered', 'shipping confirmation',
  'delivery update', 'tracking number', 'out for delivery',
  'verify your', 'confirm your email', 'one-time password',
  'otp', 'login alert',
  'weekly update', 'weekly writing update', 'weekly report',
  'insights', 'writing update', 'jump back in',
  'newsletter', 'digest', 'your weekly', 'weekly digest',
  // Promotional / trial emails
  'free for', 'free trial', 'try a', 'try our',
  'start your free', 'get started free', 'days free',
  'special offer', 'limited time', 'discount',
  'save with', 'upgrade now', 'unlock premium',
  'introducing', 'what\'s new', 'tips for',
  'welcome to', 'getting started', 'learn more',
  'we miss you', 'come back', 'win a', 'giveaway',
  // Finance / trading / banking
  'ipo', 'allotment', 'refund',
  'mutual fund', 'sip', 'nifty', 'sensex',
  'stock', 'shares', 'trading',
  'credit card statement', 'account statement',
  'bank statement', 'transaction alert',
  'funds/securities', 'demat',
  'market', 'portfolio',
  // Service updates / non-payment
  'terms of service', 'updating our', 'privacy policy',
  'valued member', 'thanks for being'
]

const CANCELLATION_PHRASES = [
  'has been cancelled', 'has been canceled',
  'membership has been cancelled', 'membership has been canceled',
  'subscription has been cancelled', 'subscription has been canceled',
  'sorry to see you go', 'you have cancelled', 'you have canceled',
  'cancellation confirmed', 'successfully cancelled', 'successfully canceled',
  'will remain active until', 'access until',
  'you\'ve cancelled', 'you\'ve canceled'
]

// ═══════════════════════════════════════════════════════════════
// AMOUNT EXTRACTION (robust regex patterns)
// ═══════════════════════════════════════════════════════════════

function extractAmount(text) {
  if (!text) return null

  // Ordered from most specific to least specific
  const patterns = [
    // ₹1,650 or ₹ 1,650 or ₹1650.00
    /₹\s*([\d,]+(?:\.\d{1,2})?)/,
    // Rs. 1,650 or Rs 1650
    /Rs\.?\s*([\d,]+(?:\.\d{1,2})?)/i,
    // INR 1,650
    /INR\s*([\d,]+(?:\.\d{1,2})?)/i,
    // Amount: 1,650 or Amount charged: 1,650
    /amount\s*(?:charged|paid|due|is|was|of|:)\s*₹?\s*(?:Rs\.?\s*)?([\d,]+(?:\.\d{1,2})?)/i,
    // Price: 649 or Cost: 649
    /(?:price|cost|fee|charge|total)\s*(?:is|was|of|:)\s*₹?\s*(?:Rs\.?\s*)?([\d,]+(?:\.\d{1,2})?)/i,
    // $9.99 or USD 9.99
    /\$\s*([\d,]+(?:\.\d{1,2})?)/,
    /USD\s*([\d,]+(?:\.\d{1,2})?)/i,
    // €9.99 or £9.99
    /[€£]\s*([\d,]+(?:\.\d{1,2})?)/,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''))
      // Sanity check: amount should be > 0 and reasonable
      if (amount > 0 && amount < 1000000) {
        return amount
      }
    }
  }

  return null
}

// ═══════════════════════════════════════════════════════════════
// CURRENCY DETECTION
// ═══════════════════════════════════════════════════════════════

function detectCurrency(text) {
  if (!text) return 'INR'
  const lower = text.toLowerCase()
  if (lower.includes('₹') || lower.includes('inr') || lower.match(/rs\.?\s*\d/i)) return 'INR'
  if (lower.includes('$') || lower.includes('usd')) return 'USD'
  if (lower.includes('€') || lower.includes('eur')) return 'EUR'
  if (lower.includes('£') || lower.includes('gbp')) return 'GBP'
  return 'INR' // Default for Indian users
}

// ═══════════════════════════════════════════════════════════════
// DATE EXTRACTION
// ═══════════════════════════════════════════════════════════════

const MONTHS = {
  'january': '01', 'february': '02', 'march': '03', 'april': '04',
  'may': '05', 'june': '06', 'july': '07', 'august': '08',
  'september': '09', 'october': '10', 'november': '11', 'december': '12',
  'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
  'jun': '06', 'jul': '07', 'aug': '08', 'sep': '09',
  'oct': '10', 'nov': '11', 'dec': '12'
}

function parseNaturalDate(text) {
  if (!text) return null

  // "June 5, 2026" or "Jun 5, 2026"
  let match = text.match(/(\w+)\s+(\d{1,2}),?\s*(\d{4})/i)
  if (match) {
    const month = MONTHS[match[1].toLowerCase()]
    if (month) {
      const day = match[2].padStart(2, '0')
      return `${match[3]}-${month}-${day}`
    }
  }

  // "5 June 2026" or "5 Jun 2026"
  match = text.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i)
  if (match) {
    const month = MONTHS[match[2].toLowerCase()]
    if (month) {
      const day = match[1].padStart(2, '0')
      return `${match[3]}-${month}-${day}`
    }
  }

  // "2026-06-05"
  match = text.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`
  }

  // "05/06/2026" (DD/MM/YYYY - Indian format)
  match = text.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`
  }

  return null
}

function extractReceiptDate(text, emailDate) {
  if (!text) return emailDate ? parseNaturalDate(emailDate) : null

  // Try to find date near payment/charge keywords
  const datePatterns = [
    /(?:date\s*(?:charged|of charge)?|charged on|payment date|date paid|billed on|transaction date)\s*[:\-]?\s*(.+?)(?:\n|$|\.)/i,
    /(?:date)\s*[:\-]\s*(.+?)(?:\n|$|\.)/i,
  ]

  for (const pattern of datePatterns) {
    const match = text.match(pattern)
    if (match) {
      const parsed = parseNaturalDate(match[1].trim())
      if (parsed) return parsed
    }
  }

  // Fallback to email header date
  if (emailDate) {
    return parseNaturalDate(emailDate)
  }

  return null
}

function extractRenewalDate(text) {
  if (!text) return null

  const patterns = [
    /(?:next billing|next renewal|next payment|renews on|renews|next charge|billing event|next billing event|scheduled for)\s*(?:date)?[:\-]?\s*(?:is\s*(?:on\s*|scheduled\s*(?:for\s*)?)?)?\s*(.+?)(?:\n|$|\.|,)/i,
    /(?:will be charged on|will renew on|renewal date)\s*[:\-]?\s*(.+?)(?:\n|$|\.|,)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const parsed = parseNaturalDate(match[1].trim())
      if (parsed) return parsed
    }
  }

  return null
}

// ═══════════════════════════════════════════════════════════════
// SERVICE DETECTION (pattern matching)
// ═══════════════════════════════════════════════════════════════

function detectKnownService(text) {
  const lower = text.toLowerCase()
  let bestMatch = null
  let bestKeywordLength = 0

  for (const service of KNOWN_SERVICES) {
    for (const keyword of service.keywords) {
      if (lower.includes(keyword)) {
        if (keyword.length > bestKeywordLength) {
          bestKeywordLength = keyword.length
          bestMatch = service
        }
      }
    }
  }

  return bestMatch
}

// ═══════════════════════════════════════════════════════════════
// PRE-FILTERS
// ═══════════════════════════════════════════════════════════════

function isBlockedSender(from) {
  const lower = from.toLowerCase()
  return BLOCKED_SENDERS.some(blocked => lower.includes(blocked))
}

function isBlockedSubject(subject) {
  const lower = subject.toLowerCase()
  return BLOCKED_SUBJECT_PHRASES.some(phrase => lower.includes(phrase))
}

function isCancellation(text) {
  const lower = text.toLowerCase()
  return CANCELLATION_PHRASES.some(phrase => lower.includes(phrase))
}

function hasSubscriptionSignals(text) {
  const lower = text.toLowerCase()
  // These signals indicate an actual payment/billing event
  // NOT just a mention of a service (e.g., promo emails)
  const signals = [
    'payment processed', 'payment successful', 'successfully processed',
    'payment confirmed', 'processed your payment',
    'subscription renewed', 'has been renewed', 'renewal',
    'receipt', 'invoice', 'charged', 'billed',
    'amount paid', 'amount charged', 'amount:', 'amount due',
    'billing event', 'next billing', 'billing date',
    'payment method', 'card ending', 'ending in',
    'thank you for your payment', 'transaction successful',
    'deducted', 'debited', 'auto-debit', 'auto debit',
    'plan activated', 'plan renewed',
    'recurring', 'auto-renew'
  ]
  return signals.some(signal => lower.includes(signal))
}

// ═══════════════════════════════════════════════════════════════
// AI FALLBACK (for unknown services)
// ═══════════════════════════════════════════════════════════════

async function askAI(emailData) {
  const { subject, from, body, snippet } = emailData
  const content = (body || snippet || '').substring(0, 2000)

  const prompt = `Extract subscription info from this email as JSON only.

Subject: ${subject}
From: ${from}
Body: ${content}

Respond with ONLY this JSON (no other text):
{"isSubscription":true,"serviceName":"Example","amount":100,"currency":"INR","receiptDate":"2026-01-01","renewalDate":"2026-02-01"}

Use null for unknown fields. isSubscription=false if not a recurring payment.`

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Respond with ONLY valid JSON. No text, no markdown, no explanation. Just a single JSON object.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 250,
      temperature: 0
    })

    const text = response.choices[0].message.content.trim()
    console.log('  AI raw:', text.substring(0, 150))

    // Try multiple parsing strategies
    let parsed = null

    // Strategy 1: Direct parse (clean markdown)
    try {
      parsed = JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim())
    } catch (e) {}

    // Strategy 2: Extract first JSON object
    if (!parsed) {
      const jsonMatch = text.match(/\{[^{}]*\}/)
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0].replace(/,\s*}/g, '}'))
        } catch (e) {}
      }
    }

    // Strategy 3: Manual field extraction from text
    if (!parsed) {
      const isSub = /isSubscription["\s:]+true/i.test(text)
      const nameMatch = text.match(/serviceName["\s:]+["']([^"']+)["']/i)
      const amountMatch = text.match(/amount["\s:]+(\d+[\d,.]*)/i)

      if (isSub && nameMatch) {
        parsed = {
          isSubscription: true,
          serviceName: nameMatch[1],
          amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null,
          currency: 'INR',
          receiptDate: null,
          renewalDate: null
        }
      }
    }

    if (parsed && parsed.isSubscription && parsed.serviceName) {
      // Add category and cancel URL
      const service = detectKnownService(parsed.serviceName)
      parsed.category = service ? service.category : getCategory(parsed.serviceName)
      parsed.cancelUrl = service ? service.cancelUrl : getCancelUrl(parsed.serviceName)
      return parsed
    }

    return { isSubscription: false }

  } catch (err) {
    console.error('  AI error:', err.message)
    return { isSubscription: false }
  }
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY & CANCEL URL FALLBACKS
// ═══════════════════════════════════════════════════════════════

function getCategory(serviceName) {
  const lower = (serviceName || '').toLowerCase()
  if (['netflix', 'prime', 'hotstar', 'disney', 'hulu', 'hbo', 'sonyliv', 'zee5', 'jiocinema', 'crunchyroll'].some(k => lower.includes(k))) return 'Entertainment'
  if (['spotify', 'music', 'jiosaavn', 'gaana', 'wynk', 'youtube music'].some(k => lower.includes(k))) return 'Music'
  if (['chatgpt', 'openai', 'claude', 'anthropic', 'gemini', 'midjourney', 'grammarly', 'jasper', 'perplexity'].some(k => lower.includes(k))) return 'AI Tools'
  if (['canva', 'adobe', 'figma', 'photoshop', 'illustrator'].some(k => lower.includes(k))) return 'Design'
  if (['notion', 'microsoft', 'office', 'google one', 'icloud', 'evernote', 'todoist', 'zoom', 'slack'].some(k => lower.includes(k))) return 'Productivity'
  if (['nordvpn', 'expressvpn', 'surfshark', '1password', 'lastpass', 'vpn'].some(k => lower.includes(k))) return 'Security'
  if (['github', 'gitlab', 'vercel', 'netlify', 'heroku', 'digitalocean'].some(k => lower.includes(k))) return 'Developer Tools'
  if (['linkedin'].some(k => lower.includes(k))) return 'Career'
  if (['dropbox', 'drive', 'onedrive', 'storage'].some(k => lower.includes(k))) return 'Storage'
  if (['jio', 'airtel', 'vi ', 'bsnl', 'vodafone'].some(k => lower.includes(k))) return 'Telecom'
  if (['coursera', 'udemy', 'skillshare', 'duolingo', 'unacademy'].some(k => lower.includes(k))) return 'Education'
  if (['strava', 'fitbit', 'cult.fit', 'peloton'].some(k => lower.includes(k))) return 'Fitness'
  return 'Other'
}

function getCancelUrl(serviceName) {
  const service = detectKnownService(serviceName)
  return service ? service.cancelUrl : null
}

// ═══════════════════════════════════════════════════════════════
// MAIN DETECTION FUNCTION
// ═══════════════════════════════════════════════════════════════

const parseEmailForSubscription = async (emailData) => {
  const { subject, from, date, snippet, body } = emailData
  const fullText = `${subject} ${from} ${body || snippet || ''}`
  const contentOnly = body || snippet || ''

  console.log('\n--- Processing email ---')
  console.log('  Subject:', subject)
  console.log('  From:', from)

  // ─── STEP 1: Quick rejection ───
  if (isBlockedSender(from)) {
    console.log('  → BLOCKED sender')
    return { isSubscription: false }
  }

  if (isBlockedSubject(subject)) {
    console.log('  → BLOCKED subject')
    return { isSubscription: false }
  }

  // Check for promotional/trial language in subject AND body
  const promoPatterns = [
    'free for', 'days free', 'free trial', 'try a',
    'try our', 'start your free', 'get started free', 'days free',
    'special offer', 'limited time', 'discount',
    'save with', 'upgrade now', 'unlock premium',
    'introducing', 'what\'s new', 'tips for',
    'welcome to', 'getting started', 'learn more',
    'we miss you', 'come back', 'win a', 'giveaway',
    'weekly insight', 'upgrade today', 'try premium',
    'unlock suggestions'
  ]
  const combinedLower = `${subject} ${contentOnly}`.toLowerCase()
  const hasStrongReceiptConfirmation = 
    combinedLower.includes('payment processed') ||
    combinedLower.includes('successfully processed') ||
    combinedLower.includes('payment successful') ||
    combinedLower.includes('payment confirmed') ||
    combinedLower.includes('transaction successful') ||
    combinedLower.includes('order receipt') ||
    combinedLower.includes('payment receipt') ||
    combinedLower.includes('subscription renewed') ||
    combinedLower.includes('successfully charged')
  
  const isPromo = promoPatterns.some(p => combinedLower.includes(p)) && !hasStrongReceiptConfirmation

  if (isPromo) {
    console.log('  → SKIPPED: Promotional/trial email')
    return { isSubscription: false }
  }

  if (isCancellation(fullText)) {
    console.log('  → CANCELLATION email')
    return { isSubscription: false }
  }

  // ─── STEP 2: Try known service detection (NO AI needed) ───
  const service = detectKnownService(fullText)

  if (service) {
    console.log('  → KNOWN SERVICE detected:', service.name)

    // MUST have payment/billing signals to confirm it's an actual
    // subscription email, not just a promo mentioning the service
    if (!hasSubscriptionSignals(fullText)) {
      console.log('  → SKIPPED: No payment signals (likely promo email)')
      return { isSubscription: false }
    }

    const amount = extractAmount(contentOnly)

    // Extra validation: must have an amount OR very strong billing proof
    // This prevents ToS updates, "valued member" emails from being saved
    const contentLower = contentOnly.toLowerCase()
    const hasStrongBillingProof =
      contentLower.includes('payment processed') ||
      contentLower.includes('successfully processed') ||
      contentLower.includes('payment successful') ||
      contentLower.includes('next billing') ||
      contentLower.includes('billing event') ||
      contentLower.includes('card ending') ||
      contentLower.includes('ending in') ||
      contentLower.includes('payment method') ||
      contentLower.includes('has been renewed') ||
      contentLower.includes('subscription renewed') ||
      contentLower.includes('auto-renew')

    if (!amount && !hasStrongBillingProof) {
      console.log('  → SKIPPED: No amount and no strong billing proof')
      return { isSubscription: false }
    }

    const currency = detectCurrency(contentOnly)
    const receiptDate = extractReceiptDate(contentOnly, date)
    const renewalDate = extractRenewalDate(contentOnly)

    console.log('  → Amount:', amount, currency)
    console.log('  → Receipt date:', receiptDate)
    console.log('  → Renewal date:', renewalDate)

    return {
      isSubscription: true,
      serviceName: service.name,
      amount: amount,
      currency: currency,
      category: service.category,
      cancelUrl: service.cancelUrl,
      receiptDate: receiptDate,
      renewalDate: renewalDate
    }
  }

  // ─── STEP 3: Unknown service - check for subscription signals ───
  if (hasSubscriptionSignals(fullText)) {
    console.log('  → Has subscription signals, trying AI...')

    // Try to extract a service name from the email
    const result = await askAI(emailData)

    if (result.isSubscription) {
      // Enhance with regex-extracted data
      result.amount = result.amount || extractAmount(contentOnly)
      result.currency = result.currency || detectCurrency(contentOnly)
      result.receiptDate = result.receiptDate || extractReceiptDate(contentOnly, date)
      result.renewalDate = result.renewalDate || extractRenewalDate(contentOnly)
      console.log('  → AI detected:', result.serviceName, result.amount)
      return result
    }
  }

  console.log('  → NOT a subscription')
  return { isSubscription: false }
}

module.exports = { parseEmailForSubscription }
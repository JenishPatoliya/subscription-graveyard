// backend/services/aiService.js

const Groq = require('groq-sdk');
require('dotenv').config();

// Initialize Groq client with your API key
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// ─── CANCEL URLS DATABASE ────────────────────────────

// These are direct links to cancellation pages
// User clicks these to cancel their subscriptions
// We never cancel automatically on their behalf
const CANCEL_URLS = {
  'canva': 'https://www.canva.com/settings/purchase',
  'spotify': 'https://www.spotify.com/account/subscription',
  'netflix': 'https://www.netflix.com/cancelplan',
  'adobe': 'https://account.adobe.com/plans',
  'notion': 'https://www.notion.so/profile/billing',
  'nordvpn': 'https://my.nordaccount.com/subscriptions',
  'chatgpt': 'https://chat.openai.com/account/billing',
  'openai': 'https://platform.openai.com/account/billing',
  'google': 'https://myaccount.google.com/payments-and-subscriptions',
  'microsoft': 'https://account.microsoft.com/services',
  'amazon': 'https://www.amazon.in/mc/pipelines/cancellation',
  'linkedin': 'https://www.linkedin.com/premium/cancel',
  'github': 'https://github.com/settings/billing',
  'dropbox': 'https://www.dropbox.com/account/plan',
  'zoom': 'https://zoom.us/billing',
  'youtube': 'https://www.youtube.com/paid_memberships',
  'hotstar': 'https://www.hotstar.com/in/subscribe',
  'zee5': 'https://www.zee5.com/subscription',
  'sonyliv': 'https://www.sonyliv.com/settings'
};

// Find cancel URL for a service
const getCancelUrl = (serviceName) => {
  const lower = serviceName.toLowerCase();
  for (const [key, url] of Object.entries(CANCEL_URLS)) {
    if (lower.includes(key)) return url;
  }
  return null;
};

// ─── CATEGORY DETECTION ──────────────────────────────

// Automatically categorize subscription by name
const getCategoryFromName = (serviceName) => {
  const lower = serviceName.toLowerCase();
  
  if (['canva', 'adobe', 'figma', 'sketch'].some(s => lower.includes(s)))
    return 'Design';
  if (['spotify', 'apple music', 'youtube music'].some(s => lower.includes(s)))
    return 'Music';
  if (['netflix', 'hotstar', 'prime video', 'zee5', 'sony'].some(s => lower.includes(s)))
    return 'Entertainment';
  if (['chatgpt', 'openai', 'claude', 'gemini', 'midjourney'].some(s => lower.includes(s)))
    return 'AI Tools';
  if (['notion', 'evernote', 'todoist', 'asana', 'slack'].some(s => lower.includes(s)))
    return 'Productivity';
  if (['nordvpn', 'expressvpn', 'surfshark'].some(s => lower.includes(s)))
    return 'Security';
  if (['github', 'gitlab', 'vercel', 'aws'].some(s => lower.includes(s)))
    return 'Developer Tools';
    
  return 'Other';
};

// ─── PARSE EMAIL WITH AI ─────────────────────────────

const parseEmailForSubscription = async (emailData) => {
  const { subject, from, date, snippet } = emailData;

  // Write clear prompt for AI
  // Tell it exactly what format to return
  const prompt = `
    You are analyzing an email to extract subscription payment info.
    
    Return ONLY a valid JSON object.
    No markdown. No backticks. No extra text.
    Just the JSON object.
    
    Email Subject: ${subject}
    Email From: ${from}
    Email Date: ${date}
    Email Preview: ${snippet}
    
    Return exactly this structure:
    {
      "isSubscription": true or false,
      "serviceName": "name of service or null",
      "amount": number with no symbols or null,
      "currency": "INR or USD or null",
      "billingCycle": "monthly or yearly or null",
      "receiptDate": "YYYY-MM-DD or null",
      "renewalDate": "YYYY-MM-DD or null"
    }
    
    Rules:
    - isSubscription must be true only if this 
      is clearly a payment receipt or invoice
    - Extract the service name exactly as shown
    - Amount must be a number only like 499 not ₹499
    - If amount is in USD multiply by 83 for INR
    - Return null for any uncertain field
  `;

  try {
    // Call Groq API
    const response = await groq.chat.completions.create({
      model: 'llama3-8b-8192',  // Fast free model
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,  // Short response enough for JSON
      temperature: 0.1  // Low temperature = more consistent
    });

    // Get the text response
    const text = response.choices[0].message.content.trim();

    // Clean any markdown formatting AI might add
    const cleaned = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    // Parse JSON
    const parsed = JSON.parse(cleaned);

    // Add category and cancel URL if subscription found
    if (parsed.isSubscription && parsed.serviceName) {
      parsed.category = getCategoryFromName(parsed.serviceName);
      parsed.cancelUrl = getCancelUrl(parsed.serviceName);
    }

    return parsed;

  } catch (err) {
    // If AI fails or JSON parse fails
    // Return false so email is skipped
    console.error('AI parsing error:', err.message);
    return { isSubscription: false };
  }
};

module.exports = { parseEmailForSubscription };
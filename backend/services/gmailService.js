// backend/services/gmailService.js

const { google } = require('googleapis');
require('dotenv').config();

// ─── CREATE OAUTH CLIENT ─────────────────────────────

// This creates the Google authentication client
// Used to generate login URLs and exchange codes for tokens
const createOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    // This URL is where Google sends user after they approve
    // Must exactly match what you set in Google Cloud Console
    `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/gmail/callback`
  );
};

// ─── GENERATE AUTH URL ───────────────────────────────

// Creates the Google login URL that user clicks
// userId is passed as state so we know which user
// connected Gmail after they come back from Google
const getAuthUrl = (userId) => {
  const oauth2Client = createOAuth2Client();
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',  // Gets refresh token for long term access
    prompt: 'consent',       // Always show consent screen
    scope: [
      // This is the ONLY permission we request
      // Read only — we can never send or delete emails
      'https://www.googleapis.com/auth/gmail.readonly'
    ],
    state: userId  // Passed back to callback so we know who this is
  });
};

// ─── GET TOKENS FROM CODE ────────────────────────────

// After user approves Google sends a code
// This exchanges that code for actual access tokens
const getTokensFromCode = async (code) => {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
};

// ─── CREATE GMAIL CLIENT ─────────────────────────────

// Creates an authenticated Gmail API client
// Used to actually read emails
const createGmailClient = (accessToken, refreshToken) => {
  const oauth2Client = createOAuth2Client();
  
  // Set the user's tokens
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken
  });
  
  // Return gmail client ready to use
  return google.gmail({ version: 'v1', auth: oauth2Client });
};

// ─── SEARCH RECEIPT EMAILS ───────────────────────────

// Searches Gmail for emails that look like receipts
// Uses two search passes to catch as many subscription emails as possible
const searchReceiptEmails = async (gmail) => {
  
  console.log('Searching Gmail with multiple queries...')

  // Query 1: Payment/billing keywords (searches full email)
  const paymentQuery = '(receipt OR invoice OR payment OR subscription OR renewal OR billing OR charged OR membership OR "payment method" OR "next billing" OR "successfully processed" OR "amount paid" OR "plan renewed") newer_than:1y'

  // Query 2: Known service names in subject (catches test emails)
  const serviceQuery = 'subject:(netflix OR spotify OR chatgpt OR canva OR "youtube premium" OR "amazon prime" OR hotstar OR adobe OR notion OR github OR linkedin OR zoom OR "google one" OR icloud OR nordvpn) newer_than:1y'

  const [paymentRes, serviceRes] = await Promise.all([
    gmail.users.messages.list({ userId: 'me', q: paymentQuery, maxResults: 200 }),
    gmail.users.messages.list({ userId: 'me', q: serviceQuery, maxResults: 50 })
  ])

  const paymentMessages = paymentRes.data.messages || []
  const serviceMessages = serviceRes.data.messages || []

  // Deduplicate by message ID
  const seen = new Set()
  const allMessages = []

  for (const msg of [...paymentMessages, ...serviceMessages]) {
    if (!seen.has(msg.id)) {
      seen.add(msg.id)
      allMessages.push(msg)
    }
  }

  console.log(`Found ${paymentMessages.length} payment emails + ${serviceMessages.length} service emails = ${allMessages.length} unique`)

  return allMessages
}

const decodeBase64Url = (data) => {
  if (!data) return '';
  try {
    return Buffer.from(data, 'base64url').toString('utf8');
  } catch (err) {
    try {
      return Buffer.from(data, 'base64').toString('utf8');
    } catch (e) {
      return '';
    }
  }
};

const findTextPart = (part) => {
  if (!part) return null;
  if (part.mimeType === 'text/plain' && part.body && part.body.data) {
    return decodeBase64Url(part.body.data);
  }
  if (part.parts) {
    for (const subPart of part.parts) {
      const found = findTextPart(subPart);
      if (found) return found;
    }
  }
  return null;
};

const findHtmlPart = (part) => {
  if (!part) return null;
  if (part.mimeType === 'text/html' && part.body && part.body.data) {
    const html = decodeBase64Url(part.body.data);
    let clean = html;
    
    // Fast non-backtracking style removal
    while (clean.includes('<style') && clean.includes('</style>')) {
      const start = clean.indexOf('<style');
      const end = clean.indexOf('</style>', start);
      if (end === -1) break;
      clean = clean.substring(0, start) + clean.substring(end + 8);
    }
    
    // Fast non-backtracking script removal
    while (clean.includes('<script') && clean.includes('</script>')) {
      const start = clean.indexOf('<script');
      const end = clean.indexOf('</script>', start);
      if (end === -1) break;
      clean = clean.substring(0, start) + clean.substring(end + 9);
    }
    
    return clean
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  if (part.parts) {
    for (const subPart of part.parts) {
      const found = findHtmlPart(subPart);
      if (found) return found;
    }
  }
  return null;
};

const getBodyText = (payload) => {
  if (!payload) return '';
  if (payload.body && payload.body.data) {
    const text = decodeBase64Url(payload.body.data);
    if (payload.mimeType === 'text/html') {
      let clean = text;
      while (clean.includes('<style') && clean.includes('</style>')) {
        const start = clean.indexOf('<style');
        const end = clean.indexOf('</style>', start);
        if (end === -1) break;
        clean = clean.substring(0, start) + clean.substring(end + 8);
      }
      while (clean.includes('<script') && clean.includes('</script>')) {
        const start = clean.indexOf('<script');
        const end = clean.indexOf('</script>', start);
        if (end === -1) break;
        clean = clean.substring(0, start) + clean.substring(end + 9);
      }
      return clean
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    return text;
  }
  let body = findTextPart(payload);
  if (!body) {
    body = findHtmlPart(payload);
  }
  return body || '';
};

// Gets the actual content of a specific email
// Uses the proper getBodyText helper for correct base64url decoding
const getEmailContent = async (gmail, messageId) => {
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full'
  })

  const headers = response.data.payload.headers
  const subject = headers.find(h => h.name === 'Subject')?.value || ''
  const from = headers.find(h => h.name === 'From')?.value || ''
  const date = headers.find(h => h.name === 'Date')?.value || ''
  const snippet = response.data.snippet || ''

  // Extract body using the proper helper that handles
  // base64url decoding, HTML stripping, and nested MIME parts
  const fullBody = getBodyText(response.data.payload)

  // Clean and truncate for AI processing
  const cleanBody = fullBody
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 3000)

  return {
    subject,
    from,
    date,
    snippet,
    body: cleanBody,
    messageId
  }
};

// Export all functions
module.exports = {
  getAuthUrl,
  getTokensFromCode,
  createGmailClient,
  searchReceiptEmails,
  getEmailContent
};
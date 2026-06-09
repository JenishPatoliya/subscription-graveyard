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
// This query only returns billing related emails
// Never returns personal emails
const searchReceiptEmails = async (gmail) => {
  
  const query = [
    'subject:(receipt OR invoice OR',
    '"payment successful" OR "payment confirmation"',
    'OR "subscription renewed" OR "billing confirmation")',
    'newer_than:6m',
    // Block common wrong sources
    '-from:reddit.com',
    '-from:quora.com', 
    '-subject:"payment failed"',
    '-subject:"payment declined"',
    '-subject:"update payment"',
    '-subject:"payment issue"',
    '-subject:"changes to your"',
    '-subject:"welcome to"'
  ].join(' ')

  console.log('Gmail search query:', query)

  const response = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 50
  })

  const messages = response.data.messages || []
  console.log('Emails found by Gmail search:', messages.length)

  return messages
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
// Fetches the full format to decode body text
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

  // Extract full email body
  let body = ''

  const extractBody = (payload) => {
    if (!payload) return ''
    
    if (payload.body && payload.body.data) {
      try {
        const decoded = Buffer.from(
          payload.body.data, 
          'base64'
        ).toString('utf-8')
        return decoded
      } catch (e) {
        return ''
      }
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain') {
          try {
            const decoded = Buffer.from(
              part.body.data || '', 
              'base64'
            ).toString('utf-8')
            body += decoded
          } catch (e) {}
        }
      }
    }
    
    return body
  }

  body = extractBody(response.data.payload)

  // Clean the body
  // Remove HTML tags
  const cleanBody = body
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 1000) // First 1000 chars is enough

  return { 
    subject, 
    from, 
    date, 
    snippet: response.data.snippet || '',
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
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
const searchReceiptEmails = async (gmail, maxResults = 500) => {
  
  // This is like typing in Gmail search bar
  // Only returns emails with these words in subject
  const query = [
    'subject:(receipt OR invoice OR subscription OR',
    'renewal OR charged OR billing OR payment OR',
    '"order confirmation" OR "purchase confirmation")'
  ].join(' ');

  const response = await gmail.users.messages.list({
    userId: 'me',  // me means the authenticated user
    q: query,
    maxResults     // Limit to prevent too many API calls
  });

  // Return array of message IDs or empty array
  return response.data.messages || [];
};

// ─── GET EMAIL CONTENT ───────────────────────────────

// Gets the actual content of a specific email
// We only get metadata headers and snippet
// We do NOT get full email body to protect privacy
const getEmailContent = async (gmail, messageId) => {
  
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    // metadata format only gets headers
    // much faster than getting full body
    format: 'metadata',
    // Only get these specific headers
    metadataHeaders: ['Subject', 'From', 'Date']
  });

  const headers = response.data.payload.headers;
  
  // Extract each header value
  const subject = headers.find(h => h.name === 'Subject')?.value || '';
  const from = headers.find(h => h.name === 'From')?.value || '';
  const date = headers.find(h => h.name === 'Date')?.value || '';
  
  // Snippet is first 100 characters of email body
  // Enough for AI to understand context
  const snippet = response.data.snippet || '';

  return { subject, from, date, snippet, messageId };
};

// Export all functions
module.exports = {
  getAuthUrl,
  getTokensFromCode,
  createGmailClient,
  searchReceiptEmails,
  getEmailContent
};
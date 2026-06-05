// backend/routes/gmail.js

const express = require('express');
const supabase = require('../config/supabase');
const protect = require('../middleware/authMiddleware');
const gmailService = require('../services/gmailService');
const bullService = require('../services/bullService');
const router = express.Router();

// ─── GET AUTH URL ────────────────────────────────────

// Frontend calls this to get the Google login link
// User is redirected to this link to approve Gmail access
router.get('/auth-url', protect, (req, res) => {
  try {
    // Generate URL with user's ID embedded
    const url = gmailService.getAuthUrl(req.user.userId);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

// ─── OAUTH CALLBACK ──────────────────────────────────

// Google redirects user HERE after they approve access
// This is NOT called by frontend — Google calls it directly
router.get('/callback', async (req, res) => {
  try {
    // Google sends code, state (userId), or error
    const { code, state: userId, error } = req.query;

    // User denied access
    if (error) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/connect-gmail?error=access_denied`
      );
    }

    // ── Exchange code for tokens ──
    // Code is single use and expires quickly
    const tokens = await gmailService.getTokensFromCode(code);

    // ── Get Gmail address ──
    // Create client with new tokens
    const gmail = gmailService.createGmailClient(
      tokens.access_token,
      tokens.refresh_token
    );

    // Get the email address of connected Gmail
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const gmailAddress = profile.data.emailAddress;

    // ── Check if already connected ──
    const { data: existing } = await supabase
      .from('gmail_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('gmail_address', gmailAddress)
      .single();

    if (existing) {
      // Update tokens — they may have refreshed
      await supabase
        .from('gmail_accounts')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token
        })
        .eq('id', existing.id);

    } else {
      // ── Check plan limits ──
      // Free: 1 Gmail, Pro: 5 Gmails
      const { data: existingAccounts } = await supabase
        .from('gmail_accounts')
        .select('id')
        .eq('user_id', userId);

      const { data: user } = await supabase
        .from('users')
        .select('plan')
        .eq('id', userId)
        .single();

      const maxAccounts = user.plan === 'pro' ? 5 : 1;

      if (existingAccounts && existingAccounts.length >= maxAccounts) {
        return res.redirect(
          `${process.env.FRONTEND_URL}/settings?error=gmail_limit`
        );
      }

      // ── Save Gmail account ──
      const isFirst = !existingAccounts || existingAccounts.length === 0;

      await supabase
        .from('gmail_accounts')
        .insert({
          user_id: userId,
          gmail_address: gmailAddress,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          is_primary: isFirst  // First Gmail is primary
        });
    }

    // ── Add scan job to background queue ──
    // This starts the inbox scanning immediately
    // User is redirected to scanning page
    await bullService.addScanJob({
      userId,
      gmailAddress
    });

    // Redirect to scanning progress page
    res.redirect(`${process.env.FRONTEND_URL}/scanning`);

  } catch (err) {
    console.error('Gmail callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL}/connect-gmail?error=failed`);
  }
});

// ─── GET SCAN STATUS ─────────────────────────────────

// Frontend polls this to show progress during scan
// Called every 3 seconds from scanning page
router.get('/scan-status', protect, async (req, res) => {
  try {
    const { data: gmailAccounts } = await supabase
      .from('gmail_accounts')
      .select('gmail_address, last_scanned, emails_scanned, is_primary')
      .eq('user_id', req.user.userId);

    // Count subscriptions found so far
    const { count } = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact' })
      .eq('user_id', req.user.userId);

    res.json({
      gmailAccounts: gmailAccounts || [],
      subscriptionsFound: count || 0,
      // Scan complete when all gmails have last_scanned
      scanComplete: gmailAccounts?.every(a => a.last_scanned) || false
    });

  } catch (err) {
    res.status(500).json({ error: 'Failed to get scan status' });
  }
});

// ─── TRIGGER RESCAN ──────────────────────────────────

// User clicks rescan in settings
// Adds new scan jobs for all connected Gmails
router.post('/rescan', protect, async (req, res) => {
  try {
    const { data: gmailAccounts } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('user_id', req.user.userId);

    if (!gmailAccounts || gmailAccounts.length === 0) {
      return res.status(400).json({ error: 'No Gmail connected' });
    }

    // Add scan job for each connected Gmail
    for (const account of gmailAccounts) {
      await bullService.addScanJob({
        userId: req.user.userId,
        gmailAddress: account.gmail_address
      });
    }

    res.json({ message: 'Rescan started' });

  } catch (err) {
    res.status(500).json({ error: 'Failed to start rescan' });
  }
});

// ─── DISCONNECT GMAIL ────────────────────────────────

// Removes Gmail access from database
// User can reconnect anytime
router.delete('/disconnect/:gmailAddress', protect, async (req, res) => {
  try {
    await supabase
      .from('gmail_accounts')
      .delete()
      .eq('user_id', req.user.userId)
      .eq('gmail_address', req.params.gmailAddress);

    res.json({ message: 'Gmail disconnected successfully' });

  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

module.exports = router;
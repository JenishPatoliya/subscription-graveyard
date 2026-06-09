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
    const { code, state: userId, error } = req.query

    console.log('OAuth callback received')
    console.log('User ID from state:', userId)
    console.log('Code exists:', !!code)
    console.log('Error:', error)

    if (error) {
      console.log('OAuth error:', error)
      return res.redirect(
        `${process.env.FRONTEND_URL}/connect-gmail?error=access_denied`
      )
    }

    if (!code) {
      console.log('No code received')
      return res.redirect(
        `${process.env.FRONTEND_URL}/connect-gmail?error=no_code`
      )
    }

    if (!userId) {
      console.log('No user ID in state')
      return res.redirect(
        `${process.env.FRONTEND_URL}/connect-gmail?error=no_user`
      )
    }

    // Exchange code for tokens
    console.log('Exchanging code for tokens...')
    const tokens = await gmailService.getTokensFromCode(code)
    console.log('Tokens received:', {
      access_token: !!tokens.access_token,
      refresh_token: !!tokens.refresh_token
    })

    if (!tokens.access_token) {
      console.log('No access token received')
      return res.redirect(
        `${process.env.FRONTEND_URL}/connect-gmail?error=no_token`
      )
    }

    // Get Gmail address
    const gmail = gmailService.createGmailClient(
      tokens.access_token,
      tokens.refresh_token
    )

    console.log('Getting Gmail profile...')
    const profile = await gmail.users.getProfile({ userId: 'me' })
    const gmailAddress = profile.data.emailAddress
    console.log('Gmail address:', gmailAddress)

    // Check if already exists
    const { data: existing } = await supabase
      .from('gmail_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('gmail_address', gmailAddress)
      .single()

    if (existing) {
      console.log('Updating existing Gmail account')
      const { error: updateError } = await supabase
        .from('gmail_accounts')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || existing.refresh_token
        })
        .eq('id', existing.id)

      if (updateError) {
        console.log('Update error:', updateError)
      } else {
        console.log('Gmail account updated successfully')
      }

    } else {
      console.log('Creating new Gmail account record')
      const { data: newAccount, error: insertError } = await supabase
        .from('gmail_accounts')
        .insert({
          user_id: userId,
          gmail_address: gmailAddress,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          is_primary: true,
          emails_scanned: 0
        })
        .select()
        .single()

      if (insertError) {
        console.log('Insert error:', insertError)
        console.log('Insert error details:', JSON.stringify(insertError))
        return res.redirect(
          `${process.env.FRONTEND_URL}/connect-gmail?error=save_failed`
        )
      }

      console.log('Gmail account saved:', newAccount.id)
    }

    // Add scan job to queue
    console.log('Adding scan job to queue...')
    await bullService.addScanJob({
      userId,
      gmailAddress
    })
    console.log('Scan job added')

    // Redirect to scanning page
    res.redirect(`${process.env.FRONTEND_URL}/scanning`)

  } catch (err) {
    console.error('Callback error:', err.message)
    console.error('Full error:', err)
    res.redirect(`${process.env.FRONTEND_URL}/connect-gmail?error=failed`)
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
// Adds new scan jobs for all connected Gmails after clearing previous automatic scans
router.post('/rescan', protect, async (req, res) => {
  try {
    const { data: gmailAccounts } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('user_id', req.user.userId);

    if (!gmailAccounts || gmailAccounts.length === 0) {
      return res.status(400).json({ error: 'No Gmail connected' });
    }

    console.log(`Starting clean rescan for user: ${req.user.userId}`);

    // Clear previously scanned data to allow the upgraded AI parser to re-evaluate them
    await supabase.from('alerts').delete().eq('user_id', req.user.userId);
    await supabase.from('receipts').delete().eq('user_id', req.user.userId);
    await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', req.user.userId)
      .neq('source_gmail', 'manual');

    // Reset scan progress stats on Gmail account records
    await supabase
      .from('gmail_accounts')
      .update({ emails_scanned: 0, last_scanned: null })
      .eq('user_id', req.user.userId);

    // Add scan job for each connected Gmail
    for (const account of gmailAccounts) {
      await bullService.addScanJob({
        userId: req.user.userId,
        gmailAddress: account.gmail_address
      });
    }

    res.json({ message: 'Rescan started' });

  } catch (err) {
    console.error('Failed to start rescan:', err.message);
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
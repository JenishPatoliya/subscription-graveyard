// backend/routes/settings.js

const express = require('express');
const supabase = require('../config/supabase');
const protect = require('../middleware/authMiddleware');
const router = express.Router();

// ─── GET ALL SETTINGS ────────────────────────────────

router.get('/', protect, async (req, res) => {
  try {
    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('id, name, email, plan, created_at')
      .eq('id', req.user.userId)
      .single();

    // Get connected Gmail accounts
    const { data: gmailAccounts } = await supabase
      .from('gmail_accounts')
      .select('gmail_address, is_primary, last_scanned, emails_scanned')
      .eq('user_id', req.user.userId);

    // Get alert preferences
    const { data: prefs } = await supabase
      .from('alert_preferences')
      .select('*')
      .eq('user_id', req.user.userId)
      .single();

    res.json({
      user,
      gmailAccounts: gmailAccounts || [],
      preferences: prefs || {
        email_alerts: true,
        days_before: 3,
        weekly_digest: true
      }
    });

  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// ─── UPDATE PREFERENCES ──────────────────────────────

router.patch('/preferences', protect, async (req, res) => {
  try {
    const { emailAlerts, daysBefore, weeklyDigest } = req.body;

    // Upsert = update if exists, insert if not
    await supabase
      .from('alert_preferences')
      .upsert({
        user_id: req.user.userId,
        email_alerts: emailAlerts,
        days_before: daysBefore,
        weekly_digest: weeklyDigest
      });

    res.json({ message: 'Preferences saved' });

  } catch (err) {
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

// ─── DELETE ALL DATA ─────────────────────────────────

// GDPR right to deletion
// User can remove all their data anytime
router.delete('/data', protect, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Delete in order due to foreign keys
    await supabase.from('alerts').delete().eq('user_id', userId);
    await supabase.from('receipts').delete().eq('user_id', userId);
    await supabase.from('subscriptions').delete().eq('user_id', userId);
    await supabase.from('gmail_accounts').delete().eq('user_id', userId);
    await supabase.from('alert_preferences').delete().eq('user_id', userId);

    res.json({ message: 'All your data has been deleted' });

  } catch (err) {
    res.status(500).json({ error: 'Failed to delete data' });
  }
});

module.exports = router;
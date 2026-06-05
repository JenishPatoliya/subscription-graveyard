// backend/routes/alerts.js

const express = require('express');
const supabase = require('../config/supabase');
const protect = require('../middleware/authMiddleware');
const emailService = require('../services/emailService');
const cron = require('node-cron');
const router = express.Router();

// ─── GET ALERTS ──────────────────────────────────────

router.get('/', protect, async (req, res) => {
  try {
    const today = new Date();
    
    // Get subscriptions renewing in next 30 days
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);

    const { data: upcoming } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', req.user.userId)
      .gte('next_renewal_date', today.toISOString().split('T')[0])
      .lte('next_renewal_date', thirtyDaysLater.toISOString().split('T')[0])
      .order('next_renewal_date', { ascending: true });

    // Get recent receipts as past charges
    const { data: recent } = await supabase
      .from('receipts')
      .select('*, subscriptions(service_name, amount, category)')
      .eq('user_id', req.user.userId)
      .order('receipt_date', { ascending: false })
      .limit(5);

    // Add days until renewal for each upcoming
    const enrichedUpcoming = (upcoming || []).map(sub => {
      const renewal = new Date(sub.next_renewal_date);
      const daysUntil = Math.ceil((renewal - today) / (1000 * 60 * 60 * 24));
      return { ...sub, daysUntil };
    });

    res.json({
      upcoming: enrichedUpcoming,
      recent: recent || []
    });

  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// ─── CRON JOB — RUNS DAILY AT 9 AM ──────────────────

// This automatically sends alert emails every day
// No user action needed — it just runs in background
cron.schedule('0 9 * * *', async () => {
  console.log('Running daily alert check at 9 AM...');

  try {
    const today = new Date().toISOString().split('T')[0];

    // Find alerts scheduled for today that haven't been sent
    const { data: alerts } = await supabase
      .from('alerts')
      .select(`
        *,
        users (name, email),
        subscriptions (*)
      `)
      .eq('alert_date', today)
      .eq('sent', false);

    if (!alerts || alerts.length === 0) {
      console.log('No alerts to send today');
      return;
    }

    for (const alert of alerts) {
      try {
        // Send email
        await emailService.sendRenewalAlert(alert);
        
        // Mark as sent so we don't send again
        await supabase
          .from('alerts')
          .update({ sent: true })
          .eq('id', alert.id);

        console.log(`Alert sent for ${alert.subscriptions.service_name}`);
      } catch (err) {
        console.error('Failed to send alert:', err.message);
      }
    }

    console.log(`Processed ${alerts.length} alerts`);

  } catch (err) {
    console.error('Cron job error:', err);
  }
});

module.exports = router;
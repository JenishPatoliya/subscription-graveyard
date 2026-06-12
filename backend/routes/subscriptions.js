// backend/routes/subscriptions.js

const express = require('express');
const supabase = require('../config/supabase');
const protect = require('../middleware/authMiddleware');
const router = express.Router();

// ─── GET ALL SUBSCRIPTIONS ───────────────────────────

router.get('/', protect, async (req, res) => {
  try {
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', req.user.userId)
      .order('total_spent', { ascending: false });

    if (error) throw error;

    // ── Enrich each subscription with receipt gap info ──
    const today = new Date();
    
    const enriched = subscriptions.map(sub => {
      const lastReceipt = sub.last_receipt_date
        ? new Date(sub.last_receipt_date)
        : null;
        
      const daysSinceLastReceipt = lastReceipt
        ? Math.floor((today - lastReceipt) / (1000 * 60 * 60 * 24))
        : null;

      // Determine receipt status label
      let receiptStatus = 'unknown';
      if (daysSinceLastReceipt !== null) {
        if (daysSinceLastReceipt <= 35) receiptStatus = 'recent';
        else if (daysSinceLastReceipt <= 90) receiptStatus = 'moderate';
        else receiptStatus = 'long_gap';
      }

      // Days until next renewal
      let daysUntilRenewal = null;
      if (sub.next_renewal_date) {
        const renewal = new Date(sub.next_renewal_date);
        daysUntilRenewal = Math.ceil((renewal - today) / (1000 * 60 * 60 * 24));
      }

      return {
        ...sub,
        daysSinceLastReceipt,
        receiptStatus,
        daysUntilRenewal
      };
    });

    res.json({ subscriptions: enriched });

  } catch (err) {
    console.error('Get subscriptions error:', err);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// ─── GET SINGLE SUBSCRIPTION ─────────────────────────

router.get('/:id', protect, async (req, res) => {
  try {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.userId)
      .single();

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Get receipt history
    const { data: receipts } = await supabase
      .from('receipts')
      .select('*')
      .eq('subscription_id', req.params.id)
      .order('receipt_date', { ascending: false })
      .limit(24);  // Last 24 receipts = 2 years of monthly

    res.json({
      subscription,
      receipts: receipts || []
    });

  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// ─── ADD MANUAL SUBSCRIPTION ─────────────────────────

// For subscriptions not found in Gmail
router.post('/manual', protect, async (req, res) => {
  try {
    const { serviceName, amount, billingDate, category } = req.body;

    if (!serviceName || !amount) {
      return res.status(400).json({
        error: 'Service name and amount are required'
      });
    }

    const { data: sub, error } = await supabase
      .from('subscriptions')
      .insert({
        user_id: req.user.userId,
        service_name: serviceName,
        amount: parseFloat(amount),
        currency: 'INR',
        category: category || 'Other',
        next_renewal_date: billingDate || null,
        total_receipts: 0,
        total_spent: 0,
        source_gmail: 'manual'  // Mark as manually added
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ subscription: sub });

  } catch (err) {
    res.status(500).json({ error: 'Failed to add subscription' });
  }
});

// ─── UPDATE SUBSCRIPTION STATUS ──────────────────────

// User can mark subscription as:
// active = I am using this
// cancelled = I have cancelled this
// reviewing = I need to check this
router.patch('/:id', protect, async (req, res) => {
  try {
    const { userMarked } = req.body;

    const validStatuses = ['active', 'cancelled', 'reviewing'];
    if (!validStatuses.includes(userMarked)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await supabase
      .from('subscriptions')
      .update({
        user_marked: userMarked,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .eq('user_id', req.user.userId);

    res.json({ message: 'Updated successfully' });

  } catch (err) {
    res.status(500).json({ error: 'Failed to update' });
  }
});

// ─── DELETE SUBSCRIPTION ─────────────────────────────

router.delete('/:id', protect, async (req, res) => {
  try {
    // Delete related records first due to foreign keys
    await supabase
      .from('alerts')
      .delete()
      .eq('subscription_id', req.params.id);

    await supabase
      .from('receipts')
      .delete()
      .eq('subscription_id', req.params.id);

    await supabase
      .from('subscriptions')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.userId);

    res.json({ message: 'Deleted successfully' });

  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

module.exports = router;
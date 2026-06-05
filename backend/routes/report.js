// backend/routes/report.js

const express = require('express');
const supabase = require('../config/supabase');
const protect = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    // Get all subscriptions
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', req.user.userId);

    if (!subscriptions || subscriptions.length === 0) {
      return res.json({
        totalMonthly: 0,
        totalYearly: 0,
        byCategory: [],
        topSubscriptions: [],
        potentialSavings: 0,
        noRecentReceipt: [],
        monthlyTrend: []
      });
    }

    // ── Total monthly spend ──
    const totalMonthly = subscriptions.reduce(
      (sum, s) => sum + Number(s.amount), 0
    );

    // ── Group by category ──
    const categoryMap = {};
    subscriptions.forEach(sub => {
      const cat = sub.category || 'Other';
      if (!categoryMap[cat]) categoryMap[cat] = 0;
      categoryMap[cat] += Number(sub.amount);
    });

    const byCategory = Object.entries(categoryMap)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: Math.round((amount / totalMonthly) * 100)
      }))
      .sort((a, b) => b.amount - a.amount);

    // ── Top subscriptions ──
    const topSubscriptions = [...subscriptions]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6)
      .map(s => ({
        id: s.id,
        name: s.service_name,
        monthly: s.amount,
        yearly: s.amount * 12,
        category: s.category,
        lastReceipt: s.last_receipt_date
      }));

    // ── Find subscriptions with no recent receipt ──
    const today = new Date();
    const noRecentReceipt = subscriptions.filter(sub => {
      if (!sub.last_receipt_date) return false;
      const lastReceipt = new Date(sub.last_receipt_date);
      const days = Math.floor(
        (today - lastReceipt) / (1000 * 60 * 60 * 24)
      );
      return days > 90;  // No receipt in 90+ days
    });

    const potentialSavings = noRecentReceipt.reduce(
      (sum, s) => sum + Number(s.amount), 0
    );

    // ── Monthly trend from receipts ──
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: receipts } = await supabase
      .from('receipts')
      .select('amount, receipt_date')
      .eq('user_id', req.user.userId)
      .gte('receipt_date', sixMonthsAgo.toISOString().split('T')[0]);

    // Group receipts by month
    const monthlyMap = {};
    (receipts || []).forEach(r => {
      if (!r.receipt_date) return;
      const month = r.receipt_date.substring(0, 7); // YYYY-MM
      if (!monthlyMap[month]) monthlyMap[month] = 0;
      monthlyMap[month] += Number(r.amount);
    });

    const monthlyTrend = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount }));

    res.json({
      totalMonthly,
      totalYearly: totalMonthly * 12,
      byCategory,
      topSubscriptions,
      potentialSavings,
      noRecentReceipt: noRecentReceipt.map(s => ({
        id: s.id,
        name: s.service_name,
        amount: s.amount,
        lastReceipt: s.last_receipt_date
      })),
      monthlyTrend
    });

  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

module.exports = router;
// backend/seed.js

const bcrypt = require('bcrypt');
const supabase = require('./config/supabase');
require('dotenv').config();

async function seed() {
  console.log('Starting seed process...');

  // ── Create demo user ──
  const hashedPassword = await bcrypt.hash('demo123', 12);

  const { data: user, error: userError } = await supabase
    .from('users')
    .upsert({
      name: 'Jenish',
      email: 'demo@subscriptiongraveyard.com',
      password: hashedPassword,
      plan: 'free',
      is_demo: true
    }, { onConflict: 'email' })
    .select()
    .single();

  if (userError) {
    console.error('Failed to create user:', userError.message);
    return;
  }

  console.log('Demo user ready:', user.email);

  // ── Clear old demo data ──
  await supabase.from('receipts').delete().eq('user_id', user.id);
  await supabase.from('alerts').delete().eq('user_id', user.id);
  await supabase.from('subscriptions').delete().eq('user_id', user.id);

  // ── Insert subscriptions ──
  const subsToInsert = [
    {
      user_id: user.id,
      source_gmail: 'demo@subscriptiongraveyard.com',
      service_name: 'Canva Pro',
      amount: 499,
      currency: 'INR',
      category: 'Design',
      first_receipt_date: '2024-02-01',
      last_receipt_date: '2025-10-01',
      next_renewal_date: '2026-06-03',
      total_receipts: 20,
      total_spent: 9980,
      cancel_url: 'https://www.canva.com/settings/purchase'
    },
    {
      user_id: user.id,
      source_gmail: 'demo@subscriptiongraveyard.com',
      service_name: 'Adobe Creative Cloud',
      amount: 1675,
      currency: 'INR',
      category: 'Design',
      first_receipt_date: '2024-01-01',
      last_receipt_date: '2025-11-01',
      next_renewal_date: '2026-06-20',
      total_receipts: 22,
      total_spent: 36850,
      cancel_url: 'https://account.adobe.com/plans'
    },
    {
      user_id: user.id,
      source_gmail: 'demo@subscriptiongraveyard.com',
      service_name: 'Notion Pro',
      amount: 350,
      currency: 'INR',
      category: 'Productivity',
      first_receipt_date: '2024-06-01',
      last_receipt_date: '2026-01-01',
      next_renewal_date: '2026-06-07',
      total_receipts: 14,
      total_spent: 4900,
      cancel_url: 'https://www.notion.so/profile/billing'
    },
    {
      user_id: user.id,
      source_gmail: 'demo@subscriptiongraveyard.com',
      service_name: 'NordVPN',
      amount: 270,
      currency: 'INR',
      category: 'Security',
      first_receipt_date: '2025-04-01',
      last_receipt_date: '2026-05-01',
      next_renewal_date: '2026-06-01',
      total_receipts: 14,
      total_spent: 3780,
      cancel_url: 'https://my.nordaccount.com/subscriptions'
    },
    {
      user_id: user.id,
      source_gmail: 'demo@subscriptiongraveyard.com',
      service_name: 'ChatGPT Plus',
      amount: 1650,
      currency: 'INR',
      category: 'AI Tools',
      first_receipt_date: '2025-12-01',
      last_receipt_date: '2026-05-01',
      next_renewal_date: '2026-06-10',
      total_receipts: 6,
      total_spent: 9900,
      cancel_url: 'https://chat.openai.com/account/billing'
    },
    {
      user_id: user.id,
      source_gmail: 'demo@subscriptiongraveyard.com',
      service_name: 'Spotify Premium',
      amount: 119,
      currency: 'INR',
      category: 'Music',
      first_receipt_date: '2023-06-01',
      last_receipt_date: '2026-05-01',
      next_renewal_date: '2026-06-15',
      total_receipts: 36,
      total_spent: 4284,
      cancel_url: 'https://www.spotify.com/account/subscription'
    }
  ];

  const { data: subs } = await supabase
    .from('subscriptions')
    .insert(subsToInsert)
    .select();

  console.log('Subscriptions created:', subs.length);

  // ── Create receipt history ──
  for (const sub of subs) {
    const receipts = [];
    const startDate = new Date(sub.first_receipt_date);

    for (let i = 0; i < Math.min(sub.total_receipts, 12); i++) {
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + i);

      receipts.push({
        user_id: user.id,
        subscription_id: sub.id,
        gmail_message_id: `demo_${sub.id}_${i}`,
        amount: sub.amount,
        receipt_date: date.toISOString().split('T')[0],
        raw_subject: `${sub.service_name} receipt - ₹${sub.amount}`
      });
    }

    await supabase.from('receipts').insert(receipts);
  }

  console.log('Receipts created');

  // ── Create renewal alerts ──
  for (const sub of subs) {
    if (!sub.next_renewal_date) continue;

    const alertDate = new Date(sub.next_renewal_date);
    alertDate.setDate(alertDate.getDate() - 3);

    await supabase.from('alerts').insert({
      user_id: user.id,
      subscription_id: sub.id,
      alert_date: alertDate.toISOString().split('T')[0],
      days_before: 3,
      sent: false
    });
  }

  console.log('Alerts created');

  // ── Create alert preferences ──
  await supabase
    .from('alert_preferences')
    .upsert({
      user_id: user.id,
      email_alerts: true,
      days_before: 3,
      weekly_digest: true
    }, { onConflict: 'user_id' });

  console.log('');
  console.log('=============================');
  console.log('SEED COMPLETE');
  console.log('=============================');
  console.log('Demo credentials:');
  console.log('Email: demo@subscriptiongraveyard.com');
  console.log('Password: demo123');
  console.log('=============================');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
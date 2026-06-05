-- =============================================
-- SUBSCRIPTION GRAVEYARD — DATABASE SCHEMA
-- Run each block separately in Supabase SQL Editor
-- =============================================

-- ─── BLOCK 1: USERS TABLE ────────────────────────────
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  plan TEXT DEFAULT 'free',
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── BLOCK 2: GMAIL ACCOUNTS TABLE ───────────────────
CREATE TABLE gmail_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  gmail_address TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  is_primary BOOLEAN DEFAULT false,
  last_scanned TIMESTAMP WITH TIME ZONE,
  emails_scanned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── BLOCK 3: SUBSCRIPTIONS TABLE ────────────────────
CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  source_gmail TEXT,
  service_name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  category TEXT DEFAULT 'Other',
  first_receipt_date DATE,
  last_receipt_date DATE,
  next_renewal_date DATE,
  total_receipts INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  cancel_url TEXT,
  user_marked TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── BLOCK 4: RECEIPTS TABLE ─────────────────────────
CREATE TABLE receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  gmail_message_id TEXT UNIQUE,
  amount DECIMAL(10,2),
  receipt_date DATE,
  raw_subject TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── BLOCK 5: ALERTS TABLE ──────────────────────────
CREATE TABLE alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  alert_date DATE,
  days_before INTEGER DEFAULT 3,
  sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── BLOCK 6: ALERT PREFERENCES TABLE ───────────────
CREATE TABLE alert_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  email_alerts BOOLEAN DEFAULT true,
  days_before INTEGER DEFAULT 3,
  weekly_digest BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── BLOCK 7: ENABLE ROW LEVEL SECURITY ─────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;

-- ─── BLOCK 8: RLS POLICIES ──────────────────────────
-- Allow service_role (backend) full access
-- These policies allow the backend to manage all data
CREATE POLICY "Service role full access on users" ON users FOR ALL USING (true);
CREATE POLICY "Service role full access on gmail_accounts" ON gmail_accounts FOR ALL USING (true);
CREATE POLICY "Service role full access on subscriptions" ON subscriptions FOR ALL USING (true);
CREATE POLICY "Service role full access on receipts" ON receipts FOR ALL USING (true);
CREATE POLICY "Service role full access on alerts" ON alerts FOR ALL USING (true);
CREATE POLICY "Service role full access on alert_preferences" ON alert_preferences FOR ALL USING (true);

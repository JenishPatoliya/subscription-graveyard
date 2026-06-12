// backend/check-db.js
const supabase = require('./config/supabase');

async function showAllData() {
  console.log('Connecting to Supabase...');

  // 1. Fetch Users
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, name, email, plan, is_demo');

  if (userError) {
    console.error('Error fetching users:', userError.message);
    return;
  }

  // 2. Fetch Connected Gmails
  const { data: gmailAccounts, error: gmailError } = await supabase
    .from('gmail_accounts')
    .select('user_id, gmail_address, emails_scanned, last_scanned');

  if (gmailError) {
    console.error('Error fetching gmail accounts:', gmailError.message);
    return;
  }

  // 3. Fetch Subscriptions
  const { data: subscriptions, error: subError } = await supabase
    .from('subscriptions')
    .select('user_id, service_name, amount, currency, category, source_gmail');

  if (subError) {
    console.error('Error fetching subscriptions:', subError.message);
    return;
  }

  // Format and Display in terminal using tables
  console.log('\n==================================================================');
  console.log('👥 REGISTERED USERS');
  console.log('==================================================================');
  console.table(users);

  console.log('\n==================================================================');
  console.log('📧 CONNECTED GMAIL ACCOUNTS');
  console.log('==================================================================');
  if (gmailAccounts.length === 0) {
    console.log('No connected Gmail accounts found.');
  } else {
    console.table(gmailAccounts);
  }

  console.log('\n==================================================================');
  console.log('💳 ACTIVE SUBSCRIPTIONS DETECTED');
  console.log('==================================================================');
  if (subscriptions.length === 0) {
    console.log('No subscriptions found in the database.');
  } else {
    console.table(subscriptions);
  }
  console.log('==================================================================\n');
}

showAllData();

// backend/config/supabase.js

// Import supabase package
const { createClient } = require('@supabase/supabase-js');

// Load environment variables from .env file
require('dotenv').config();

// Create database connection using your credentials
const supabase = createClient(
  process.env.SUPABASE_URL,        // Your Supabase project URL
  process.env.SUPABASE_SERVICE_KEY // Service key has full access
);

// Export so other files can use this connection
module.exports = supabase;
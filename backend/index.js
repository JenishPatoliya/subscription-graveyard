// backend/index.js

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

// ─── MIDDLEWARE ──────────────────────────────────────

// Allow frontend to talk to backend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true  // Required for cookies to work
}));

// Parse JSON request bodies
app.use(express.json());

// Parse cookies from requests
app.use(cookieParser());

// ─── ROUTES ──────────────────────────────────────────

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/gmail',         require('./routes/gmail'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/alerts',        require('./routes/alerts'));
app.use('/api/report',        require('./routes/report'));
app.use('/api/settings',      require('./routes/settings'));

// ─── HEALTH CHECK ────────────────────────────────────

// Used by deployment platforms to verify server is running
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString()
  });
});

// ─── START BACKGROUND WORKER ─────────────────────────

// This starts the email scanning worker
// It runs alongside the server waiting for jobs
try {
  require('./workers/emailWorker');
} catch (err) {
  console.error('Email worker failed to start:', err.message);
  console.log('Server will continue without email scanning worker');
}

// ─── START SERVER ────────────────────────────────────

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
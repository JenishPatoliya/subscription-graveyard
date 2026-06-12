// Auth routes
// backend/routes/auth.js

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const protect = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

// Router creates a mini application for auth routes
const router = express.Router();

// ─── HELPER FUNCTIONS ───────────────────────────────

// Creates JWT token with user information inside
const generateToken = (user) => {
  return jwt.sign(
    // Payload — what to store inside token
    {
      userId: user.id,
      email: user.email,
      plan: user.plan,
      isDemo: user.is_demo
    },
    // Secret key to sign token
    // Anyone with this key can verify token
    // Never expose this key publicly
    process.env.JWT_SECRET,
    // Token expires in 7 days
    // After that user must login again
    { expiresIn: '7d' }
  );
};

// Sets token as browser cookie
const setCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('token', token, {
    // httpOnly means JavaScript cannot read this cookie
    // Protects against XSS attacks
    httpOnly: true,
    // secure means only sent over HTTPS in production
    secure: isProduction,
    // 'none' required for cross-origin (separate frontend/backend domains)
    // 'lax' works when same domain
    sameSite: isProduction ? 'none' : 'lax',
    // Cookie lives for 7 days in milliseconds
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
};

// ─── SIGNUP ROUTE ───────────────────────────────────

// authLimiter runs first — max 10 signups per 15 minutes
router.post('/signup', authLimiter, async (req, res) => {
  try {
    // Destructure values from request body
    // Frontend sends: { name, email, password }
    const { name, email, password } = req.body;

    // ── Validate inputs ──
    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'All fields are required'
      });
    }

    if (!email.includes('@')) {
      return res.status(400).json({
        error: 'Enter a valid email address'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters'
      });
    }

    // ── Check if email already exists ──
    const { data: existing } = await supabase
      .from('users')           // users table
      .select('id')            // only get id to save bandwidth
      .eq('email', email.toLowerCase().trim()) // where email equals
      .single();               // get one result

    if (existing) {
      return res.status(400).json({
        error: 'Email already registered. Please sign in.'
      });
    }

    // ── Hash password ──
    // 12 is salt rounds — higher = more secure but slower
    // 12 is good balance for production
    const hashedPassword = await bcrypt.hash(password, 12);

    // ── Create user in database ──
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword  // Never store plain text
      })
      .select()   // Return the created user
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({
        error: 'Failed to create account. Try again.'
      });
    }

    // ── Create default alert preferences ──
    // Every new user gets default alert settings
    await supabase
      .from('alert_preferences')
      .insert({ user_id: user.id });

    // ── Generate token and set cookie ──
    const token = generateToken(user);
    setCookie(res, token);

    // ── Send response ──
    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        isDemo: user.is_demo
      }
    });

  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ─── LOGIN ROUTE ────────────────────────────────────

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // ── Find user by email ──
    const { data: user } = await supabase
      .from('users')
      .select('*')    // Get all columns including password
      .eq('email', email.toLowerCase().trim())
      .single();

    // Deliberately vague error to not reveal if email exists
    if (!user) {
      return res.status(400).json({
        error: 'Invalid email or password'
      });
    }

    // ── Compare password with stored hash ──
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(400).json({
        error: 'Invalid email or password'
      });
    }

    // ── Generate token ──
    const token = generateToken(user);
    setCookie(res, token);

    // ── Check if Gmail is already connected ──
    // Tells frontend which screen to show after login
    const { data: gmailAccount } = await supabase
      .from('gmail_accounts')
      .select('gmail_address')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        isDemo: user.is_demo
      },
      // demo mode skips Gmail connect screen
      // real mode shows Gmail connect if not connected
      mode: user.is_demo ? 'demo' : 'real',
      gmailConnected: !!gmailAccount
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ─── GET CURRENT USER ───────────────────────────────

// protect middleware runs first — must be logged in
router.get('/me', protect, async (req, res) => {
  try {
    // req.user comes from protect middleware
    const { data: user } = await supabase
      .from('users')
      .select('id, name, email, plan, is_demo, created_at')
      .eq('id', req.user.userId)
      .single();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });

  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ─── LOGOUT ─────────────────────────────────────────

router.post('/logout', (req, res) => {
  // Clear the cookie from browser
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
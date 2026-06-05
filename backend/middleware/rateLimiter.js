// Rate limiter middleware
// backend/middleware/rateLimiter.js

const rateLimit = require('express-rate-limit');

// Strict limiter for login and signup
// Only 10 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes in milliseconds
  max: 10,                   // Maximum 10 requests
  message: {
    error: 'Too many attempts. Try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Looser limiter for normal API calls
// 60 requests per minute is generous for normal use
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,             // 60 requests per minute
  message: {
    error: 'Too many requests. Slow down.'
  }
});

module.exports = { authLimiter, apiLimiter };
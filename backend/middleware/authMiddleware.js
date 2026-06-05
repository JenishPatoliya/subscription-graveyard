// Auth middleware
// backend/middleware/authMiddleware.js

// Import JWT package to verify tokens
const jwt = require('jsonwebtoken');

// This function runs before every protected route
const protect = (req, res, next) => {
  try {
    // Get token from browser cookie
    // Cookie is automatically sent with every request
    const token = req.cookies.token;

    // If no token found user is not logged in
    if (!token) {
      return res.status(401).json({
        error: 'Not logged in. Please sign in.'
      });
    }

    // Verify token is valid and not expired
    // jwt.verify throws error if token is invalid
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user info to request object
    // Now any route can access req.user
    req.user = decoded;
    
    // Call next to continue to the actual route
    next();

  } catch (err) {
    // Handle specific JWT errors
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Session expired. Please sign in again.'
      });
    }
    return res.status(401).json({
      error: 'Invalid session. Please sign in again.'
    });
  }
};

// Export to use in routes
module.exports = protect;
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { createUser, getUserByEmail, createOrUpdateGoogleUser } = require('../database/db');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper function to generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * Register a new user with email and password
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    
    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ success: false, error: 'User already exists' });
    }
    
    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Create user
    const user = await createUser(email, passwordHash, name);
    
    // Generate token
    const token = generateToken(user.id);
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

/**
 * Login with email and password
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    
    // Check if user exists
    const user = await getUserByEmail(email);
    if (!user || !user.password_hash) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    // Generate token
    const token = generateToken(user.id);
    
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

/**
 * Google Sign-In
 * POST /api/auth/google
 */
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ success: false, error: 'ID token is required' });
    }
    
    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;
    
    // Create or update user
    const user = await createOrUpdateGoogleUser(email, name, googleId);

    // Generate token
    const token = generateToken(user.id);
    
    res.json({
      success: true,
      message: 'Google authentication successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ success: false, error: 'Google authentication failed' });
  }
});

module.exports = router;
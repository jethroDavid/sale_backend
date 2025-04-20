require('dotenv').config();
const express = require('express');
const cors = require('cors');
const registerUrlRouter = require('./api/registerUrl');
const authRoutes = require('./api/auth');
const userUrlsRouter = require('./api/userUrls'); // Import the new router
const authMiddleware = require('./middleware/auth');
const { startAllJobs } = require('./cron/cronManager');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:4200', 'http://localhost:8100', 'http://192.168.254.138:8100', 'capacitor://localhost', 'http://localhost'], 
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/register-url', authMiddleware, registerUrlRouter);
app.use('/api/user-urls', authMiddleware, userUrlsRouter); // Add the new route with auth middleware
app.use('/api/auth', authRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start scheduled jobs
  startAllJobs();
});

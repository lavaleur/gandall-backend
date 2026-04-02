require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const tutorRoutes = require('./routes/tutors');
const sessionRoutes = require('./routes/sessions');
const messageRoutes = require('./routes/messages');
const hifzRoutes = require('./routes/hifz');
const paymentRoutes = require('./routes/payments');
const parentalRoutes = require('./routes/parental');

const app = express();
const PORT = process.env.PORT || 4000;

// ── MIDDLEWARE ────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:8081', // Expo dev
    /\.netlify\.app$/,
    /\.railway\.app$/,
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please wait 15 minutes.' }
});

app.use('/api/', limiter);
app.use('/api/auth', authLimiter);

// ── ROUTES ────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status: 'ok',
  service: 'Gandall API',
  version: '1.0.0',
  timestamp: new Date().toISOString()
}));

app.use('/api/auth', authRoutes);
app.use('/api/tutors', tutorRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/hifz', hifzRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/parental', parentalRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── START ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🟢 Gandall API running on port ${PORT}`);
  console.log(`📡 Health: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;

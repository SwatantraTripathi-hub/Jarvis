const express = require('express');
const cors = require('cors');
const app = express();
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth.routes');
require('dotenv').config();
const chatRoutes = require('./routes/chat.routes');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3002',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // allow requests with no origin (mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);

    try {
      const hostname = new URL(origin).hostname;
      if (hostname.endsWith('.onrender.com')) return cb(null, true);
    } catch (error) {
      // Ignore invalid origins and reject them below.
    }

    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());
app.use(express.static(publicDir));

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

app.use((err, req, res, next) => {
  if (!err) return next();

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File too large. Maximum 2MB per file.' });
  }

  if (err.message?.includes('Unsupported file type')) {
    return res.status(400).json({ message: err.message });
  }

  return res.status(500).json({ message: 'Request failed', detail: err.message });
});

// Health check routes — /health is probed by Render, /api/health for API clients
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'JARVIS API is running' });
});

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

module.exports = app;
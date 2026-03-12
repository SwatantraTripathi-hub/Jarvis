const express = require('express');
const cors = require('cors');
const app = express();
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth.routes');
require('dotenv').config();
const chatRoutes = require('./routes/chat.routes');

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3002',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // allow requests with no origin (mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Health check — so Render and browsers can confirm the server is alive
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'JARVIS API is running' });
});

module.exports = app;
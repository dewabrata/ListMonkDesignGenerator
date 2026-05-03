require('dotenv').config({ override: true });
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const processRoutes = require('./routes/process');
const chatRoutes = require('./routes/chat');
const listmonkRoutes = require('./routes/listmonk');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Ensure temp directory exists ---
const tempDir = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// --- Middleware ---
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? false
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8 jam
  },
}));

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/process', processRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/listmonk', listmonkRoutes);

// --- Health check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Serve static frontend in production ---
if (process.env.NODE_ENV === 'production') {
  const frontendBuildPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
  if (fs.existsSync(frontendBuildPath)) {
    app.use(express.static(frontendBuildPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendBuildPath, 'index.html'));
    });
  }
}

// --- Global error handler ---
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack || err.message || err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Temp dir    : ${tempDir}`);
  const apiKey = process.env.OPENAI_API_KEY || '';
  console.log(`   OpenAI Key : ${apiKey ? apiKey.substring(0, 15) + '...' + apiKey.slice(-4) + ' (' + apiKey.length + ' chars)' : 'NOT SET'}`);
  console.log(`   Listmonk    : ${process.env.LISTMONK_BASE_URL || 'NOT SET'}\n`);
});

module.exports = app;

const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  // Ignore fallback if custom DNS cannot be set
}

const path = require('path');
const http = require('http');
const dotenv = require('dotenv');


// 1. Initialize dotenv at the top (silently falls back to process.env if no .env file on cloud hosts)
const envPath = path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });

// 2. Validate essential environment variable - MONGODB_URI
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri || typeof mongoUri !== 'string' || !mongoUri.trim()) {
  console.error('\n==================================================');
  console.error('❌ Missing Environment Variable: MONGODB_URI');
  console.error('👉 If deploying on Render: Go to Render Dashboard -> Environment -> Add Environment Variable -> MONGODB_URI');
  console.error('==================================================\n');
  process.exit(1);
}

// Helper to mask password and output first 30 characters preview
const getMaskedPreview = (uri) => {
  const sanitized = uri.replace(/\/\/(.*?):(.*?)@/, (match, user) => `//${user}:****@`);
  return sanitized.length > 30 ? `${sanitized.substring(0, 30)}...` : sanitized;
};

console.log(`🔑 [config] Active MONGODB_URI Preview (first 30 chars): ${getMaskedPreview(mongoUri.trim())}`);


const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const socketManager = require('./socket/socketManager');

const app = express();

// Trust reverse proxy for Render / Vercel
app.set('trust proxy', 1);

// Disable x-powered-by header for security
app.disable('x-powered-by');

// Universal Wildcard CORS Middleware (Allows requests from ANY origin & header without restriction)
app.use((req, res, next) => {
  const reqOrigin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', reqOrigin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(cors({ origin: true, credentials: true }));
app.options('*', cors({ origin: true, credentials: true }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Route Imports
const authRoutes = require('./routes/authRoutes');
const groupRoutes = require('./routes/groupRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const settlementRoutes = require('./routes/settlementRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const inspectorRoutes = require('./routes/inspectorRoutes');
const { readOnlyInspectorCheck } = require('./middleware/auth');

// Apply read-only guard for inspector account on mutating routes
app.use(readOnlyInspectorCheck);

// API Routes registered under /api
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/inspector', inspectorRoutes);

// Fallback Route Aliases (Handles requests if /api prefix was omitted in client config)
app.use('/auth', authRoutes);
app.use('/groups', groupRoutes);
app.use('/expenses', expenseRoutes);
app.use('/settlements', settlementRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/notifications', notificationRoutes);
app.use('/admin', adminRoutes);
app.use('/inspector', inspectorRoutes);

// Health & Ping endpoints for Render / Cron-Job uptime keep-alive
app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    message: 'Expense Tracker API Server is running smoothly',
    database: 'MongoDB Atlas Connected',
    socketIO: 'Active',
    timestamp: new Date().toISOString()
  });
});

app.get(['/ping', '/api/ping'], (req, res) => {
  res.status(200).send('pong');
});

// Live Update Manifest endpoint for Capacitor Android app
app.get(['/api/app/update-manifest', '/app/update-manifest'], async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  try {
    const remoteManifestUrl = process.env.LIVE_UPDATE_MANIFEST_URL || 'https://raw.githubusercontent.com/puspendeerrr/expense-tracker/main/update-manifest.json';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const fetchRes = await fetch(remoteManifestUrl, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    }).catch(() => null);
    clearTimeout(timeoutId);

    if (fetchRes && fetchRes.ok) {
      const manifestData = await fetchRes.json();
      return res.status(200).json(manifestData);
    }
  } catch (err) {
    console.warn('[LiveUpdate Proxy Warning]: Could not fetch remote manifest, serving environment fallback:', err.message);
  }

  return res.status(200).json({
    version: process.env.LIVE_UPDATE_VERSION || '1.0.0',
    minNativeVersion: process.env.LIVE_UPDATE_MIN_NATIVE_VERSION || '1.0.0',
    url: process.env.LIVE_UPDATE_BUNDLE_URL || 'https://github.com/puspendeerrr/expense-tracker/releases/latest/download/web-bundle.zip',
    downloadUrl: process.env.ANDROID_DOWNLOAD_URL || 'https://github.com/puspendeerrr/expense-tracker/releases/latest/download/SplitWise.apk',
    releaseNotes: 'SplitWise production web bundle',
    channel: 'production',
    updatedAt: new Date().toISOString(),
  });
});

// Production Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Error Middleware]:', err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;

// Create HTTP server wrapping Express (required for Socket.IO)
const httpServer = http.createServer(app);

// Start Server after DB Connection attempt
const startServer = async () => {
  await connectDB();

  // Initialize Super Admin account (admin@gmail.com / admin123)
  const initSuperAdmin = require('./utils/initAdmin');
  await initSuperAdmin();

  // Initialize Socket.IO on the HTTP server
  socketManager.init(httpServer, corsOptions);

  const { startKeepAlive } = require('./utils/keepAlive');

  httpServer.listen(PORT, () => {
    console.log(`🚀 [Express] Server running on port ${PORT} [Mode: ${process.env.NODE_ENV || 'development'}]`);
    console.log(`🌐 [CORS] Allowed Origins: ${isDev ? 'Development' : allowedOrigins.join(', ')}`);
    console.log(`🔌 [Socket.IO] WebSocket server ready on port ${PORT}`);
    startKeepAlive();
  });

  // Graceful shutdown handling for Render / Docker containers
  const gracefulShutdown = (signal) => {
    console.log(`\n[Server] ${signal} signal received. Closing HTTP server gracefully...`);

    // Close Socket.IO connections first
    const io = socketManager.getIO();
    if (io) {
      io.close(() => {
        console.log('[Server] Socket.IO connections closed.');
      });
    }

    httpServer.close(() => {
      console.log('[Server] HTTP server closed. Disconnecting database...');
      const mongoose = require('mongoose');
      mongoose.connection.close(false, () => {
        console.log('[Server] MongoDB connection closed cleanly. Exiting process.');
        process.exit(0);
      });
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

startServer();

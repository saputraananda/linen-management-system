import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import authRoutes from './api/routes/auth/auth.routes.js';
import ikmDashboardRoutes from './api/routes/ikm/dashboard.routes.js';
import ikmSerahTerimaRoutes from './api/routes/ikm/serahTerima.routes.js';
import ikmKurangKirimRoutes from './api/routes/ikm/kurangKirimLinen.routes.js';
import rsDashboardRoutes from './api/routes/rs/rs-dashboard.routes.js';
import rsSerahTerimaRoutes from './api/routes/rs/rs-serahTerima.routes.js';

// Resolve directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
const envFile = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env';
const envPath = path.resolve(__dirname, envFile);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ==========================
// Static Storage
// ==========================

// UPLOAD_BASE_DIR = folder dasar tempat file upload disimpan
//   dev  : 'assets'  (relative)
//   prod : '/home/u299848391/domains/linen.ikmalora.com/storage/assets/'
const UPLOAD_BASE_DIR = process.env.UPLOAD_BASE_DIR;

if (UPLOAD_BASE_DIR && path.isAbsolute(UPLOAD_BASE_DIR)) {
  const STORAGE_PATH = path.dirname(UPLOAD_BASE_DIR.replace(/\/$/, ''));
  app.use('/storage', express.static(STORAGE_PATH));
} else {
  // Development (relative path)
  const resolvedBaseDir = path.resolve(process.cwd(), UPLOAD_BASE_DIR || 'assets');
  app.use('/storage/assets', express.static(resolvedBaseDir));
}

// ==========================
// API
// ==========================

app.use('/api/auth', authRoutes);
app.use('/api/ikm', ikmDashboardRoutes);
app.use('/api/ikm', ikmSerahTerimaRoutes);
app.use('/api/ikm', ikmKurangKirimRoutes);
app.use('/api/rs', rsDashboardRoutes);
app.use('/api/rs', rsSerahTerimaRoutes);

// ==========================
// Frontend
// ==========================

if (process.env.NODE_ENV === 'production') {

  app.use(express.static(path.join(__dirname, 'dist')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });

} else {

  app.get('/', (req, res) => {
    res.send('IKM Linen Monitoring API Server is running.');
  });

}

// ==========================
// Error Handler
// ==========================

app.use((err, req, res, next) => {
  console.error('[EXPRESS ERROR]', err);

  // If a fatal database connection error occurs (ECONNRESET, connection lost)
  if (err && (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST' || err.fatal)) {
    console.error('[FATAL DB ERROR] Database connection lost/reset. Exiting process to trigger automatic server restart...');
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Koneksi database terputus. Server sedang melakukan pemulihan otomatis, silakan coba beberapa detik lagi.'
      });
    }
    setTimeout(() => {
      process.exit(1);
    }, 300);
    return;
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Payload terlalu besar'
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Internal Server Error'
  });
});

// ==========================
// Automatic Server Restart on Fatal Connection Errors
// ==========================

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
  if (err && (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR' || err.fatal)) {
    console.error('[FATAL PROCESS ERROR] Fatal database error caught. Triggering automatic server restart...');
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
  if (reason && (reason.code === 'ECONNRESET' || reason.code === 'PROTOCOL_CONNECTION_LOST' || reason.code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR' || reason.fatal)) {
    console.error('[FATAL PROCESS ERROR] Fatal database error caught. Triggering automatic server restart...');
    process.exit(1);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import authRoutes from './api/routes/auth/auth.routes.js';
import ikmDashboardRoutes from './api/routes/ikm/dashboard.routes.js';
import ikmSerahTerimaRoutes from './api/routes/ikm/serahTerima.routes.js';

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
  console.error(err);

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
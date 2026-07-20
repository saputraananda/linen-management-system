import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure env variables are loaded if this file is imported directly in tests/scripts
const envFile = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env';
const envPath = path.resolve(__dirname, '../../', envFile);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

export const mainPool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 30000, // 30 detik
  connectTimeout: 10000         // 10 detik timeout koneksi
});

export const ikmPool = mysql.createPool({
  host: process.env.DB_HOST_IKM,
  port: parseInt(process.env.DB_PORT_IKM || '3306'),
  user: process.env.DB_USER_IKM,
  password: process.env.DB_PASS_IKM,
  database: process.env.DB_NAME_IKM,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 30000, // 30 detik
  connectTimeout: 10000         // 10 detik timeout koneksi
});

export default {
  mainPool,
  ikmPool
};

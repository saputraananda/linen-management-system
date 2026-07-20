import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure correct env config is loaded securely using absolute paths
const envFile = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env';
const envPath = path.resolve(__dirname, '../../', envFile);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

/**
 * Helper untuk menghasilkan URL publik signature
 * Selalu menghasilkan: /storage/assets/serahterimalinen/<filename>
 */
export const getSignatureUrl = (filename) => {
  if (!filename) return null;

  const urlPrefix = '/storage/assets/serahterimalinen';

  // Jika berupa path (legacy /assets/... atau /storage/...) → ambil filename saja
  if (filename.startsWith('/')) {
    return `${urlPrefix}/${path.basename(filename)}`;
  }

  // Plain filename
  return `${urlPrefix}/${filename}`;
};

/**
 * Helper untuk menyimpan gambar Base64 ke disk
 */
export const saveBase64Image = (base64Str, prefix, transactionId) => {
  if (!base64Str) return null;

  // Sudah berupa URL/path → ambil filename saja
  if (base64Str.startsWith('/') || base64Str.startsWith('http')) {
    return path.basename(base64Str);
  }

  // Sudah berupa plain filename (bukan base64) → kembalikan langsung
  if (!base64Str.startsWith('data:') && base64Str.includes('_') && !base64Str.includes(' ')) {
    return base64Str;
  }

  // Tentukan direktori fisik:
  //   Absolut  (prod) : UPLOAD_BASE_DIR/serahterimalinen
  //   Relatif  (dev)  : cwd/UPLOAD_BASE_DIR/serahterimalinen
  const uploadBaseDir = process.env.UPLOAD_BASE_DIR || 'assets';
  const targetDir = path.isAbsolute(uploadBaseDir)
    ? path.join(uploadBaseDir.replace(/\/$/, ''), 'serahterimalinen')
    : path.resolve(process.cwd(), uploadBaseDir, 'serahterimalinen');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Parse base64
  const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  let imageBuffer;
  let extension = 'png';

  if (matches && matches.length === 3) {
    extension = matches[1].split('/')[1] || 'png';
    imageBuffer = Buffer.from(matches[2], 'base64');
  } else {
    imageBuffer = Buffer.from(base64Str, 'base64');
  }

  const filename = `${prefix}_${transactionId}_${Date.now()}.${extension}`;
  fs.writeFileSync(path.join(targetDir, filename), imageBuffer);

  return filename;
};

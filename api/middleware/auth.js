import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Akses ditolak. Token otentikasi tidak ditemukan."
    });
  }

  jwt.verify(token, process.env.SESSION_SECRET || 'ikmsecret', (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: "Token tidak valid atau kadaluwarsa. Silakan masuk kembali."
      });
    }
    req.user = user;
    next();
  });
};

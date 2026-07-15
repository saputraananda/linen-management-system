import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { mainPool, ikmPool } from '../../db/pool.js';

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username dan password wajib diisi"
      });
    }

    // 1. Cek di mainPool (mst_employee melalui tabel users)
    const employeeQuery = `
      SELECT u.id, u.username, u.password_hash, u.email, u.role,
             e.full_name, e.profile_path,
             p.position_name, d.department_name
      FROM users u
      INNER JOIN mst_employee e ON u.id = e.employee_id
      LEFT JOIN mst_position p ON e.position_id = p.position_id
      LEFT JOIN mst_department d ON e.department_id = d.department_id
      WHERE u.username = ? OR u.email = ?
      LIMIT 1
    `;

    const [employees] = await mainPool.query(employeeQuery, [username, username]);

    if (employees.length > 0) {
      const emp = employees[0];
      const isMatch = bcrypt.compareSync(password, emp.password_hash);
      if (isMatch) {
        // Generate Token
        const token = jwt.sign(
          {
            id: emp.id,
            username: emp.username,
            role: "valet", // bagian dari ikm
            fullName: emp.full_name,
            position: emp.position_name || 'Staff',
            department: emp.department_name || 'PT IKM',
            profilePath: emp.profile_path
          },
          process.env.SESSION_SECRET || 'ikmsecret',
          { expiresIn: '24h' }
        );

        return res.status(200).json({
          success: true,
          message: "Login berhasil sebagai bagian dari IKM",
          role: "valet",
          redirect: "/valet",
          token,
          user: {
            id: emp.id,
            username: emp.username,
            fullName: emp.full_name,
            position: emp.position_name || 'Staff',
            department: emp.department_name || 'PT IKM',
            profilePath: emp.profile_path
          }
        });
      } else {
        return res.status(401).json({
          success: false,
          message: "Username atau password salah"
        });
      }
    }

    // 2. Cek di ikmPool (mst_hospital)
    const hospitalQuery = `
      SELECT id, hospital_name, hospital_id, username, password
      FROM mst_hospital
      WHERE username = ?
      LIMIT 1
    `;

    const [hospitals] = await ikmPool.query(hospitalQuery, [username]);

    if (hospitals.length > 0) {
      const hosp = hospitals[0];
      // Bandingkan password plain-text
      if (password === hosp.password) {
        const token = jwt.sign(
          {
            id: hosp.id,
            username: hosp.username,
            role: "rs",
            fullName: hosp.hospital_name,
            hospitalId: hosp.hospital_id
          },
          process.env.SESSION_SECRET || 'ikmsecret',
          { expiresIn: '24h' }
        );

        return res.status(200).json({
          success: true,
          message: "Login berhasil sebagai Rumah Sakit",
          role: "rs",
          redirect: "/rs",
          token,
          user: {
            id: hosp.id,
            username: hosp.username,
            fullName: hosp.hospital_name,
            hospitalId: hosp.hospital_id
          }
        });
      } else {
        return res.status(401).json({
          success: false,
          message: "Username atau password salah"
        });
      }
    }

    // Jika tidak ditemukan di manapun
    return res.status(401).json({
      success: false,
      message: "Username atau password tidak terdaftar"
    });

  } catch (error) {
    console.error("Auth login error:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message
    });
  }
};

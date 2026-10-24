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

    // 1b. User perawat unit (mst_users_rs) - nama terkunci ke akun
    const [nurses] = await ikmPool.query(
      `SELECT u.id, u.hospital_id, u.nurse_name, u.username, u.password, u.role, u.is_active,
              h.hospital_name, h.hospital_id AS hospital_code
       FROM mst_users_rs u
       INNER JOIN mst_hospital h ON h.id = u.hospital_id
       WHERE u.username = ?`, [username]);
    const nurse = nurses.find(n => n.password === password);
    if (nurse) {
      if (!nurse.is_active) {
        return res.status(403).json({ success: false, message: "Akun dinonaktifkan. Hubungi Tim Linen Rumah Sakit." });
      }
      const isRs = nurse.role === 'rs';
      const [rr] = isRs ? [[]] : await ikmPool.query("SELECT room_id FROM mst_users_rs_rooms WHERE user_id = ?", [nurse.id]);
      const roomIds = rr.map(r => r.room_id);
      const info = {
        id: nurse.hospital_id,
        userUnitId: nurse.id,
        username: nurse.username,
        fullName: nurse.hospital_name,
        nurseName: nurse.nurse_name,
        roomIds,
        hospitalId: nurse.hospital_code
      };
      const token = jwt.sign({ ...info, role: isRs ? "rs" : "unit" }, process.env.SESSION_SECRET || 'ikmsecret', { expiresIn: '24h' });
      return res.status(200).json({
        success: true,
        message: isRs ? "Login berhasil sebagai User RS" : "Login berhasil sebagai Perawat Unit",
        role: isRs ? "rs" : "unit",
        redirect: isRs ? "/rs" : "/unit",
        token,
        user: info
      });
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

    // 3. Cek di ikmPool untuk Unit Rumah Sakit (mst_hospital)
    const unitQuery = `
      SELECT id, hospital_name, hospital_id, username_unit, password_unit
      FROM mst_hospital
      WHERE username_unit = ?
      LIMIT 1
    `;

    const [units] = await ikmPool.query(unitQuery, [username]);

    if (units.length > 0) {
      const u = units[0];
      // Bandingkan password plain-text
      if (password === u.password_unit) {
        const token = jwt.sign(
          {
            id: u.id,
            username: u.username_unit,
            role: "unit",
            fullName: u.hospital_name,
            hospitalId: u.hospital_id
          },
          process.env.SESSION_SECRET || 'ikmsecret',
          { expiresIn: '24h' }
        );

        return res.status(200).json({
          success: true,
          message: "Login berhasil sebagai Unit Rumah Sakit",
          role: "unit",
          redirect: "/unit",
          token,
          user: {
            id: u.id,
            username: u.username_unit,
            fullName: u.hospital_name,
            hospitalId: u.hospital_id
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

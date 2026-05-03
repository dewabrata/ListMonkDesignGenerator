const bcrypt = require('bcrypt');

/**
 * POST /api/auth/login
 */
const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username dan password wajib diisi.' });
  }

  const validUsername = process.env.AUTH_USERNAME || 'admin';
  const passwordHash = process.env.AUTH_PASSWORD_HASH;

  if (!passwordHash) {
    console.error('[Auth] AUTH_PASSWORD_HASH tidak dikonfigurasi di .env');
    return res.status(500).json({ success: false, message: 'Konfigurasi server tidak lengkap.' });
  }

  try {
    const usernameMatch = username === validUsername;
    const passwordMatch = await bcrypt.compare(password, passwordHash);

    if (!usernameMatch || !passwordMatch) {
      return res.status(401).json({ success: false, message: 'Username atau password salah.' });
    }

    req.session.userId = validUsername;
    req.session.createdAt = Date.now();

    return res.json({ success: true });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
};

/**
 * POST /api/auth/logout
 */
const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('[Auth] Logout error:', err);
      return res.status(500).json({ success: false, message: 'Gagal logout.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ success: true });
  });
};

/**
 * GET /api/auth/me — cek status auth
 */
const me = (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({ success: true, userId: req.session.userId });
  }
  return res.status(401).json({ success: false });
};

module.exports = { login, logout, me };

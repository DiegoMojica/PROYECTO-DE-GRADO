const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'verysecret';

// Register (simple)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const user = new User({ name, email, role });
    if (password) await user.setPassword(password);
    await user.save();
    res.json({ ok: true, userId: user._id });
  } catch (err) {
    console.error(err);
    res.status(400).json({ ok: false, error: 'Registro fallido' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ ok: false, error: 'Usuario no existe' });
    const valid = await user.validatePassword(password);
    if (!valid) return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
    const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ ok: true, token, user: { id: user._id, name: user.name, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

module.exports = router;
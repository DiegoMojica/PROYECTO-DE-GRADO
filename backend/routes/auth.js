const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'verysecret';

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Se requiere rol administrador' });
  }
  return next();
}

// Register (simple)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ ok: false, error: 'Nombre, correo y contrasena son obligatorios' });
    }
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ ok: false, error: 'El correo ya esta registrado' });
    }
    const user = new User({ name, email, role });
    await user.setPassword(password);
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
    if (!valid) return res.status(401).json({ ok: false, error: 'Credenciales invalidas' });
    const token = jwt.sign({ id: user._id, role: user.role, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ ok: true, token, user: { id: user._id, name: user.name, role: user.role, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.get('/me', auth(), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name email role createdAt');
    if (!user) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    res.json({ ok: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.get('/users', auth(), async (req, res) => {
  try {
    if (!['admin', 'agent'].includes(req.user.role)) {
      return res.status(403).json({ ok: false, error: 'No autorizado' });
    }
    const users = await User.find().select('name email role createdAt');
    res.json({ ok: true, users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.post('/admin/users', auth(), requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role = 'client' } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ ok: false, error: 'Nombre, correo y contrasena son obligatorios' });
    }
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ ok: false, error: 'El correo ya esta registrado' });
    const user = new User({ name, email, role });
    await user.setPassword(password);
    await user.save();
    res.json({ ok: true, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(400).json({ ok: false, error: 'No se pudo crear usuario' });
  }
});

router.put('/admin/users/:id', auth(), requireAdmin, async (req, res) => {
  try {
    const { name, role, password, email } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    if (String(user._id) === String(req.user.id) && role && role !== 'admin') {
      return res.status(400).json({ ok: false, error: 'No puedes cambiar tu proprio rol' });
    }
    if (email && email !== user.email) {
      const emailTaken = await User.findOne({ email });
      if (emailTaken && String(emailTaken._id) !== String(user._id)) {
        return res.status(409).json({ ok: false, error: 'El correo ya esta en uso' });
      }
      user.email = email;
    }
    if (name) user.name = name;
    if (role) user.role = role;
    if (password) await user.setPassword(password);
    await user.save();
    res.json({ ok: true, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(400).json({ ok: false, error: 'No se pudo actualizar usuario' });
  }
});

router.delete('/admin/users/:id', auth(), requireAdmin, async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ ok: false, error: 'No puedes eliminar tu propia cuenta' });
    }
    await User.deleteOne({ _id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ ok: false, error: 'No se pudo eliminar usuario' });
  }
});

module.exports = router;

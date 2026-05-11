const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'verysecret';
const ROLE_VALUES = ['client', 'agent', 'programmer', 'admin'];

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Se requiere rol administrador' });
  }
  return next();
}

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function isValidRole(role) {
  return ROLE_VALUES.includes(role);
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

// Register (simple)
router.post('/register', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ ok: false, error: 'Nombre, correo y contrasena son obligatorios' });
    }
    if (password.length < 6) {
      return res.status(400).json({ ok: false, error: 'La contrasena debe tener al menos 6 caracteres' });
    }
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ ok: false, error: 'El correo ya esta registrado' });
    }
    const user = new User({ name, email, role: 'client' });
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
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
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
    const name = String(req.body.name || '').trim();
    const email = normalizeEmail(req.body.email);
    const { password, role = 'client' } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ ok: false, error: 'Nombre, correo y contrasena son obligatorios' });
    }
    if (!isValidRole(role)) {
      return res.status(400).json({ ok: false, error: 'Rol invalido' });
    }
    if (password.length < 6) {
      return res.status(400).json({ ok: false, error: 'La contrasena debe tener al menos 6 caracteres' });
    }
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ ok: false, error: 'El correo ya esta registrado' });
    const user = new User({ name, email, role });
    await user.setPassword(password);
    await user.save();
    res.status(201).json({ ok: true, user: publicUser(user) });
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
      return res.status(400).json({ ok: false, error: 'No puedes cambiar tu propio rol' });
    }
    const nextEmail = email ? normalizeEmail(email) : '';
    if (nextEmail && nextEmail !== user.email) {
      const emailTaken = await User.findOne({ email: nextEmail });
      if (emailTaken && String(emailTaken._id) !== String(user._id)) {
        return res.status(409).json({ ok: false, error: 'El correo ya esta en uso' });
      }
      user.email = nextEmail;
    }
    if (name) user.name = String(name).trim();
    if (role) {
      if (!isValidRole(role)) {
        return res.status(400).json({ ok: false, error: 'Rol invalido' });
      }
      user.role = role;
    }
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ ok: false, error: 'La contrasena debe tener al menos 6 caracteres' });
      }
      await user.setPassword(password);
    }
    await user.save();
    res.json({ ok: true, user: publicUser(user) });
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

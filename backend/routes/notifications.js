const express = require('express');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth());

router.get('/', async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ ok: true, notifications });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'No se pudieron obtener las notificaciones' });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ ok: false, error: 'Notificacion no encontrada' });
    res.json({ ok: true, notification });
  } catch (err) {
    console.error(err);
    res.status(400).json({ ok: false, error: 'No se pudo actualizar la notificacion' });
  }
});

module.exports = router;

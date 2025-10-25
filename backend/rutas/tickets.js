const express = require('express');
const Ticket = require('../models/Ticket');
const router = express.Router();

// Create ticket
router.post('/', async (req, res) => {
  try {
    const { title, description, company, createdBy, priority } = req.body;
    const ticket = new Ticket({ title, description, company, createdBy, priority });
    await ticket.save();
    res.json({ ok: true, ticket });
  } catch (err) {
    console.error(err);
    res.status(400).json({ ok: false, error: 'No se pudo crear ticket' });
  }
});

// Get tickets (simple, supports query by user)
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    const filter = userId ? { createdBy: userId } : {};
    const tickets = await Ticket.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json({ ok: true, tickets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error al obtener tickets' });
  }
});

// Get single
router.get('/:id', async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    res.json({ ok: true, ticket });
  } catch (err) {
    console.error(err);
    res.status(404).json({ ok: false, error: 'Ticket no encontrado' });
  }
});

// Update (status, assign, messages)
router.put('/:id', async (req, res) => {
  try {
    const update = req.body;
    const ticket = await Ticket.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ ok: true, ticket });
  } catch (err) {
    console.error(err);
    res.status(400).json({ ok: false, error: 'No se pudo actualizar ticket' });
  }
});

// Add message
router.post('/:id/message', async (req, res) => {
  try {
    const { authorId, text } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    ticket.messages.push({ authorId, text });
    await ticket.save();
    res.json({ ok: true, ticket });
  } catch (err) {
    console.error(err);
    res.status(400).json({ ok: false, error: 'No se pudo añadir mensaje' });
  }
});

module.exports = router;
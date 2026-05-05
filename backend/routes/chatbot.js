const express = require('express');
const auth = require('../middleware/auth');
const { handleChatMessageCore } = require('../chatbot/openaiChat');

const router = express.Router();

router.post('/', auth(), async (req, res) => {
  try {
    const message = String(req.body?.message || req.body?.text || '').trim();
    const ticketContext = String(req.body?.ticketContext || '').trim();

    if (!message) {
      return res.status(400).json({ ok: false, error: 'message requerido' });
    }

    const payload = {
      userId: req.user?.id || null,
      room: null,
      text: ticketContext ? `${message}\n\nContexto ticket:\n${ticketContext}` : message
    };

    const result = await handleChatMessageCore(payload, req.app.get('io'), false);
    return res.json(result);
  } catch (error) {
    console.error('POST /api/chatbot error', error);
    return res.status(500).json({ ok: false, error: 'No se pudo procesar el chatbot' });
  }
});

module.exports = router;

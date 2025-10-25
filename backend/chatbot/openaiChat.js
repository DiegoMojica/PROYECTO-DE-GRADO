const Ticket = require('../models/Ticket');
require('dotenv').config();

const OPENAI_KEY = process.env.OPENAI_API_KEY;

// Build call to OpenAI using global fetch (Node 18+)
async function callOpenAI(messages) {
  if (!OPENAI_KEY) {
    return "Asistente: la funcionalidad de IA no está configurada. Contacte al administrador.";
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages,
      max_tokens: 500,
      temperature: 0.2,
    }),
  });
  const data = await res.json();
  return (data.choices?.[0]?.message?.content) || 'Lo siento, no pude generar una respuesta.';
}

// payload: { userId, text, room }
async function handleChatMessageSocket(payload, io) {
  const messages = [
    { role: 'system', content: 'Eres un asistente de soporte técnico que ayuda a usuarios a resolver problemas comunes y a guiar en la creación de tickets; cuando sea necesario sugiere crear un ticket.' },
    { role: 'user', content: payload.text }
  ];

  const reply = await callOpenAI(messages);

  // Simple rule-based detection for escalation
  const textForDetect = (reply + ' ' + payload.text).toLowerCase();
  if (/escalar|no puedo|no funciona|urgente|error crítico|necesito.*soporte/.test(textForDetect)) {
    const ticket = new Ticket({
      title: `Escalada desde chatbot: ${payload.text.slice(0,40)}`,
      description: `${payload.text}\n\nRespuesta bot: ${reply}`,
      createdBy: payload.userId || null,
      priority: 'medium'
    });
    await ticket.save();
    const message = `${reply}\n\nSe ha creado un ticket con ID ${ticket._id}. El equipo lo revisará.`;
    // Emit to room
    if (payload.room) io.to(payload.room).emit('chat_reply', { reply: message });
    return message;
  }

  if (payload.room) io.to(payload.room).emit('chat_reply', { reply });
  return reply;
}

module.exports = { handleChatMessageSocket };
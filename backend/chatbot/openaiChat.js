const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Notification = require('../models/Notification');
require('dotenv').config();

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const HF_KEY = process.env.HF_API_KEY;
const HF_MODEL = process.env.HF_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2';

async function callOpenAI(messages) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages,
      max_tokens: 500,
      temperature: 0.2
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('OpenAI request failed', errorText);
    return null;
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || 'Lo siento, no pude generar una respuesta.';
}

async function callHuggingFace(messages) {
  if (!HF_KEY) return null;
  const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HF_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: HF_MODEL,
      messages,
      max_tokens: 400,
      temperature: 0.4
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('Hugging Face request failed', errorText);
    return null;
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

function normalize(text = '') {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isLikelyTicketId(text = '') {
  const match = text.match(/[a-f0-9]{24}/i);
  return match ? match[0] : null;
}

const STATUS_LABELS = {
  open: 'abierto',
  in_progress: 'en progreso',
  awaiting_client: 'esperando respuesta del cliente',
  resolved: 'resuelto',
  closed: 'cerrado'
};

async function fetchTicketStatus(ticketId, userId) {
  if (!ticketId) return null;
  const ticket = await Ticket.findById(ticketId)
    .populate([
      { path: 'assignedAgent', select: 'name' },
      { path: 'assignedProgrammer', select: 'name' },
      { path: 'createdBy', select: 'name email' }
    ])
    .lean();
  if (!ticket) return { message: 'No encontré un ticket con ese identificador.' };

  const watchers =
    ticket.watchers?.map((watcher) => {
      if (!watcher) return null;
      if (watcher._id) return String(watcher._id);
      return String(watcher);
    }).filter(Boolean) || [];
  if (userId && ticket.createdBy?._id) watchers.push(String(ticket.createdBy._id));

  if (userId && !watchers.includes(String(userId))) {
    return {
      message:
        'Ese ticket pertenece a otro usuario. Puedes compartir el número con el equipo para que te habiliten acceso.'
    };
  }

  const status = STATUS_LABELS[ticket.status] || ticket.status;
  const updatedAt = ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString('es-CO') : 'Sin registro';
  const assignedAgent = ticket.assignedAgent?.name || 'Sin asignar';
  const programmer = ticket.assignedProgrammer?.name || 'Pendiente';

  return {
    message: `El ticket ${ticketId.slice(-6)} está ${status}. Asesor: ${assignedAgent}. Programador: ${programmer}. Última actualización: ${updatedAt}.`
  };
}

async function createTicketFromChat(payload, reason, io) {
  const watchers = payload.userId ? [payload.userId] : [];
  const ticket = new Ticket({
    title: `Chatbot: ${reason.slice(0, 40) || 'Nueva consulta'}`,
    description: `${reason}\n\nConsulta del usuario:\n${payload.text}`,
    createdBy: payload.userId || null,
    priority: 'medium',
    watchers
  });
  await ticket.save();

  const recipients = await User.find({ role: { $in: ['agent', 'admin'] } }, '_id').lean();
  const toNotify = recipients.map((user) => String(user._id)).filter((id) => !watchers.includes(id));
  const notificationDocs = toNotify.map((userId) => ({
    user: userId,
    ticket: ticket._id,
    message: `Nuevo ticket generado desde el chatbot: ${ticket.title}`,
    type: 'ticket_created'
  }));
  if (notificationDocs.length) {
    await Notification.insertMany(notificationDocs);
    notificationDocs.forEach((notif) => {
      io.to(String(notif.user)).emit('notification', {
        ticket: notif.ticket,
        message: notif.message,
        type: notif.type
      });
    });
  }

  return ticket;
}

async function ruleBasedResponse(payload) {
  const text = payload.text || '';
  const simple = normalize(text);

  if (!text.trim()) {
    return {
      handled: true,
      reply: '¿Podrías contarme un poco más del inconveniente para ayudarte mejor?'
    };
  }

  if (/(hola|buen dia|buenas|saludos)/.test(simple)) {
    return {
      handled: true,
      reply:
        '¡Hola! Soy el asistente virtual. Puedo ayudarte a crear tickets y darte el estado de tus solicitudes. ¿En qué te apoyo hoy?'
    };
  }

  if (/gracias|excelente|perfecto/.test(simple)) {
    return {
      handled: true,
      reply: 'Con gusto. Si necesitas algo más, aquí estaré.'
    };
  }

  if (/crear (un )?ticket|hacer ticket|nuevo ticket/.test(simple)) {
    return {
      handled: true,
      reply:
        'Para crear un ticket desde el panel, usa el formulario "Crear nuevo ticket": escribe un título, describe el incidente y selecciona la prioridad. También puedo generar uno por ti: solo dime el problema con la mayor cantidad de detalles.'
    };
  }

  if (/estado|seguimiento|avance/.test(simple)) {
    const ticketId = isLikelyTicketId(text);
    if (!ticketId) {
      return {
        handled: true,
        reply: 'Puedo consultar el estado si me compartes el número de ticket (24 caracteres). Escríbelo y te respondo enseguida.'
      };
    }
    const statusInfo = await fetchTicketStatus(ticketId, payload.userId);
    return {
      handled: true,
      reply: statusInfo?.message || 'No pude verificar el estado en este momento, intenta nuevamente.'
    };
  }

  if (/fecha|agenda|visita|guia/.test(simple)) {
    return {
      handled: true,
      reply:
        'Para agendar visitas o compartir guías, indícame la fecha sugerida y el número de ticket relacionado. Así el equipo técnico podrá programarlo adecuadamente.'
    };
  }

  if (/no puedo acceder|no funciona|error|urgente|fallo/.test(simple)) {
    return {
      handled: true,
      reply:
        'Entiendo que el incidente es urgente. Estoy generando un ticket con tu mensaje para que un asesor lo revise de inmediato.',
      createTicket: true,
      ticketReason: 'Incidente reportado como urgente'
    };
  }

  if (/como ver mis tickets|donde encuentro los tickets|lista de tickets/.test(simple)) {
    return {
      handled: true,
      reply:
        'Puedes ver tus tickets desde el menú "Tickets". Allí filtras por estado o prioridad y seleccionas cada solicitud para ver los detalles y responder.'
    };
  }

  if (/chatbot|ayuda bot|que puedes hacer/.test(simple)) {
    return {
      handled: true,
      reply:
        'Puedo orientarte paso a paso, crear tickets con tu permiso y consultar estados si me das el número. Si detecto algo crítico genero un ticket automático para que el equipo humano te contacte.'
    };
  }

  return { handled: false };
}

async function callAssistant(messages) {
  if (OPENAI_KEY) {
    const reply = await callOpenAI(messages);
    if (reply) return reply;
  }
  if (HF_KEY) {
    const reply = await callHuggingFace(messages);
    if (reply) return reply;
  }
  return 'Asistente: la funcionalidad de IA no esta configurada o no tiene credito disponible. Contacta al administrador.';
}

// payload: { userId, text, room }
async function handleChatMessageSocket(payload, io) {
  const ruleResult = await ruleBasedResponse(payload);
  if (ruleResult.handled) {
    let finalReply = ruleResult.reply;
    if (ruleResult.createTicket) {
      const ticket = await createTicketFromChat(payload, ruleResult.ticketReason || 'Incidente reportado', io);
      finalReply = `${ruleResult.reply}\n\nTicket creado con ID ${ticket._id}. Encontrarás el detalle en tu bandeja de tickets.`;
    }
    if (payload.room) io.to(payload.room).emit('chat_reply', { reply: finalReply });
    return finalReply;
  }

  const messages = [
    {
      role: 'system',
      content:
        'Eres un asistente amable de soporte técnico. Proporciona respuestas concretas y, si no tienes la información, sugiere crear un ticket indicando que puedes generar uno con la descripcion del problema.'
    },
    { role: 'user', content: payload.text }
  ];

  let reply = await callAssistant(messages);

  if (!reply || /no esta configurada|lo siento/.test(normalize(reply))) {
    const ticket = await createTicketFromChat(
      payload,
      'Consulta sin respuesta automática',
      io
    );
    reply =
      `Generé un ticket con tu consulta para que un asesor lo revise manualmente.\n` +
      `Identificador: ${ticket._id}. Puedes seguirlo desde la sección de tickets.`;
  }

  if (payload.room) io.to(payload.room).emit('chat_reply', { reply });
  return reply;
}

module.exports = { handleChatMessageSocket };

const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const {
  SUPPORT_FALLBACK_REPLY,
  SUPPORT_SYSTEM_PROMPT,
  SUPPORT_FEW_SHOT_EXAMPLES,
  SUPPORT_KNOWLEDGE
} = require('./supportKnowledge');
require('dotenv').config();

const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const HF_KEY = process.env.HF_API_KEY || '';
const HF_BASE_URL = process.env.HF_BASE_URL || 'https://router.huggingface.co/v1/chat/completions';
const HF_MODEL = process.env.HF_MODEL || 'Qwen/Qwen2.5-7B-Instruct-1M';
const HF_MODEL_FALLBACKS = (process.env.HF_MODEL_FALLBACKS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const LOCAL_HELPER_MODEL = process.env.LOCAL_HELPER_MODEL || 'Xenova/flan-t5-small';
const LOCAL_TRANSLATE_ES_EN = process.env.LOCAL_TRANSLATE_ES_EN || 'Xenova/opus-mt-es-en';
const LOCAL_TRANSLATE_EN_ES = process.env.LOCAL_TRANSLATE_EN_ES || 'Xenova/opus-mt-en-es';
const LOCAL_CHAT_TEMPERATURE = Number(process.env.LOCAL_CHAT_TEMPERATURE || 0.2);
const LOCAL_CHAT_MAX_NEW_TOKENS = Number(process.env.LOCAL_CHAT_MAX_NEW_TOKENS || 180);
const LOCAL_MODEL_PATH = (process.env.LOCAL_MODEL_PATH || '').trim();
const LOCAL_MODELS_ONLY = String(process.env.LOCAL_MODELS_ONLY || '').toLowerCase() === 'true';
const LOCAL_CACHE_DIR = (process.env.LOCAL_CACHE_DIR || '').trim();
const LOCAL_USE_TRANSLATION = String(process.env.LOCAL_USE_TRANSLATION || '').toLowerCase() === 'true';

const STATUS_LABELS = {
  open: 'abierto',
  in_progress: 'en progreso',
  awaiting_client: 'esperando respuesta del cliente',
  resolved: 'resuelto',
  closed: 'cerrado'
};

function normalize(text = '') {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isLikelyTicketId(text = '') {
  const match = text.match(/[a-f0-9]{24}/i);
  return match ? match[0] : null;
}

function toRoom(payload) {
  return payload?.room || payload?.userId || null;
}

function shouldPrioritizeRules(simpleText) {
  return /(^escalar[\:\-\s]|crear ticket automatico|estado de mi ticket|seguimiento|avance|que dia es hoy|que hora es|urgente|se cayo|caida|error 500|error 404|401 unauthorized)/.test(
    simpleText
  );
}

function findSupportKnowledgeReply(simpleText) {
  const normalized = String(simpleText || '').trim();
  if (!normalized) return null;
  const match = SUPPORT_KNOWLEDGE.find((item) => item.patterns.some((pattern) => pattern.test(normalized)));
  return match ? match.reply : null;
}

function buildAssistantMessages(userText) {
  const shots = SUPPORT_FEW_SHOT_EXAMPLES.flatMap((example) => [
    { role: 'user', content: example.user },
    { role: 'assistant', content: example.assistant }
  ]);

  return [
    {
      role: 'system',
      content: SUPPORT_SYSTEM_PROMPT
    },
    ...shots,
    {
      role: 'user',
      content: userText
    }
  ];
}

function emitReply(io, payload, reply, meta = {}) {
  const room = toRoom(payload);
  if (!room) return;
  const clientMessageId = payload?.clientMessageId ? String(payload.clientMessageId) : null;
  const payloadMeta = clientMessageId ? { clientMessageId } : {};
  io.to(room).emit('chat_reply', { reply, ...payloadMeta, ...meta });
}

function resolveIfExists(candidatePath) {
  if (!candidatePath) return null;
  try {
    if (fs.existsSync(candidatePath)) return path.resolve(candidatePath);
  } catch (error) {
    return null;
  }
  return null;
}

function resolveModelRef(modelRef) {
  const raw = String(modelRef || '').trim();
  if (!raw) return raw;

  const hasLocalBase = Boolean(LOCAL_MODEL_PATH);
  const localBase = hasLocalBase ? path.resolve(LOCAL_MODEL_PATH) : null;
  const shortName = raw.split(/[\\/]/).filter(Boolean).pop() || raw;

  // If a local base is configured, return folder keys (e.g. "flan-t5-small")
  // so transformers.js can combine them with env.localModelPath reliably.
  if (hasLocalBase && localBase) {
    const direct = resolveIfExists(raw);
    if (direct) {
      const directNormalized = path.resolve(direct);
      const relative = path.relative(localBase, directNormalized);
      if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
        const firstSegment = relative.split(path.sep)[0];
        return firstSegment || shortName;
      }
      return shortName;
    }

    const joined1 = resolveIfExists(path.join(localBase, raw));
    if (joined1) return raw.replace(/\\/g, '/');

    const joined2 = resolveIfExists(path.join(localBase, shortName));
    if (joined2) return shortName;
  } else {
    const direct = resolveIfExists(raw);
    if (direct) return direct;
  }

  return raw;
}

function normalizeValidUserId(userId) {
  const value = String(userId || '').trim();
  if (!value) return null;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return value;
}

function nowInBogota() {
  const now = new Date();
  const formattedDate = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Bogota'
  }).format(now);
  const formattedTime = new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/Bogota'
  }).format(now);
  return { formattedDate, formattedTime };
}

function extractAfterCommand(text, commandRegex) {
  const source = String(text || '');
  const match = source.match(commandRegex);
  if (!match) return '';
  const raw = source.slice(match.index + match[0].length).trim();
  return raw.replace(/^[\:\-\s]+/, '').trim();
}

function defaultGuidedReply() {
  return [
    SUPPORT_FALLBACK_REPLY,
    '',
    'Puedes pedirme directamente:',
    '1) "como crear un ticket"',
    '2) "estado de mi ticket <id>"',
    '3) "no puedo iniciar sesion"',
    '4) "como asignar asesor o programador"',
    '5) "como cerrar un ticket y encuesta"',
    '',
    'Si deseas escalar a humano, escribe:',
    '"escalar: <describe tu caso>"'
  ].join('\n');
}

function isWeakAssistantReply(reply, userText) {
  const normalizedReply = normalize(reply || '').trim();
  const normalizedUser = normalize(userText || '');
  if (!normalizedReply) return true;
  if (normalizedReply.length < 18) return true;
  if (normalizedReply === normalizedUser) return true;
  if (normalizedReply.endsWith('?') && normalizedReply.length < 32) return true;

  // Detect degenerate loops like "detalle> detalle> detalle>".
  if ((normalizedReply.match(/>/g) || []).length >= 6) return true;
  if (/\b([\w<>]{2,20})(\s+\1){6,}\b/.test(normalizedReply)) return true;
  if (/reglas obligatorias|ejemplos de estilo|nunca devuelvas json|usuario:|asistente:/.test(normalizedReply))
    return true;
  if (/^\d+\)\s/.test(normalizedReply) && /usuario:|asistente:/.test(normalizedReply)) return true;
  if (/no logre generar una respuesta clara/.test(normalizedReply)) return true;
  if (normalizedReply.length > 850) return true;

  const words = normalizedReply.split(/\s+/).filter(Boolean);
  if (words.length >= 12) {
    const unique = new Set(words).size;
    const diversity = unique / words.length;
    if (diversity < 0.35) return true;
  }

  return false;
}

async function callOpenAI(messages) {
  if (!OPENAI_KEY) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages,
        max_tokens: 400,
        temperature: 0.2
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('OpenAI request failed', errorText);
      return null;
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error('OpenAI call error', error.message);
    return null;
  }
}

async function callHuggingFaceRemote(messages) {
  if (LOCAL_MODELS_ONLY) return null;
  if (!HF_KEY) return null;

  const models = [HF_MODEL, ...HF_MODEL_FALLBACKS];
  for (const model of models) {
    try {
      const res = await fetch(HF_BASE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HF_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 350,
          temperature: 0.3
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`HuggingFace request failed (${model})`, errorText);
        continue;
      }

      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content?.trim();
      if (reply) return reply;
    } catch (error) {
      console.error(`HuggingFace call error (${model})`, error.message);
    }
  }

  return null;
}

let localPipelinesPromise = null;

async function getLocalPipelines() {
  if (!localPipelinesPromise) {
    localPipelinesPromise = (async () => {
      const { pipeline, env } = await import('@xenova/transformers');
      env.allowLocalModels = true;
      if (LOCAL_MODEL_PATH) {
        env.localModelPath = path.resolve(LOCAL_MODEL_PATH);
      }
      if (LOCAL_CACHE_DIR) {
        env.cacheDir = path.resolve(LOCAL_CACHE_DIR);
      }
      if (LOCAL_MODELS_ONLY) {
        env.allowRemoteModels = false;
      }

      const helperModelRef = resolveModelRef(LOCAL_HELPER_MODEL);
      const assistantPromise = pipeline('text2text-generation', helperModelRef);

      if (!LOCAL_USE_TRANSLATION) {
        const assistant = await assistantPromise;
        return { translatorEsEn: null, translatorEnEs: null, assistant };
      }

      const esEnModelRef = resolveModelRef(LOCAL_TRANSLATE_ES_EN);
      const enEsModelRef = resolveModelRef(LOCAL_TRANSLATE_EN_ES);

      const [translatorEsEn, translatorEnEs, assistant] = await Promise.all([
        pipeline('translation', esEnModelRef),
        pipeline('translation', enEsModelRef),
        assistantPromise
      ]);

      return { translatorEsEn, translatorEnEs, assistant };
    })().catch((error) => {
      localPipelinesPromise = null;
      throw error;
    });
  }

  return localPipelinesPromise;
}

async function translateWithPipeline(pipe, text) {
  const result = await pipe(text, {
    max_new_tokens: 220
  });
  const translated = result?.[0]?.translation_text || result?.[0]?.generated_text || '';
  return String(translated || '').trim();
}

function postProcessSpanishReply(text) {
  const cleaned = String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\-\*\d\.\)\s]+/, '')
    .trim();
  return cleaned || 'No logre generar una respuesta clara. Puedo ayudarte a crear un ticket con tu caso.';
}

async function callLocalHuggingFace(messages) {
  try {
    const { translatorEsEn, translatorEnEs, assistant } = await getLocalPipelines();
    const userMessage = messages[messages.length - 1]?.content || '';
    const safeUserMessage = String(userMessage).slice(0, 1000);
    const directPrompt = [
      'Eres asistente de soporte tecnico para tickets.',
      'Responde en espanol, claro, en maximo 4 lineas.',
      'Si falta informacion, pide un dato puntual.',
      'Si es urgente, sugiere: escalar: <detalle>.',
      `Consulta del usuario: ${safeUserMessage}`
    ].join('\n');

    if (!LOCAL_USE_TRANSLATION || !translatorEsEn || !translatorEnEs) {
      const generatedDirect = await assistant(directPrompt, {
        max_new_tokens: LOCAL_CHAT_MAX_NEW_TOKENS,
        temperature: LOCAL_CHAT_TEMPERATURE,
        repetition_penalty: 1.05
      });
      const directOutput = generatedDirect?.[0]?.generated_text || '';
      return postProcessSpanishReply(directOutput);
    }

    const enInput = await translateWithPipeline(translatorEsEn, safeUserMessage);
    const prompt =
      'You are a technical support assistant. Respond in short, practical steps. ' +
      'If details are missing, ask one clear follow-up question.\n' +
      `User request: ${enInput}`;
    const generated = await assistant(prompt, {
      max_new_tokens: LOCAL_CHAT_MAX_NEW_TOKENS,
      temperature: LOCAL_CHAT_TEMPERATURE,
      repetition_penalty: 1.05
    });
    const enOutput = generated?.[0]?.generated_text || '';
    const esOutput = await translateWithPipeline(translatorEnEs, String(enOutput).slice(0, 1200));
    return postProcessSpanishReply(esOutput);
  } catch (error) {
    console.error('Local HuggingFace fallback error', error.message);
    return null;
  }
}

async function fetchTicketStatus(ticketId, userId) {
  if (!ticketId) return null;
  const ticket = await Ticket.findById(ticketId)
    .populate([
      { path: 'assignedAgent', select: 'name' },
      { path: 'assignedProgrammer', select: 'name' },
      { path: 'createdBy', select: 'name email' }
    ])
    .lean();

  if (!ticket) return { message: 'No encontre un ticket con ese identificador.' };

  const watchers =
    ticket.watchers
      ?.map((watcher) => {
        if (!watcher) return null;
        if (watcher._id) return String(watcher._id);
        return String(watcher);
      })
      .filter(Boolean) || [];

  if (userId && ticket.createdBy?._id) watchers.push(String(ticket.createdBy._id));

  if (userId && !watchers.includes(String(userId))) {
    return {
      message:
        'Ese ticket pertenece a otro usuario. Comparte el numero con el equipo para que validen permisos.'
    };
  }

  const status = STATUS_LABELS[ticket.status] || ticket.status;
  const updatedAt = ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString('es-CO') : 'Sin registro';
  const assignedAgent = ticket.assignedAgent?.name || 'Sin asignar';
  const programmer = ticket.assignedProgrammer?.name || 'Pendiente';

  return {
    message: `El ticket ${ticketId.slice(-6)} esta ${status}. Asesor: ${assignedAgent}. Programador: ${programmer}. Ultima actualizacion: ${updatedAt}.`
  };
}

async function createTicketFromChat(payload, reason, io) {
  const validUserId = normalizeValidUserId(payload.userId);
  const watchers = validUserId ? [validUserId] : [];
  const ticket = new Ticket({
    title: `Chatbot: ${reason.slice(0, 40) || 'Nueva consulta'}`,
    description: `${reason}\n\nConsulta del usuario:\n${payload.text}`,
    createdBy: validUserId || null,
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
      reply: 'Podrias contarme un poco mas del inconveniente para ayudarte mejor?'
    };
  }

  if (/(hola|buen dia|buenas|saludos)/.test(simple)) {
    return {
      handled: true,
      reply:
        'Hola. Soy el asistente virtual. Puedo ayudarte a crear tickets y darte el estado de tus solicitudes. En que te apoyo hoy?'
    };
  }

  if (/gracias|excelente|perfecto/.test(simple)) {
    return {
      handled: true,
      reply: 'Con gusto. Si necesitas algo mas, aqui estare.'
    };
  }

  if (/^escalar[\:\-\s]/.test(simple) || /crear ticket automatico[\:\-\s]/.test(simple)) {
    const details = extractAfterCommand(
      text,
      /(escalar|crear ticket automatico)\s*[:\-]?\s*/i
    );
    const reason = details || 'Escalamiento solicitado desde chatbot';
    return {
      handled: true,
      reply:
        'Perfecto. Voy a escalar tu caso con un ticket para revision humana.',
      createTicket: true,
      ticketReason: reason
    };
  }

  if (/que dia es hoy|que fecha es hoy|fecha de hoy/.test(simple)) {
    const { formattedDate } = nowInBogota();
    return {
      handled: true,
      reply: `Hoy es ${formattedDate} (hora de Bogota).`
    };
  }

  if (/que hora es|hora actual|hora de hoy/.test(simple)) {
    const { formattedTime } = nowInBogota();
    return {
      handled: true,
      reply: `La hora actual en Bogota es ${formattedTime}.`
    };
  }

  if (/crear (un )?ticket|hacer ticket|nuevo ticket/.test(simple)) {
    return {
      handled: true,
      reply:
        'Para crear un ticket desde el panel, usa "Crear nuevo ticket": titulo, descripcion y prioridad.\nSi quieres que yo lo cree por ti, escribe: "escalar: <detalle del problema>".'
    };
  }

  if (/que es una api|que significa api|definicion de api/.test(simple)) {
    return {
      handled: true,
      reply:
        'Una API es una interfaz que permite que dos sistemas intercambien datos de forma controlada mediante endpoints.'
    };
  }

  if (
    /no puedo iniciar sesion|no me deja entrar|credenciales invalidas|usuario no existe|error 401|401 unauthorized|unauthorized/.test(
      simple
    )
  ) {
    return {
      handled: true,
      reply:
        'Para error de login (401):\n1) valida correo y contrasena.\n2) confirma que el usuario exista.\n3) si eres admin, restablece la contrasena desde Gestion de usuarios.\n4) revisa que backend y frontend apunten al mismo ambiente.'
    };
  }

  if (/estado|seguimiento|avance/.test(simple)) {
    const ticketId = isLikelyTicketId(text);
    if (!ticketId) {
      return {
        handled: true,
        reply:
          'Puedo consultar el estado si me compartes el numero de ticket (24 caracteres). Escribelo y te respondo enseguida.'
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
        'Para agendar visitas o compartir guias, indicame la fecha sugerida y el numero de ticket relacionado. Asi el equipo tecnico podra programarlo.'
    };
  }

  if (/no puedo acceder|no funciona|error|urgente|fallo|caido|se cayo/.test(simple)) {
    return {
      handled: true,
      reply:
        'Entiendo que el incidente es urgente. Estoy generando un ticket con tu mensaje para que un asesor lo revise de inmediato.',
      createTicket: true,
      ticketReason: 'Incidente reportado como urgente'
    };
  }

  if (/asignar asesor|asignar programador|reasignar ticket/.test(simple)) {
    return {
      handled: true,
      reply:
        'Para asignar ticket: abre el detalle del ticket y usa la opcion de asignacion.\nAdmin puede asignar asesor y programador.\nAsesor puede tomar el ticket y asignar programador.'
    };
  }

  if (/programador listo|listo para revision|awaiting_client/.test(simple)) {
    return {
      handled: true,
      reply:
        'Cuando el programador termina, usa "Marcar listo". El ticket pasa a "awaiting_client" para revision del cliente.'
    };
  }

  if (/cerrar ticket|resolver ticket|encuesta|satisfaccion/.test(simple)) {
    return {
      handled: true,
      reply:
        'Flujo de cierre: asesor marca "resolved", luego el cliente califica satisfaccion y el ticket pasa a "closed".'
    };
  }

  if (/reporte semanal|reporte mensual|generar reporte/.test(simple)) {
    return {
      handled: true,
      reply:
        'Los reportes PDF se generan desde el dashboard con los botones "Reporte semanal" o "Reporte mensual" (roles admin y asesor).'
    };
  }

  if (/notificaciones|marcar leido|bandeja/.test(simple)) {
    return {
      handled: true,
      reply:
        'Las notificaciones llegan en tiempo real y puedes marcarlas como leidas desde la campana del panel principal.'
    };
  }

  if (/como ver mis tickets|donde encuentro los tickets|lista de tickets/.test(simple)) {
    return {
      handled: true,
      reply:
        'Puedes ver tus tickets desde el menu "Tickets". Alli filtras por estado o prioridad y seleccionas cada solicitud para ver detalles y responder.'
    };
  }

  if (/chatbot|ayuda bot|que puedes hacer/.test(simple)) {
    return {
      handled: true,
      reply:
        'Puedo orientarte paso a paso, crear tickets y consultar estados si me das el numero. Si detecto algo critico, genero un ticket automatico para que el equipo humano te contacte.'
    };
  }

  const supportReply = findSupportKnowledgeReply(simple);
  if (supportReply) {
    return {
      handled: true,
      reply: supportReply
    };
  }

  return { handled: false };
}

async function callAssistant(messages) {
  const openaiReply = await callOpenAI(messages);
  if (openaiReply) return openaiReply;

  const huggingFaceReply = await callHuggingFaceRemote(messages);
  if (huggingFaceReply) return huggingFaceReply;

  const localReply = await callLocalHuggingFace(messages);
  if (localReply) return localReply;

  return null;
}

// payload: { userId, text, room }
async function handleChatMessageCore(payload, io, emit = false) {
  const simpleText = normalize(payload.text || '');
  const prioritizeRules = shouldPrioritizeRules(simpleText);

  const applyRuleResult = async () => {
    const ruleResult = await ruleBasedResponse(payload);
    if (!ruleResult.handled) return null;

    let finalReply = ruleResult.reply;
    let createdTicketId = null;
    if (ruleResult.createTicket) {
      const ticket = await createTicketFromChat(payload, ruleResult.ticketReason || 'Incidente reportado', io);
      finalReply = `${ruleResult.reply}\n\nTicket creado con ID ${ticket._id}. Encontraras el detalle en tu bandeja de tickets.`;
      createdTicketId = String(ticket._id);
    }

    return {
      ok: true,
      source: ruleResult.createTicket ? 'rules_ticket' : 'rules',
      reply: finalReply,
      createdTicketId
    };
  };

  if (prioritizeRules) {
    const strictRuleResult = await applyRuleResult();
    if (strictRuleResult) {
      if (emit) {
        emitReply(io, payload, strictRuleResult.reply, {
          source: strictRuleResult.source,
          createdTicketId: strictRuleResult.createdTicketId
        });
      }
      return strictRuleResult;
    }
  }

  const messages = buildAssistantMessages(payload.text || '');
  const aiReply = await callAssistant(messages);
  if (aiReply && !isWeakAssistantReply(aiReply, payload.text)) {
    if (emit) emitReply(io, payload, aiReply, { source: 'ai' });
    return { ok: true, source: 'ai', reply: aiReply };
  }

  const ruleResult = await applyRuleResult();
  if (ruleResult) {
    if (emit) {
      emitReply(io, payload, ruleResult.reply, {
        source: ruleResult.source,
        createdTicketId: ruleResult.createdTicketId
      });
    }
    return ruleResult;
  }

  const fallbackReply = defaultGuidedReply();
  if (emit) emitReply(io, payload, fallbackReply, { source: 'rules' });
  return { ok: true, source: 'rules', reply: fallbackReply };
}

async function handleChatMessageSocket(payload, io) {
  const result = await handleChatMessageCore(payload, io, true);
  return result.reply;
}

module.exports = { handleChatMessageSocket, handleChatMessageCore };

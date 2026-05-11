const express = require('express');
const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Survey = require('../models/Survey');
const auth = require('../middleware/auth');

const router = express.Router();
const VALID_PRIORITIES = ['low', 'medium', 'high'];
const VALID_STATUSES = ['open', 'in_progress', 'awaiting_client', 'resolved'];

const BASE_POPULATE = [
  { path: 'createdBy', select: 'name email role' },
  { path: 'assignedAgent', select: 'name email role' },
  { path: 'assignedProgrammer', select: 'name email role' },
  { path: 'messages.authorId', select: 'name role' },
  { path: 'watchers', select: 'name role' },
  { path: 'statusHistory.changedBy', select: 'name role' },
  { path: 'survey', select: 'responses comment averageRating createdAt' }
];

function ensureRole(roles = []) {
  return (req, res, next) => {
    if (!roles.length || roles.includes(req.user.role)) return next();
    return res.status(403).json({ ok: false, error: 'No tienes permisos para esta accion' });
  };
}

function toId(value) {
  if (!value) return null;
  if (value._id) return String(value._id);
  return String(value);
}

function normalizeAssigneeId(value) {
  if (value === null || value === undefined || value === '') return null;
  if (!mongoose.Types.ObjectId.isValid(value)) return undefined;
  return String(value);
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizePriority(value = 'medium') {
  const normalized = String(value || 'medium').trim().toLowerCase();
  if (normalized === 'critical') return 'high';
  return VALID_PRIORITIES.includes(normalized) ? normalized : null;
}

function ensureWatcher(ticket, userId) {
  const stringId = String(userId);
  const watchers = ticket.watchers || [];
  const exists = watchers.some((w) => String(w) === stringId || toId(w) === stringId);
  if (!exists) {
    watchers.push(userId);
  }
}

function getWatcherIds(ticket, excludeId) {
  const ids = (ticket.watchers || []).map((w) => toId(w)).filter(Boolean);
  if (!excludeId) return [...new Set(ids)];
  return [...new Set(ids.filter((id) => id !== String(excludeId)))];
}

function getIo(req) {
  return req.app.get('io');
}

async function notifyUsers(userIds, payload, io) {
  const uniqueIds = [...new Set(userIds.map((id) => String(id)).filter(Boolean))];
  const notifications = uniqueIds.map((id) => ({
    user: id,
    ticket: payload.ticket,
    message: payload.message,
    type: payload.type
  }));
  if (notifications.length) {
    await Notification.insertMany(notifications);
    if (io) {
      uniqueIds.forEach((id) => {
        io.to(String(id)).emit('notification', payload);
      });
    }
  }
}

router.use(auth());

// Create ticket (client)
router.post('/', ensureRole(['client', 'agent', 'admin']), async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const company = String(req.body.company || '').trim();
    const priority = normalizePriority(req.body.priority);

    if (!title || !description) {
      return res.status(400).json({ ok: false, error: 'Titulo y descripcion son obligatorios' });
    }
    if (!priority) {
      return res.status(400).json({ ok: false, error: 'Prioridad invalida' });
    }

    const creator = await User.findById(req.user.id).select('name').lean();
    const normalizedCompany = company || creator?.name || 'N/D';

    const ticket = await Ticket.create({
      title,
      description,
      company: normalizedCompany,
      priority,
      createdBy: req.user.id,
      watchers: [req.user.id]
    });

    const populated = await ticket.populate(BASE_POPULATE);

    // Notify agents/admins (excluding creator)
    const recipients = await User.find({ role: { $in: ['agent', 'admin'] } }, '_id').lean();
    const ids = recipients.map((r) => String(r._id)).filter((id) => id !== String(req.user.id));
    await notifyUsers(ids, {
      ticket: populated._id,
      message: `Nuevo ticket: ${populated.title}`,
      type: 'ticket_created'
    }, getIo(req));

    res.json({ ok: true, ticket: populated });
  } catch (err) {
    console.error(err);
    res.status(400).json({ ok: false, error: 'No se pudo crear el ticket' });
  }
});

function buildFilterByRole(user) {
  switch (user.role) {
    case 'client':
      return {
        $or: [{ createdBy: user.id }, { watchers: user.id }]
      };
    case 'programmer':
      return {
        $or: [{ assignedProgrammer: user.id }, { watchers: user.id }]
      };
    case 'agent':
      return {
        $or: [{ assignedAgent: user.id }, { assignedAgent: null }, { watchers: user.id }]
      };
    case 'admin':
      return {};
    default:
      return { createdBy: user.id };
  }
}

router.get('/', async (req, res) => {
  try {
    const baseFilter = buildFilterByRole(req.user);
    const andConditions = [];

    if (baseFilter.$or) {
      andConditions.push({ $or: baseFilter.$or });
    }

    Object.entries(baseFilter)
      .filter(([key]) => key !== '$or')
      .forEach(([key, value]) => andConditions.push({ [key]: value }));

    if (req.query.status) {
      andConditions.push({ status: req.query.status });
    } else if (req.query.statusList) {
      const statusList = req.query.statusList
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      if (statusList.length) {
        andConditions.push({ status: { $in: statusList } });
      }
    }

    if (req.query.priority) {
      const priority = normalizePriority(req.query.priority);
      if (priority) andConditions.push({ priority });
    }
    if (req.query.company) andConditions.push({ company: req.query.company });

    if (req.query.clientId && mongoose.Types.ObjectId.isValid(req.query.clientId)) {
      andConditions.push({ createdBy: req.query.clientId });
    }

    if (req.query.agentId && mongoose.Types.ObjectId.isValid(req.query.agentId)) {
      andConditions.push({ assignedAgent: req.query.agentId });
    }

    if (req.query.programmerId && mongoose.Types.ObjectId.isValid(req.query.programmerId)) {
      andConditions.push({ assignedProgrammer: req.query.programmerId });
    }

    if (req.query.programmerReady === 'true') {
      andConditions.push({ programmerReady: true });
    }

    if (req.query.search) {
      const regex = new RegExp(escapeRegExp(req.query.search), 'i');
      const matchingUsers = await User.find(
        { $or: [{ name: regex }, { email: regex }] },
        '_id'
      )
        .limit(80)
        .lean();
      const userIds = matchingUsers.map((item) => item._id);
      andConditions.push({
        $or: [
          { title: regex },
          { description: regex },
          { company: regex },
          { createdBy: { $in: userIds } },
          { assignedAgent: { $in: userIds } },
          { assignedProgrammer: { $in: userIds } }
        ]
      });
    }

    let filter = {};
    if (andConditions.length === 1) filter = andConditions[0];
    else if (andConditions.length > 1) filter = { $and: andConditions };

    const tickets = await Ticket.find(filter)
      .sort({ lastActivityAt: -1 })
      .limit(400)
      .populate(BASE_POPULATE);
    res.json({ ok: true, tickets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error al obtener tickets' });
  }
});

async function ensureCanView(ticket, user) {
  if (!ticket) return false;
  const userId = String(user.id);
  const watcherSet = new Set(getWatcherIds(ticket));
  switch (user.role) {
    case 'admin':
      return true;
    case 'agent':
      return !ticket.assignedAgent || toId(ticket.assignedAgent) === userId || watcherSet.has(userId);
    case 'programmer':
      return (ticket.assignedProgrammer && toId(ticket.assignedProgrammer) === userId) || watcherSet.has(userId);
    case 'client':
      return toId(ticket.createdBy) === userId || watcherSet.has(userId);
    default:
      return false;
  }
}

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'ID invalido' });
    }

    const ticket = await Ticket.findById(req.params.id).populate(BASE_POPULATE);
    if (!(await ensureCanView(ticket, req.user))) {
      return res.status(404).json({ ok: false, error: 'Ticket no accesible' });
    }
    res.json({ ok: true, ticket });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error al obtener ticket' });
  }
});

router.post('/:id/messages', async (req, res) => {
  try {
    const { text, internal = false } = req.body;
    if (!text?.trim()) return res.status(400).json({ ok: false, error: 'Mensaje requerido' });

    const ticket = await Ticket.findById(req.params.id);
    if (!(await ensureCanView(ticket, req.user))) {
      return res.status(404).json({ ok: false, error: 'Ticket no accesible' });
    }

    const canSend = ['client', 'agent', 'programmer'].includes(req.user.role);
    if (!canSend) {
      return res.status(403).json({ ok: false, error: 'No puedes comentar este ticket' });
    }

    if (internal && req.user.role !== 'agent') {
      return res.status(403).json({ ok: false, error: 'Solo asesores pueden dejar notas internas' });
    }

    ensureWatcher(ticket, req.user.id);

    if (req.user.role === 'agent') {
      if (!ticket.assignedAgent) {
        ticket.assignedAgent = req.user.id;
      } else if (String(ticket.assignedAgent) !== String(req.user.id)) {
        ensureWatcher(ticket, ticket.assignedAgent);
      }
      ticket.programmerReady = false;
      if (ticket.status === 'open') {
        ticket.status = 'in_progress';
      }
    }

    if (req.user.role === 'client' && ticket.status === 'awaiting_client') {
      ticket.status = 'in_progress';
    }

    if (req.user.role === 'programmer') {
      // programador participa pero no modifica estado, solo confirma actividad
      ticket.programmerReady = false;
    }

    ticket.messages.push({
      authorId: req.user.id,
      authorRole: req.user.role,
      text,
      internal
    });

    ticket.statusHistory.push({
      status: ticket.status,
      changedBy: req.user.id,
      note: `Mensaje agregado por ${req.user.role}`
    });

    await ticket.save();
    const populated = await ticket.populate(BASE_POPULATE);

    const watcherIds = getWatcherIds(ticket, req.user.id);
    await notifyUsers(watcherIds, {
      ticket: populated._id,
      message: `Nuevo mensaje en ticket ${ticket.title}`,
      type: 'message'
    }, getIo(req));

    res.json({ ok: true, ticket: populated });
  } catch (err) {
    console.error(err);
    res.status(400).json({ ok: false, error: 'No se pudo agregar mensaje' });
  }
});

router.patch('/:id/assign', ensureRole(['agent', 'admin']), async (req, res) => {
  try {
    const { agentId, programmerId } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ ok: false, error: 'Ticket no encontrado' });

    const nextAgentId = normalizeAssigneeId(agentId);
    const nextProgrammerId = normalizeAssigneeId(programmerId);
    if (nextAgentId === undefined) {
      return res.status(400).json({ ok: false, error: 'agentId invalido' });
    }
    if (nextProgrammerId === undefined) {
      return res.status(400).json({ ok: false, error: 'programmerId invalido' });
    }

    if (req.user.role === 'agent') {
      if (!ticket.assignedAgent) {
        ticket.assignedAgent = req.user.id;
      } else if (String(ticket.assignedAgent) !== String(req.user.id)) {
        return res.status(403).json({ ok: false, error: 'Ticket asignado a otro asesor' });
      }
      if (nextAgentId && nextAgentId !== String(req.user.id)) {
        return res.status(403).json({ ok: false, error: 'Solo un administrador puede reasignar asesor' });
      }
    } else if (req.user.role === 'admin') {
      if (nextAgentId) {
        const foundAgent = await User.findOne({ _id: nextAgentId, role: 'agent' }).lean();
        if (!foundAgent) {
          return res.status(400).json({ ok: false, error: 'El asesor seleccionado no existe o no tiene rol agent' });
        }
        ticket.assignedAgent = nextAgentId;
      } else if (agentId === null || agentId === '') {
        ticket.assignedAgent = null;
      }
    }

    ensureWatcher(ticket, req.user.id);

    if (nextProgrammerId) {
      const foundProgrammer = await User.findOne({ _id: nextProgrammerId, role: 'programmer' }).lean();
      if (!foundProgrammer) {
        return res.status(400).json({ ok: false, error: 'El programador seleccionado no existe o no tiene rol programmer' });
      }
      ticket.assignedProgrammer = nextProgrammerId;
      ensureWatcher(ticket, nextProgrammerId);
    } else if (programmerId === null || programmerId === '') {
      ticket.assignedProgrammer = null;
      ticket.programmerReady = false;
      ticket.programmerReadyAt = null;
      ticket.programmerReadyBy = null;
    }

    if (ticket.assignedAgent) ensureWatcher(ticket, ticket.assignedAgent);
    if (ticket.assignedProgrammer) ensureWatcher(ticket, ticket.assignedProgrammer);
    if (ticket.status === 'open' && ticket.assignedAgent) {
      ticket.status = 'in_progress';
    }

    const noteParts = [];
    if (ticket.assignedAgent) {
      noteParts.push('Asesor asignado/actualizado');
    }
    if (programmerId !== undefined) {
      noteParts.push(ticket.assignedProgrammer ? 'Programador asignado/actualizado' : 'Programador desasignado');
    }
    if (!noteParts.length) {
      noteParts.push('Asignacion actualizada');
    }

    ticket.statusHistory.push({
      status: ticket.status,
      changedBy: req.user.id,
      note: noteParts.join('. ')
    });

    await ticket.save();
    const populated = await ticket.populate(BASE_POPULATE);

    const creatorId = toId(ticket.createdBy);
    const recipients = [creatorId, toId(ticket.assignedAgent), toId(ticket.assignedProgrammer), req.user.id]
      .map((id) => (id ? String(id) : null))
      .filter(Boolean)
      .filter((id) => id !== String(req.user.id));
    await notifyUsers(recipients, {
      ticket: populated._id,
      message: `Actualizacion de asignacion en ticket ${ticket.title}`,
      type: 'ticket_assigned'
    }, getIo(req));

    res.json({ ok: true, ticket: populated });
  } catch (err) {
    console.error(err);
    res.status(400).json({ ok: false, error: 'No se pudo asignar ticket' });
  }
});

router.patch('/:id/status', ensureRole(['agent', 'admin']), async (req, res) => {
  try {
    const { status, priority, note } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!(await ensureCanView(ticket, req.user))) {
      return res.status(404).json({ ok: false, error: 'Ticket no accesible' });
    }

    ensureWatcher(ticket, req.user.id);

    if (req.user.role === 'agent' && !ticket.assignedAgent) {
      ticket.assignedAgent = req.user.id;
    } else if (req.user.role === 'agent' && String(ticket.assignedAgent) !== String(req.user.id)) {
      return res.status(403).json({ ok: false, error: 'Ticket asignado a otro asesor' });
    }

    const updates = [];

    if (priority && priority !== ticket.priority) {
      const normalizedPriority = normalizePriority(priority);
      if (!normalizedPriority) {
        return res.status(400).json({ ok: false, error: 'Prioridad invalida' });
      }
      if (normalizedPriority !== ticket.priority) {
        ticket.priority = normalizedPriority;
        updates.push(`Prioridad actualizada a ${normalizedPriority}`);
      }
    }

    if (status && status !== ticket.status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ ok: false, error: 'Estado no permitido' });
      }

      if (
        ['closed', 'resolved'].includes(ticket.status) &&
        ['open', 'in_progress', 'awaiting_client'].includes(status) &&
        ticket.survey
      ) {
        return res.status(400).json({ ok: false, error: 'No se puede reabrir un ticket con encuesta final registrada' });
      }

      ticket.status = status;
      if (status !== 'awaiting_client') {
        ticket.programmerReady = false;
      }
      if (status === 'resolved') {
        ticket.resolvedAt = new Date();
        ticket.resolvedBy = req.user.id;
        ticket.closedAt = null;
        ticket.programmerReady = false;
      } else if (['open', 'in_progress', 'awaiting_client'].includes(status)) {
        ticket.closedAt = null;
        if (ticket.resolvedAt) {
          ticket.resolvedAt = null;
          ticket.resolvedBy = null;
        }
      }
      updates.push(`Estado cambiado a ${status}`);
    }

    if (!updates.length) {
      return res.json({ ok: true, ticket: await ticket.populate(BASE_POPULATE) });
    }

    ticket.statusHistory.push({
      status: ticket.status,
      changedBy: req.user.id,
      note: note || updates.join('. ')
    });

    await ticket.save();
    const populated = await ticket.populate(BASE_POPULATE);

    const recipients = getWatcherIds(ticket, req.user.id);
    await notifyUsers(recipients, {
      ticket: populated._id,
      message: `Ticket ${ticket.title} actualizado`,
      type: 'ticket_updated'
    }, getIo(req));

    res.json({ ok: true, ticket: populated });
  } catch (err) {
    console.error(err);
    res.status(400).json({ ok: false, error: 'No se pudo actualizar estado' });
  }
});

router.patch('/:id/programmer-ready', ensureRole(['programmer']), async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!(await ensureCanView(ticket, req.user))) {
      return res.status(404).json({ ok: false, error: 'Ticket no accesible' });
    }

    if (!ticket.assignedProgrammer || String(ticket.assignedProgrammer) !== String(req.user.id)) {
      return res.status(403).json({ ok: false, error: 'No eres el programador asignado a este ticket' });
    }

    ticket.programmerReady = true;
    ticket.programmerReadyAt = new Date();
    ticket.programmerReadyBy = req.user.id;
    if (ticket.status !== 'resolved') {
      ticket.status = 'awaiting_client';
    }

    ticket.statusHistory.push({
      status: ticket.status,
      changedBy: req.user.id,
      note: 'Programador marco el ticket listo para revision'
    });

    await ticket.save();
    const populated = await ticket.populate(BASE_POPULATE);

    const recipients = getWatcherIds(ticket, req.user.id);
    await notifyUsers(recipients, {
      ticket: populated._id,
      message: `Programador listo: ${ticket.title}`,
      type: 'ticket_updated'
    }, getIo(req));

    res.json({ ok: true, ticket: populated });
  } catch (err) {
    console.error(err);
    res.status(400).json({ ok: false, error: 'No se pudo actualizar el ticket' });
  }
});

router.patch('/:id/satisfaction', ensureRole(['client']), async (req, res) => {
  try {
    const answersRaw = req.body.answers || {};
    const normalizedAnswers = {
      q1: Number(answersRaw.q1),
      q2: Number(answersRaw.q2),
      q3: Number(answersRaw.q3),
      q4: Number(answersRaw.q4),
      q5: Number(answersRaw.q5)
    };
    const hasStructuredAnswers = Object.values(normalizedAnswers).every((value) => Number.isFinite(value));
    const rating = Number(req.body.rating);
    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';

    if (!hasStructuredAnswers && (!Number.isFinite(rating) || rating < 1 || rating > 5)) {
      return res.status(400).json({ ok: false, error: 'Calificacion invalida' });
    }

    if (hasStructuredAnswers) {
      const invalidAnswer = Object.values(normalizedAnswers).some((value) => value < 1 || value > 5);
      if (invalidAnswer) {
        return res.status(400).json({ ok: false, error: 'Las respuestas de encuesta deben estar entre 1 y 5' });
      }
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!(await ensureCanView(ticket, req.user))) {
      return res.status(404).json({ ok: false, error: 'Ticket no accesible' });
    }

    if (!ticket.createdBy || String(ticket.createdBy) !== String(req.user.id)) {
      return res.status(403).json({ ok: false, error: 'Solo el cliente que creo el ticket puede evaluarlo' });
    }

    if (!ticket.resolvedAt) {
      return res.status(400).json({ ok: false, error: 'El ticket debe estar resuelto antes de evaluarlo' });
    }

    if (ticket.satisfactionRating || ticket.survey) {
      return res.status(409).json({ ok: false, error: 'La satisfaccion ya fue registrada' });
    }

    const surveyAnswers = hasStructuredAnswers
      ? normalizedAnswers
      : { q1: rating, q2: rating, q3: rating, q4: rating, q5: rating };
    const average =
      (surveyAnswers.q1 + surveyAnswers.q2 + surveyAnswers.q3 + surveyAnswers.q4 + surveyAnswers.q5) / 5;

    const survey = await Survey.create({
      ticket: ticket._id,
      user: req.user.id,
      responses: surveyAnswers,
      comment: comment ? comment.slice(0, 600) : '',
      averageRating: Number(average.toFixed(2))
    });

    ticket.survey = survey._id;
    ticket.satisfactionRating = Number(average.toFixed(2));
    if (comment) ticket.satisfactionComment = comment.slice(0, 600);
    ticket.status = 'closed';
    ticket.closedAt = new Date();
    ensureWatcher(ticket, req.user.id);

    ticket.statusHistory.push({
      status: 'closed',
      changedBy: req.user.id,
      note: `Cliente califico con ${ticket.satisfactionRating}/5${comment ? `: ${comment}` : ''}`
    });

    await ticket.save();
    const populated = await ticket.populate(BASE_POPULATE);

    const recipients = getWatcherIds(ticket, req.user.id);
    await notifyUsers(recipients, {
      ticket: populated._id,
      message: `Cliente califico el ticket ${ticket.title} (${ticket.satisfactionRating}/5)`,
      type: 'ticket_updated'
    }, getIo(req));

    res.json({ ok: true, ticket: populated });
  } catch (err) {
    console.error(err);
    res.status(400).json({ ok: false, error: 'No se pudo registrar la satisfaccion' });
  }
});

router.delete('/:id', ensureRole(['admin', 'agent']), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'ID invalido' });
    }
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ ok: false, error: 'Ticket no encontrado' });

    if (req.user.role === 'agent') {
      if (!ticket.assignedAgent || String(ticket.assignedAgent) !== String(req.user.id)) {
        return res.status(403).json({ ok: false, error: 'Solo el asesor asignado puede eliminar el ticket' });
      }
      if (!['resolved', 'closed'].includes(ticket.status)) {
        return res.status(400).json({ ok: false, error: 'Solo puedes eliminar tickets resueltos o cerrados' });
      }
    }

    await Notification.deleteMany({ ticket: ticket._id });
    await Survey.deleteMany({ ticket: ticket._id });
    await Ticket.deleteOne({ _id: ticket._id });

    const recipients = getWatcherIds(ticket, req.user.id);
    await notifyUsers(recipients, {
      ticket: ticket._id,
      message: `Ticket "${ticket.title}" fue eliminado`,
      type: 'ticket_updated'
    }, getIo(req));

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'No se pudo eliminar el ticket' });
  }
});

module.exports = router;

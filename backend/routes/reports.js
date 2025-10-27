const express = require('express');
const PDFDocument = require('pdfkit');
const auth = require('../middleware/auth');
const Ticket = require('../models/Ticket');
const User = require('../models/User');

const router = express.Router();

router.use(auth());

function parseRange(range, startParam) {
  const now = new Date();
  const end = new Date(now);
  end.setMilliseconds(0);
  end.setSeconds(0);
  const start = new Date(now);

  if (startParam) {
    const parsed = new Date(startParam);
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setHours(0, 0, 0, 0);
      return { start: parsed, end };
    }
  }

  if (range === 'monthly') {
    start.setMonth(start.getMonth() - 1);
  } else {
    // weekly por defecto
    start.setDate(start.getDate() - 7);
  }

  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function formatDate(date) {
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function addSectionTitle(doc, text) {
  doc.moveDown(1);
  doc.fontSize(14).fillColor('#0f172a').text(text, { underline: true });
  doc.moveDown(0.5);
  doc.fillColor('#111827');
}

router.get('/tickets', async (req, res) => {
  try {
    if (!['admin', 'agent'].includes(req.user.role)) {
      return res.status(403).json({ ok: false, error: 'No autorizado' });
    }

    const { start, end } = parseRange(req.query.range, req.query.start);
    const match = { createdAt: { $gte: start, $lte: end } };

    if (req.user.role === 'agent') {
      match.assignedAgent = req.user.id;
    } else if (req.query.agentId) {
      match.assignedAgent = req.query.agentId;
    }

    if (req.query.programmerId) {
      match.assignedProgrammer = req.query.programmerId;
    }

    const tickets = await Ticket.find(match)
      .sort({ createdAt: -1 })
      .populate([
        { path: 'createdBy', select: 'name email company' },
        { path: 'assignedAgent', select: 'name email' },
        { path: 'assignedProgrammer', select: 'name email' },
        { path: 'statusHistory.changedBy', select: 'name role' }
      ])
      .lean();

    const totalTickets = tickets.length;
    const byStatus = {};
    const byPriority = {};
    const satisfactionValues = [];
    const agentPerformance = new Map();
    const programmerPerformance = new Map();
    let resolutionAccumulator = 0;
    let resolvedCount = 0;

    tickets.forEach((ticket) => {
      byStatus[ticket.status] = (byStatus[ticket.status] || 0) + 1;
      byPriority[ticket.priority] = (byPriority[ticket.priority] || 0) + 1;
      if (ticket.satisfactionRating) {
        satisfactionValues.push(ticket.satisfactionRating);
      }
      if (ticket.resolvedAt) {
        resolvedCount += 1;
        const resolutionMs = new Date(ticket.closedAt || ticket.resolvedAt) - new Date(ticket.createdAt);
        resolutionAccumulator += resolutionMs;
      }

      if (ticket.assignedAgent) {
        const key = String(ticket.assignedAgent._id);
        const current = agentPerformance.get(key) || {
          name: ticket.assignedAgent.name,
          email: ticket.assignedAgent.email,
          total: 0,
          resolved: 0
        };
        current.total += 1;
        if (ticket.status === 'resolved' || ticket.status === 'closed') {
          current.resolved += 1;
        }
        agentPerformance.set(key, current);
      }

      if (ticket.assignedProgrammer) {
        const key = String(ticket.assignedProgrammer._id);
        const current = programmerPerformance.get(key) || {
          name: ticket.assignedProgrammer.name,
          email: ticket.assignedProgrammer.email,
          total: 0,
          resolved: 0
        };
        current.total += 1;
        if (ticket.programmerReady) {
          current.resolved += 1;
        }
        programmerPerformance.set(key, current);
      }
    });

    const avgSatisfaction =
      satisfactionValues.length > 0
        ? satisfactionValues.reduce((acc, value) => acc + value, 0) / satisfactionValues.length
        : 0;

    const avgResolutionHours =
      resolvedCount > 0 ? resolutionAccumulator / resolvedCount / (1000 * 60 * 60) : 0;

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const rangeLabel = req.query.range === 'monthly' ? 'Mensual' : 'Semanal';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte_${rangeLabel.toLowerCase()}.pdf"`);

    doc.info.Title = `Reporte de soporte - ${rangeLabel}`;
    doc.info.Author = 'Sistema de soporte tecnico';
    doc.pipe(res);

    doc.fillColor('#111827');
    doc.fontSize(20).text('Reporte de soporte técnico', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Generado: ${formatDate(new Date())}`, { align: 'center' });
    doc.text(`Periodo: ${formatDate(start)} - ${formatDate(end)}`, { align: 'center' });

    addSectionTitle(doc, 'Resumen general');
    doc.fontSize(12);
    doc.text(`Total de tickets: ${totalTickets}`);
    doc.text(`Tiempo promedio de resolución: ${avgResolutionHours.toFixed(2)} horas`);
    doc.text(
      `Satisfacción promedio: ${
        satisfactionValues.length ? avgSatisfaction.toFixed(2) : 'Sin calificaciones registradas'
      }`
    );

    addSectionTitle(doc, 'Tickets por estado');
    Object.entries(byStatus)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, total]) => {
        doc.text(`• ${status}: ${total}`);
      });

    addSectionTitle(doc, 'Tickets por prioridad');
    Object.entries(byPriority)
      .sort((a, b) => b[1] - a[1])
      .forEach(([priority, total]) => {
        doc.text(`• ${priority}: ${total}`);
      });

    if (agentPerformance.size || programmerPerformance.size) {
      addSectionTitle(doc, 'Rendimiento del equipo');
      if (agentPerformance.size) {
        doc.fontSize(12).text('Asesores:', { continued: false });
        agentPerformance.forEach((value) => {
          doc.text(
            `• ${value.name} (${value.email}) - Tickets atendidos: ${value.total}, resueltos: ${value.resolved}`
          );
        });
      }
      if (programmerPerformance.size) {
        doc.moveDown(0.3);
        doc.fontSize(12).text('Programadores:', { continued: false });
        programmerPerformance.forEach((value) => {
          doc.text(
            `• ${value.name} (${value.email}) - Tickets asignados: ${value.total}, listos para revisión: ${value.resolved}`
          );
        });
      }
    }

    addSectionTitle(doc, 'Detalle de tickets');
    if (!tickets.length) {
      doc.text('No se registraron tickets en el periodo seleccionado.');
    } else {
      tickets.forEach((ticket) => {
        doc.fontSize(12).text(`• ${ticket.title} [${ticket.status.toUpperCase()}]`, { continued: false });
        doc.fontSize(10);
        doc.text(`  Cliente: ${ticket.createdBy?.name || ticket.createdBy?.email || 'N/D'}`);
        doc.text(`  Prioridad: ${ticket.priority}`);
        doc.text(`  Creado: ${formatDate(new Date(ticket.createdAt))}`);
        if (ticket.resolvedAt) {
          doc.text(`  Resuelto: ${formatDate(new Date(ticket.resolvedAt))}`);
        }
        if (ticket.assignedAgent?.name) {
          doc.text(`  Asesor: ${ticket.assignedAgent.name}`);
        }
        if (ticket.assignedProgrammer?.name) {
          doc.text(`  Programador: ${ticket.assignedProgrammer.name}`);
        }
        if (ticket.satisfactionRating) {
          doc.text(`  Satisfacción: ${ticket.satisfactionRating}/5`);
        }
        doc.moveDown(0.3);
      });
    }

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'No se pudo generar el reporte' });
  }
});

module.exports = router;

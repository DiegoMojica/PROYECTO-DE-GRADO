/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Survey = require('../models/Survey');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/support';

async function createUserIfMissing({ name, email, password, role }) {
  let user = await User.findOne({ email });
  if (!user) {
    user = new User({ name, email, role });
    await user.setPassword(password);
    await user.save();
    console.log(`Usuario creado: ${email} (${role})`);
  } else {
    console.log(`Usuario existente: ${email}`);
  }
  return user;
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Conectado a MongoDB para seed');

  const client = await createUserIfMissing({
    name: 'Cliente Demo',
    email: 'cliente@demo.com',
    password: 'demo123',
    role: 'client'
  });

  const agent = await createUserIfMissing({
    name: 'Asesor Demo',
    email: 'asesor@demo.com',
    password: 'demo123',
    role: 'agent'
  });

  const programmer = await createUserIfMissing({
    name: 'Programador Demo',
    email: 'programador@demo.com',
    password: 'demo123',
    role: 'programmer'
  });

  const admin = await createUserIfMissing({
    name: 'Admin Demo',
    email: 'admin@demo.com',
    password: 'demo123',
    role: 'admin'
  });

  console.log('Limpiando tickets previos...');
  await Survey.deleteMany({});
  await Ticket.deleteMany({});

  const clients = [
    client,
    await createUserIfMissing({
      name: 'Cliente 2',
      email: 'cliente2@demo.com',
      password: 'demo123',
      role: 'client'
    }),
    await createUserIfMissing({
      name: 'Cliente 3',
      email: 'cliente3@demo.com',
      password: 'demo123',
      role: 'client'
    })
  ];

  const satisfactionDistribution = [
    { rating: 1, count: 6 },
    { rating: 2, count: 10 },
    { rating: 3, count: 24 },
    { rating: 4, count: 48 },
    { rating: 5, count: 32 }
  ];

  const priorityPlan = [
    { priority: 'high', label: 'Alta', hours: 6 },
    { priority: 'medium', label: 'Media', hours: 18 },
    { priority: 'low', label: 'Baja', hours: 48 }
  ];

  function randomDateBetween(start, end) {
    const startMs = start.getTime();
    const endMs = end.getTime();
    const randomMs = Math.floor(Math.random() * (endMs - startMs)) + startMs;
    return new Date(randomMs);
  }

  const periodStart = new Date('2025-01-01T08:00:00Z');
  const periodEnd = new Date('2025-03-31T20:00:00Z');
  const ticketsToInsert = [];
  let ticketCounter = 1;

  satisfactionDistribution.forEach((entry, index) => {
    for (let i = 0; i < entry.count; i += 1) {
      const priorityConfig = priorityPlan[(index + i) % priorityPlan.length];
      const createdAt = randomDateBetween(periodStart, periodEnd);
      const resolvedAt = new Date(createdAt.getTime() + priorityConfig.hours * 60 * 60 * 1000);
      const closedAt = new Date(resolvedAt.getTime() + 2 * 60 * 60 * 1000);
      const assignedClient = clients[(ticketCounter + i) % clients.length];

      ticketsToInsert.push({
        title: `Caso ${ticketCounter}`,
        description: `Incidencia automatizada ${ticketCounter}, prioridad ${priorityConfig.label}.`,
        company: ['DemoCorp', 'BrightLabs', 'HealthTech'][ticketCounter % 3],
        createdBy: assignedClient._id,
        assignedAgent: agent._id,
        assignedProgrammer: programmer._id,
        watchers: [assignedClient._id, agent._id, programmer._id, admin._id],
        priority: priorityConfig.priority,
        status: 'closed',
        programmerReady: true,
        programmerReadyAt: resolvedAt,
        programmerReadyBy: programmer._id,
        resolvedAt,
        resolvedBy: programmer._id,
        closedAt,
        satisfactionRating: entry.rating,
        satisfactionComment:
          entry.rating >= 4
            ? 'Servicio eficiente y rapido.'
            : entry.rating === 3
              ? 'Experiencia neutra, se puede mejorar.'
              : 'Necesita mejoras en seguimiento.',
        messages: [
          {
            authorId: assignedClient._id,
            authorRole: 'client',
            text: `Detalle del problema ${ticketCounter}.`,
            internal: false,
            createdAt
          },
          {
            authorId: agent._id,
            authorRole: 'agent',
            text: 'Caso recibido y asignado a programacion.',
            internal: false,
            createdAt: new Date(createdAt.getTime() + 60 * 60 * 1000)
          },
          {
            authorId: programmer._id,
            authorRole: 'programmer',
            text: 'Falla corregida, listo para revisar con el cliente.',
            internal: true,
            createdAt: new Date(resolvedAt.getTime() - 60 * 60 * 1000)
          }
        ],
        statusHistory: [
          {
            status: 'open',
            changedBy: assignedClient._id,
            note: 'Ticket creado',
            changedAt: createdAt
          },
          {
            status: 'in_progress',
            changedBy: agent._id,
            note: 'Caso asignado a soporte',
            changedAt: new Date(createdAt.getTime() + 60 * 60 * 1000)
          },
          {
            status: 'resolved',
            changedBy: programmer._id,
            note: 'Solucion aplicada',
            changedAt: resolvedAt
          },
          {
            status: 'closed',
            changedBy: assignedClient._id,
            note: `Cliente califico con ${entry.rating}/5`,
            changedAt: closedAt
          }
        ],
        createdAt,
        updatedAt: closedAt
      });
      ticketCounter += 1;
    }
  });

  const insertedTickets = await Ticket.insertMany(ticketsToInsert);
  console.log(`Se generaron ${ticketsToInsert.length} tickets de muestra.`);

  const surveyDocs = insertedTickets
    .filter((ticket) => Number.isFinite(ticket.satisfactionRating))
    .map((ticket) => {
      const base = Math.max(1, Math.min(5, Math.round(ticket.satisfactionRating)));
      return {
        ticket: ticket._id,
        user: ticket.createdBy,
        responses: { q1: base, q2: base, q3: base, q4: base, q5: base },
        comment: ticket.satisfactionComment || '',
        averageRating: Number(base.toFixed(2)),
        createdAt: ticket.closedAt || ticket.updatedAt || new Date(),
        updatedAt: ticket.closedAt || ticket.updatedAt || new Date()
      };
    });

  if (surveyDocs.length) {
    const insertedSurveys = await Survey.insertMany(surveyDocs);
    const surveyByTicket = new Map(insertedSurveys.map((survey) => [String(survey.ticket), survey._id]));
    const updates = insertedTickets
      .filter((ticket) => surveyByTicket.has(String(ticket._id)))
      .map((ticket) => ({
        updateOne: {
          filter: { _id: ticket._id },
          update: { $set: { survey: surveyByTicket.get(String(ticket._id)) } }
        }
      }));

    if (updates.length) {
      await Ticket.bulkWrite(updates);
    }
    console.log(`Se generaron ${insertedSurveys.length} encuestas de muestra.`);
  }

  await mongoose.disconnect();
  console.log('Seed finalizado.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

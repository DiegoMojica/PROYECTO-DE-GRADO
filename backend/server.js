const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const ticketRoutes = require('./routes/tickets');
const notificationRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');
const reportRoutes = require('./routes/reports');
const chatbotRoutes = require('./routes/chatbot');
const { handleChatMessageSocket } = require('./chatbot/openaiChat');

const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes('*')) return true;
  return allowedOrigins.includes(origin);
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true
};

const io = new Server(server, {
  cors: {
    origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
    credentials: true
  }
});
app.set('io', io);

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/chatbot', chatbotRoutes);

// Simple health
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, error: 'Ruta no encontrada' });
});

// Socket.io handlers
io.on('connection', (socket) => {
  console.log('Socket connected', socket.id);

  socket.on('join', ({ room }) => {
    socket.join(room);
  });

  socket.on('register_user', ({ userId }) => {
    if (userId) socket.join(String(userId));
  });

  socket.on('chat_message', async (payload) => {
    // payload: { userId, text, room }
    try {
      await handleChatMessageSocket(payload, io);
    } catch (err) {
      console.error('chat_message error', err);
      const room = payload?.room || socket.id;
      io.to(room).emit('chat_reply', {
        reply: 'Error en el servicio de chatbot.',
        clientMessageId: payload?.clientMessageId || null
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected', socket.id);
  });
});

// Start
const PORT = process.env.PORT || 4000;
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/support', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch((err) => console.error('Mongo connect error', err));

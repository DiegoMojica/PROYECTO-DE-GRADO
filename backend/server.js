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
const { handleChatMessageSocket } = require('./chatbot/openaiChat');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);

app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);

// Simple health
app.get('/api/health', (req, res) => res.json({ ok: true }));

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
      const result = await handleChatMessageSocket(payload, io);
      // result already emitted inside handler (if needed). As fallback, emit reply:
      if (result && payload.room) {
        io.to(payload.room).emit('chat_reply', { reply: result });
      }
    } catch (err) {
      console.error('chat_message error', err);
      io.to(payload.room || socket.id).emit('chat_reply', { reply: 'Error en el servicio de chatbot.' });
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

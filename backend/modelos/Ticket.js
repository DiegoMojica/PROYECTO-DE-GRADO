const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  text: String,
  createdAt: { type: Date, default: Date.now }
});

const TicketSchema = new mongoose.Schema({
  title: { type: String },
  description: { type: String },
  company: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  status: { type: String, enum: ['open','in_progress','resolved','closed'], default: 'open' },
  messages: [MessageSchema],
  satisfactionRating: { type: Number, min: 1, max: 5 }
}, { timestamps: true });

module.exports = mongoose.model('Ticket', TicketSchema);
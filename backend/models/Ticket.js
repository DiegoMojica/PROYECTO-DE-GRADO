const mongoose = require('mongoose');

const PRIORITY_VALUES = ['low', 'medium', 'high'];

const MessageSchema = new mongoose.Schema(
  {
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    authorRole: { type: String, enum: ['client', 'agent', 'programmer', 'admin'], required: true },
    text: { type: String, required: true },
    internal: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const StatusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: ['open', 'in_progress', 'awaiting_client', 'resolved', 'closed'], required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: String,
    changedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const TicketSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  company: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedProgrammer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  watchers: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: []
  },
  priority: { type: String, enum: PRIORITY_VALUES, default: 'medium' },
  status: { type: String, enum: ['open', 'in_progress', 'awaiting_client', 'resolved', 'closed'], default: 'open' },
  statusHistory: [StatusHistorySchema],
  messages: [MessageSchema],
  survey: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey', default: null },
  satisfactionRating: { type: Number, min: 1, max: 5 },
  satisfactionComment: { type: String, trim: true },
  lastActivityAt: { type: Date, default: Date.now },
  programmerReady: { type: Boolean, default: false },
  programmerReadyAt: { type: Date },
  programmerReadyBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  closedAt: { type: Date }
}, { timestamps: true });

TicketSchema.pre('validate', function normalizeLegacyPriority(next) {
  if (this.priority === 'critical') {
    this.priority = 'high';
  }
  next();
});

TicketSchema.pre('save', function updateActivity(next) {
  this.lastActivityAt = new Date();
  if (this.createdBy && !this.watchers.some((w) => String(w) === String(this.createdBy))) {
    this.watchers.push(this.createdBy);
  }
  if (this.isNew) {
    this.statusHistory.push({
      status: this.status,
      changedBy: this.createdBy,
      note: 'Ticket creado'
    });
  }
  next();
});

module.exports = mongoose.model('Ticket', TicketSchema);

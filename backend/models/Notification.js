const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
    message: { type: String, required: true },
    type: { type: String, enum: ['ticket_created', 'ticket_updated', 'ticket_assigned', 'message'], default: 'message' },
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', NotificationSchema);

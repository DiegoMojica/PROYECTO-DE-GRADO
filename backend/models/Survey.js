const mongoose = require('mongoose');

const ResponseSchema = new mongoose.Schema(
  {
    q1: { type: Number, min: 1, max: 5, required: true },
    q2: { type: Number, min: 1, max: 5, required: true },
    q3: { type: Number, min: 1, max: 5, required: true },
    q4: { type: Number, min: 1, max: 5, required: true },
    q5: { type: Number, min: 1, max: 5, required: true }
  },
  { _id: false }
);

const SurveySchema = new mongoose.Schema(
  {
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    responses: { type: ResponseSchema, required: true },
    comment: { type: String, trim: true, maxlength: 600 },
    averageRating: { type: Number, min: 1, max: 5, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Survey', SurveySchema);

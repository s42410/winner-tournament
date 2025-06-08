const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  ageGroup: { type: String, required: true }, // ✅ שם תואם ל-HTML
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tournament', tournamentSchema);

const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  ageGroup: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  creatorEmail: { type: String, required: true }
});

module.exports = mongoose.models.Tournament || mongoose.model('Tournament', tournamentSchema);

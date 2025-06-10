const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  ageGroup: { type: String, required: true },
  createdByEmail: { type: String, required: true }, // נוספה שורה זו
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Tournament || mongoose.model('Tournament', tournamentSchema);

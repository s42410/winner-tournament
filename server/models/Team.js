const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
fullName: String,
  shirtNumber: Number
});

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  color: { type: String, required: true },
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  group: { type: String, default: '' }, // ✅ שדה חדש לבית/בית A B C
  players: [playerSchema]
});

module.exports = mongoose.models.Team || mongoose.model('Team', teamSchema);

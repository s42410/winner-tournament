const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  shirtNumber: Number
}, { _id: false });

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  color: { type: String, required: true },
  ageGroup: { type: String, required: true },
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  players: [playerSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Team || mongoose.model('Team', teamSchema);

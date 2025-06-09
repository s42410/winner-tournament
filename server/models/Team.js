const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  color: { type: String, required: true },
  ageGroup: { type: String, required: true },
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Team || mongoose.model('Team', teamSchema);

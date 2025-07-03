const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  shirtNumber: { type: Number, required: true }
});


const teamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  color: { type: String, required: true },
  house: { type: String }, // הוסף בית
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' },
  players: [{ firstName: String, lastName: String, shirtNumber: Number }],
  group: { type: String, default: '' } // ✅ חדש!
});

module.exports = mongoose.models.Team || mongoose.model('Team', teamSchema);

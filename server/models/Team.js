const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  color: {
    type: String,
    required: true
  },
  grade: {
    type: String,
    required: true
  },
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true
  },
  players: [
    {
      firstName: String,
      lastName: String,
      shirtNumber: Number
    }
  ]
});

module.exports = mongoose.model('Team', teamSchema);

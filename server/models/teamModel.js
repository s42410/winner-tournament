const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ageGroup: { type: String, required: true }, // אם אתה באמת צריך Age Group
  players: [
    {
      number: Number,
      name: String
    }
  ],
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true
  }
});

module.exports = mongoose.model('Team', teamSchema);

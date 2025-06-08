const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
  scorer: String,
  minute: Number
}, { _id: false });

const cardSchema = new mongoose.Schema({
  player: String,
  minute: Number,
  color: { type: String, enum: ['yellow', 'red'] }
}, { _id: false });

const gameSchema = new mongoose.Schema({
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  teamA: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  teamB: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  date: { type: Date, required: true },
  scoreA: { type: Number, default: 0 },
  scoreB: { type: Number, default: 0 },
  goals: {
    teamA: [goalSchema],
    teamB: [goalSchema]
  },
  cards: {
    teamA: [cardSchema],
    teamB: [cardSchema]
  }
});

module.exports = mongoose.model('Game', gameSchema);

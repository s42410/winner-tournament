const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const Team = require('../models/Team');

// ✅ שליפת משחק בודד כולל קבוצות
router.get('/game/:gameId', async (req, res) => {
  try {
    const game = await Game.findById(req.params.gameId).populate('teamA teamB');
    if (!game) return res.status(404).json({ error: 'משחק לא נמצא' });
    res.json(game);
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בשליפת משחק', details: err.message });
  }
});

// ✅ שליפת משחקים לפי טורניר (לדירוג)
router.get('/by-tournament', async (req, res) => {
  const { tournamentId } = req.query;
  if (!tournamentId) return res.status(400).json({ error: '❗ חסר מזהה טורניר' });

  try {
    const games = await Game.find({ tournamentId }).populate('teamA teamB');
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בשליפת המשחקים', details: err.message });
  }
});

// ✅ שליפת משחקים לפי מזהה טורניר (ניהול)
router.get('/:tournamentId', async (req, res) => {
  try {
    const games = await Game.find({ tournamentId: req.params.tournamentId }).populate('teamA teamB');
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בשליפת המשחקים', details: err.message });
  }
});

// ✅ יצירת משחק רגיל
router.post('/', async (req, res) => {
  try {
    const { tournamentId, teamA, teamB, date, time, location, knockoutStage } = req.body;

    if (teamA === teamB) {
      return res.status(400).json({ error: 'לא ניתן ליצור משחק בין אותה קבוצה' });
    }

    const newGame = new Game({
      tournamentId,
      teamA,
      teamB,
      date,
      time,
      location,
      knockoutStage: knockoutStage || null
    });

    await newGame.save();
    res.status(201).json({ message: '✅ המשחק נוסף בהצלחה', game: newGame });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה ביצירת המשחק', details: err.message });
  }
});

// ✅ יצירת שלב נוקאאוט אוטומטי מהדירוג
router.post('/create-knockout-auto', async (req, res) => {
  try {
    const { tournamentId, stage, numTeams } = req.body;

    if (!tournamentId || !stage || !numTeams) {
      return res.status(400).json({ error: '❗ חסרים נתונים ליצירת שלב נוקאאוט' });
    }

    // שלב 1: שלוף דירוג מהליגה
    const teams = await Team.find({ tournamentId }).sort({ points: -1 }).limit(numTeams);
    if (teams.length < numTeams) {
      return res.status(400).json({ error: 'לא נמצאו מספיק קבוצות' });
    }

    // שלב 2: צור משחקים (לדוגמה רבע גמר => 8 קבוצות => 4 משחקים)
    const matches = [];
    for (let i = 0; i < teams.length; i += 2) {
      if (teams[i + 1]) {
        matches.push({
          teamA: teams[i]._id,
          teamB: teams[i + 1]._id,
          date: new Date(),
          time: '12:00',
          location: 'מגרש נוקאאוט',
          knockoutStage: stage
        });
      }
    }

    // שלב 3: שמור
    const newGames = [];
    for (const m of matches) {
      const game = new Game({
        tournamentId,
        teamA: m.teamA,
        teamB: m.teamB,
        date: m.date,
        time: m.time,
        location: m.location,
        knockoutStage: stage
      });
      await game.save();
      newGames.push(game);
    }

    res.status(201).json({ message: `✅ שלב ${stage} נוצר אוטומטית`, games: newGames });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה ביצירת שלב נוקאאוט', details: err.message });
  }
});

// ✅ עדכון תוצאה כולל שערים וכרטיסים
router.put('/:gameId', async (req, res) => {
  try {
    const { scoreA, scoreB, goals, cards } = req.body;
    const updated = await Game.findByIdAndUpdate(
      req.params.gameId,
      { scoreA, scoreB, goals, cards },
      { new: true }
    );
    res.json({ message: '✅ המשחק עודכן', game: updated });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בעדכון המשחק', details: err.message });
  }
});

// ✅ מחיקת משחק בודד
router.delete('/:gameId', async (req, res) => {
  try {
    await Game.findByIdAndDelete(req.params.gameId);
    res.json({ message: '🗑️ המשחק נמחק בהצלחה' });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה במחיקת המשחק', details: err.message });
  }
});

// ✅ מחיקת כל המשחקים בטורניר
router.delete('/deleteAll/:tournamentId', async (req, res) => {
  try {
    await Game.deleteMany({ tournamentId: req.params.tournamentId });
    res.json({ message: '✅ כל המשחקים נמחקו בהצלחה' });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה במחיקת כל המשחקים', details: err.message });
  }
});

module.exports = router;

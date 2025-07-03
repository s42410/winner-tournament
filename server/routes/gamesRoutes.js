const express = require('express');
const router = express.Router();
const Game = require('../models/Game');

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

// ✅ יצירת משחק חדש
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

// ✅ יצירת משחקי שלב נוקאאוט (חדש!)
router.post('/create-knockout', async (req, res) => {
  try {
    const { tournamentId, stage, matches } = req.body;

    if (!tournamentId || !stage || !Array.isArray(matches)) {
      return res.status(400).json({ error: '❗ חסרים נתונים ליצירת שלב נוקאאוט' });
    }

    const newGames = [];
    for (const m of matches) {
      if (m.teamA === m.teamB) continue;

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

    res.status(201).json({ message: `✅ שלב נוקאאוט ${stage} נוצר בהצלחה`, games: newGames });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה ביצירת שלב נוקאאוט', details: err.message });
  }
});

// ✅ עדכון משחק
router.put('/:gameId', async (req, res) => {
  try {
    const updated = await Game.findByIdAndUpdate(req.params.gameId, req.body, { new: true });
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

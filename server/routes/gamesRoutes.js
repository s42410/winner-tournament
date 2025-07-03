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

// ✅ יצירת שלב נוקאאוט אוטומטי לפי דירוג (ליגה/בתים)
router.post('/create-knockout-auto', async (req, res) => {
  try {
    const { tournamentId, stage, numTeams } = req.body;

    if (!tournamentId || !stage || !numTeams) {
      return res.status(400).json({ error: '❗ חסרים נתונים ליצירת שלב נוקאאוט' });
    }

    const allTeams = await Team.find({ tournamentId });
    const allGames = await Game.find({ tournamentId }).populate('teamA teamB');

    const hasGroups = allTeams.some(t => t.group && t.group.trim() !== '');
    let pairs = [];

    if (hasGroups) {
      // 👉 ניהול לפי בתים
      const groups = {};
      allTeams.forEach(t => {
        const g = t.group.trim();
        if (!groups[g]) groups[g] = [];
        groups[g].push({ team: t, points: 0 });
      });

      for (const game of allGames) {
        if (!game.knockoutStage) {
          if (game.scoreA > game.scoreB) {
            groups[game.teamA.group].find(t => t.team._id.equals(game.teamA._id)).points += 3;
          } else if (game.scoreB > game.scoreA) {
            groups[game.teamB.group].find(t => t.team._id.equals(game.teamB._id)).points += 3;
          } else {
            groups[game.teamA.group].find(t => t.team._id.equals(game.teamA._id)).points += 1;
            groups[game.teamB.group].find(t => t.team._id.equals(game.teamB._id)).points += 1;
          }
        }
      }

      const groupKeys = Object.keys(groups);
      if (groupKeys.length < 2) {
        return res.status(400).json({ error: 'צריך לפחות שני בתים' });
      }

      for (const g of groupKeys) {
        groups[g].sort((a,b) => b.points - a.points);
      }

      const g1 = groups[groupKeys[0]];
      const g2 = groups[groupKeys[1]];

      if (g1.length < 2 || g2.length < 2) {
        return res.status(400).json({ error: 'לא מספיק קבוצות בכל בית' });
      }

      pairs.push([g1[0].team, g2[1].team]); // 1-2
      pairs.push([g2[0].team, g1[1].team]); // 1-2

    } else {
      // 👉 ניהול לפי ליגה
      const stats = {};
      allTeams.forEach(t => stats[t._id] = { team: t, points: 0 });

      for (const game of allGames) {
        if (!game.knockoutStage) {
          if (game.scoreA > game.scoreB) {
            stats[game.teamA._id].points += 3;
          } else if (game.scoreB > game.scoreA) {
            stats[game.teamB._id].points += 3;
          } else {
            stats[game.teamA._id].points += 1;
            stats[game.teamB._id].points += 1;
          }
        }
      }

      const sorted = Object.values(stats).sort((a,b)=>b.points - a.points).map(s => s.team);

      for (let i = 0; i < numTeams / 2; i++) {
        pairs.push([sorted[i], sorted[numTeams - 1 - i]]);
      }
    }

    const newGames = [];
    for (const [teamA, teamB] of pairs) {
      const game = new Game({
        tournamentId,
        teamA: teamA._id,
        teamB: teamB._id,
        date: new Date(),
        time: '12:00',
        location: 'מגרש נוקאאוט',
        knockoutStage: stage
      });
      await game.save();
      newGames.push(game);
    }

    res.status(201).json({ message: `✅ שלב ${stage} נוצר לפי חוקיות ${hasGroups ? 'בתים' : 'ליגה'}`, games: newGames });

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

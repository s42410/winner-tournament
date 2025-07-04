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

// ✅ שליפת משחקים לפי טורניר (לצפייה ומעקב)
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

// ✅ יצירת שלב נוקאאוט אוטומטי עם שלב נבחר ומספר קבוצות
// ✅ יצירת שלב נוקאאוט אוטומטי לפי דירוג (בתים/ליגה)
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
      // 🔵 מצב בתים קלאסי: שיבוץ מקום 1 מול מקום 2 בבית אחר
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
        groups[g].sort((a, b) => b.points - a.points);
      }

      // דוגמה לשני בתים:
      const g1 = groups[groupKeys[0]];
      const g2 = groups[groupKeys[1]];

      pairs.push([g1[0].team, g2[1].team]);
      pairs.push([g2[0].team, g1[1].team]);

    } else {
      // 🔵 מצב ליגה מלאה
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

      const sorted = Object.values(stats).sort((a, b) => b.points - a.points).map(s => s.team);

      if (numTeams === 6) {
        // ⚡ מקרה 6 קבוצות: 2 עולות אוטומטית לחצי גמר
        pairs.push([sorted[2], sorted[5]]); // מקום 3 נגד מקום 6
        pairs.push([sorted[3], sorted[4]]); // מקום 4 נגד מקום 5
        // לא יוצרים משחקים לראשונות — הן עולות אוטומטית!
      } else {
        // ⚡ כל שאר המצבים: 1 נגד אחרון וכו׳
        for (let i = 0; i < numTeams / 2; i++) {
          pairs.push([sorted[i], sorted[numTeams - 1 - i]]);
        }
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

    res.status(201).json({ message: `✅ שלב ${stage} נוצר בהצלחה`, games: newGames });

  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה ביצירת שלב נוקאאוט', details: err.message });
  }
});

// ✅ עדכון משחק מלא (כולל תוצאה וגמר אוטומטי)
router.put('/:gameId', async (req, res) => {
  try {
    const { scoreA, scoreB, goals, cards } = req.body;

    const updated = await Game.findByIdAndUpdate(
      req.params.gameId,
      { scoreA, scoreB, goals, cards },
      { new: true }
    );

    if (updated.knockoutStage === 'חצי גמר') {
      const semis = await Game.find({ tournamentId: updated.tournamentId, knockoutStage: 'חצי גמר' });
      const finished = semis.filter(g => g.scoreA != null && g.scoreB != null);

      if (finished.length === 2) {
        const winners = finished.map(g => (g.scoreA > g.scoreB ? g.teamA : g.teamB)).filter(Boolean);

        if (winners.length === 2) {
          const existingFinal = await Game.findOne({
            tournamentId: updated.tournamentId,
            knockoutStage: 'גמר'
          });

          if (!existingFinal) {
            const newFinal = new Game({
              tournamentId: updated.tournamentId,
              teamA: winners[0],
              teamB: winners[1],
              date: new Date(),
              time: '12:00',
              location: 'מגרש גמר',
              knockoutStage: 'גמר'
            });
            await newFinal.save();
            console.log('🎉 משחק גמר נוצר אוטומטית');
          }
        }
      }
    }

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

// ✅ מחיקת כל שלבי נוקאאוט בלבד בלי ליגה
router.delete('/deleteAll/:tournamentId', async (req, res) => {
  try {
    const result = await Game.deleteMany({
      tournamentId: req.params.tournamentId,
      knockoutStage: { $ne: null }
    });
    res.json({ message: `🗑️ נמחקו ${result.deletedCount} משחקי נוקאאוט בהצלחה` });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה במחיקת שלבי הנוקאאוט', details: err.message });
  }
});

// ✅ מחיקת כל משחקי שלב הבתים וגם הליגה
router.delete('/group-stage/:tournamentId', async (req, res) => {
  try {
    await Game.deleteMany({ tournamentId: req.params.tournamentId });
    res.json({ message: '✅ כל משחקי שלב הבתים והליגה נמחקו בהצלחה' });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה במחיקת המשחקים', details: err.message });
  }
});

module.exports = router;

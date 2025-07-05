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

// ✅ עדכון תוצאה ויצירת שלב נוקאאוט הבא אוטומטי - מבוסס על תוצאות בפועל בלבד
router.put('/:gameId', async (req, res) => {
  try {
    const { teamA, teamB, date, time, location, scoreA, scoreB, goals, cards } = req.body;

    if (scoreA === scoreB) {
      return res.status(400).json({ error: '❌ בשלב נוקאאוט אין תוצאת תיקו. חייבת להיות הכרעה!' });
    }

    const updated = await Game.findByIdAndUpdate(
      req.params.gameId,
      { teamA, teamB, date, time, location, scoreA, scoreB, goals, cards },
      { new: true }
    );

    const stages = ['שמינית גמר', 'רבע גמר', 'חצי גמר'];
    if (stages.includes(updated.knockoutStage)) {
      const allStageGames = await Game.find({
        tournamentId: updated.tournamentId,
        knockoutStage: updated.knockoutStage
      });

      const finished = allStageGames.filter(g => g.scoreA != null && g.scoreB != null);
      if (finished.length === allStageGames.length) {
        const winners = finished.map(g => (g.scoreA > g.scoreB ? g.teamA : g.teamB)).filter(Boolean);

        let nextStage = '';
        if (updated.knockoutStage === 'שמינית גמר') nextStage = 'רבע גמר';
        else if (updated.knockoutStage === 'רבע גמר') nextStage = 'חצי גמר';
        else if (updated.knockoutStage === 'חצי גמר') nextStage = 'גמר';

        const exist = await Game.findOne({ tournamentId: updated.tournamentId, knockoutStage: nextStage });
        if (!exist && winners.length >= 2) {
          for (let i = 0; i < winners.length / 2; i++) {
            const game = new Game({
              tournamentId: updated.tournamentId,
              teamA: winners[i],
              teamB: winners[winners.length - 1 - i],
              date: new Date(),
              time: '12:00',
              location: `מגרש ${nextStage}`,
              knockoutStage: nextStage
            });
            await game.save();
          }
          console.log(`🎉 ${nextStage} נוצר אוטומטית לאחר עדכון תוצאות`);
        }
      }
    }

    res.json({ message: '✅ המשחק עודכן בהצלחה', game: updated });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בעדכון המשחק', details: err.message });
  }
});

// ✅ יצירת שלב נוקאאוט אוטומטי - יוצר רק את השלב המבוקש לפי הדירוג הנכון
router.post('/create-knockout-auto', async (req, res) => {
  try {
    const { tournamentId, stage, numTeams } = req.body;
    if (!tournamentId || !stage || !numTeams) {
      return res.status(400).json({ error: '❗ חסרים נתונים ליצירת שלב נוקאאוט' });
    }

    let expected = 0;
    if (stage === 'שמינית גמר') expected = 16;
    else if (stage === 'רבע גמר') expected = 8;
    else if (stage === 'חצי גמר') expected = 4;
    else if (stage === 'גמר') expected = 2;

    if (numTeams !== expected) {
      return res.status(400).json({ error: `❗ מספר קבוצות לא תואם לשלב ${stage}. נדרש ${expected}` });
    }

    const allTeams = await Team.find({ tournamentId });
    const allGames = await Game.find({ tournamentId }).populate('teamA teamB');
    const hasGroups = allTeams.some(t => t.group && t.group.trim() !== '');
    let pairs = [];

    if (hasGroups) {
      // דרוג קבוצות לפי בתים
      const groups = {};
      allTeams.forEach(t => {
        const g = t.group.trim();
        if (!groups[g]) groups[g] = [];
        groups[g].push({ team: t, points: 0, goalsDiff: 0, goalsFor: 0 });
      });

      for (const game of allGames) {
        if (!game.knockoutStage) {
          const ta = groups[game.teamA.group].find(x => x.team._id.equals(game.teamA._id));
          const tb = groups[game.teamB.group].find(x => x.team._id.equals(game.teamB._id));
          if (ta && tb) {
            ta.goalsFor += game.scoreA || 0;
            tb.goalsFor += game.scoreB || 0;
            ta.goalsDiff += (game.scoreA || 0) - (game.scoreB || 0);
            tb.goalsDiff += (game.scoreB || 0) - (game.scoreA || 0);
            if (game.scoreA > game.scoreB) ta.points += 3;
            else if (game.scoreA < game.scoreB) tb.points += 3;
            else { ta.points += 1; tb.points += 1; }
          }
        }
      }

      for (const g of Object.keys(groups)) {
        groups[g].sort((a, b) => b.points - a.points || b.goalsDiff - a.goalsDiff || b.goalsFor - a.goalsFor);
      }

      const ranked = [];
      if (stage === 'שמינית גמר') {
        for (const g of Object.keys(groups)) ranked.push(...groups[g].slice(0, 4));
      } else if (stage === 'רבע גמר') {
        for (const g of Object.keys(groups)) ranked.push(...groups[g].slice(0, 2));
      } else {
        ranked.push(...Object.values(groups).flat().slice(0, numTeams));
      }

      ranked.sort((a, b) => b.points - a.points || b.goalsDiff - a.goalsDiff || b.goalsFor - a.goalsFor);
      const half = ranked.length / 2;
      for (let i = 0; i < half; i++) {
        pairs.push([ranked[i].team, ranked[ranked.length - 1 - i].team]);
      }

    } else {
      // ליגה רגילה
      const stats = {};
      allTeams.forEach(t => stats[t._id] = { team: t, points: 0, goalsDiff: 0, goalsFor: 0 });

      for (const game of allGames) {
        if (!game.knockoutStage) {
          const ta = stats[game.teamA._id];
          const tb = stats[game.teamB._id];
          ta.goalsFor += game.scoreA || 0;
          tb.goalsFor += game.scoreB || 0;
          ta.goalsDiff += (game.scoreA || 0) - (game.scoreB || 0);
          tb.goalsDiff += (game.scoreB || 0) - (game.scoreA || 0);
          if (game.scoreA > game.scoreB) ta.points += 3;
          else if (game.scoreA < game.scoreB) tb.points += 3;
          else { ta.points += 1; tb.points += 1; }
        }
      }

      const sorted = Object.values(stats).sort((a, b) =>
        b.points - a.points || b.goalsDiff - a.goalsDiff || b.goalsFor - a.goalsFor
      ).map(x => x.team);

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
        location: `מגרש ${stage}`,
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

// ✅ מחיקות
router.delete('/:gameId', async (req, res) => {
  try {
    await Game.findByIdAndDelete(req.params.gameId);
    res.json({ message: '🗑️ המשחק נמחק בהצלחה' });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה במחיקת המשחק', details: err.message });
  }
});

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

router.delete('/group-stage/:tournamentId', async (req, res) => {
  try {
    await Game.deleteMany({ tournamentId: req.params.tournamentId });
    res.json({ message: '✅ כל משחקי שלב הבתים והליגה נמחקו בהצלחה' });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה במחיקת המשחקים', details: err.message });
  }
});

module.exports = router;

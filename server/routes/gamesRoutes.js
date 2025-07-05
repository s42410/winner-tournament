const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const Team = require('../models/Team');

// פונקציות עזר ללוגיקה
function getWinner(game) {
  if (game.scoreA > game.scoreB) return game.teamA;
  if (game.scoreB > game.scoreA) return game.teamB;
  throw new Error(`⚠️ יש תיקו בשלב ${game.knockoutStage} — אי אפשר נוקאאוט בלי הכרעה!`);
}

function pairTeamsByRanking(teams) {
  const pairs = [];
  const total = teams.length;
  for (let i = 0; i < total / 2; i++) {
    pairs.push({
      teamA: teams[i],
      teamB: teams[total - 1 - i],
      side: i % 2 === 0 ? 'L' : 'R'
    });
  }
  return pairs;
}

function getNextStage(stage) {
  if (stage === 'שמינית גמר') return 'רבע גמר';
  if (stage === 'רבע גמר') return 'חצי גמר';
  if (stage === 'חצי גמר') return 'גמר';
  return null;
}

// ✅ שליפת משחק בודד
router.get('/game/:gameId', async (req, res) => {
  try {
    const game = await Game.findById(req.params.gameId).populate('teamA teamB');
    if (!game) return res.status(404).json({ error: 'משחק לא נמצא' });
    res.json(game);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ שליפת משחקים לצפייה
router.get('/by-tournament', async (req, res) => {
  const { tournamentId } = req.query;
  if (!tournamentId) return res.status(400).json({ error: '❗ חסר מזהה טורניר' });
  try {
    const games = await Game.find({ tournamentId }).populate('teamA teamB');
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ שליפת משחקים לניהול
router.get('/:tournamentId', async (req, res) => {
  try {
    const games = await Game.find({ tournamentId: req.params.tournamentId }).populate('teamA teamB');
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ יצירת משחק ידני
router.post('/', async (req, res) => {
  try {
    const { tournamentId, teamA, teamB, date, time, location, knockoutStage } = req.body;
    if (teamA === teamB) return res.status(400).json({ error: 'קבוצה לא יכולה לשחק נגד עצמה!' });

    const newGame = new Game({
      tournamentId,
      teamA, teamB, date, time, location,
      knockoutStage: knockoutStage || null
    });

    await newGame.save();
    res.status(201).json({ message: '✅ המשחק נוסף', game: newGame });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ יצירת נוקאאוט אוטומטי לפי דירוגים
router.post('/create-knockout-auto', async (req, res) => {
  try {
    const { tournamentId, stage, numTeams } = req.body;
    if (!tournamentId || !stage || !numTeams) return res.status(400).json({ error: '❗ חסרים נתונים' });

    let expected = 0;
    if (stage === 'שמינית גמר') expected = 16;
    else if (stage === 'רבע גמר') expected = 8;
    else if (stage === 'חצי גמר') expected = 4;
    else if (stage === 'גמר') expected = 2;

    if (numTeams !== expected) {
      return res.status(400).json({ error: `❗ נדרש ${expected} קבוצות לשלב ${stage}` });
    }

    const allTeams = await Team.find({ tournamentId });
    const allGames = await Game.find({ tournamentId }).populate('teamA teamB');

    const hasGroups = allTeams.some(t => t.group && t.group.trim() !== '');
    let ranked = [];

    if (hasGroups) {
      const groups = {};
      allTeams.forEach(t => {
        const g = t.group.trim();
        if (!groups[g]) groups[g] = [];
        groups[g].push({ team: t, points: 0, diff: 0, goals: 0 });
      });

      allGames.forEach(g => {
        if (!g.knockoutStage) {
          const ta = groups[g.teamA.group].find(x => x.team._id.equals(g.teamA._id));
          const tb = groups[g.teamB.group].find(x => x.team._id.equals(g.teamB._id));
          if (ta && tb) {
            ta.goals += g.scoreA || 0; tb.goals += g.scoreB || 0;
            ta.diff += (g.scoreA || 0) - (g.scoreB || 0);
            tb.diff += (g.scoreB || 0) - (g.scoreA || 0);
            if (g.scoreA > g.scoreB) ta.points += 3;
            else if (g.scoreB > g.scoreA) tb.points += 3;
            else { ta.points += 1; tb.points += 1; }
          }
        }
      });

      for (const g in groups) {
        groups[g].sort((a,b) => b.points - a.points || b.diff - a.diff || b.goals - a.goals);
      }

      if (stage === 'שמינית גמר') {
        for (const g in groups) ranked.push(...groups[g].slice(0, 4));
      } else if (stage === 'רבע גמר') {
        for (const g in groups) ranked.push(...groups[g].slice(0, 2));
      } else {
        ranked = Object.values(groups).flat().slice(0, numTeams);
      }

    } else {
      const stats = {};
      allTeams.forEach(t => stats[t._id] = { team: t, points:0, diff:0, goals:0 });
      allGames.forEach(g => {
        if (!g.knockoutStage) {
          stats[g.teamA._id].goals += g.scoreA || 0;
          stats[g.teamB._id].goals += g.scoreB || 0;
          stats[g.teamA._id].diff += (g.scoreA || 0) - (g.scoreB || 0);
          stats[g.teamB._id].diff += (g.scoreB || 0) - (g.scoreA || 0);
          if (g.scoreA > g.scoreB) stats[g.teamA._id].points += 3;
          else if (g.scoreB > g.scoreA) stats[g.teamB._id].points += 3;
          else { stats[g.teamA._id].points += 1; stats[g.teamB._id].points += 1; }
        }
      });

      ranked = Object.values(stats)
        .sort((a,b) => b.points - a.points || b.diff - a.diff || b.goals - a.goals)
        .slice(0, numTeams);
    }

    const fullRanked = ranked.map(r => r.team);
    let currentStage = stage;
    let teams = fullRanked;

    while (teams.length >= 2 && currentStage) {
      const pairs = pairTeamsByRanking(teams);
      for (const p of pairs) {
        const game = new Game({
          tournamentId,
          teamA: p.teamA._id,
          teamB: p.teamB._id,
          date: new Date(),
          time: '12:00',
          location: `מגרש ${currentStage}`,
          knockoutStage: currentStage,
          side: p.side
        });
        await game.save();
      }
      teams = teams.slice(0, teams.length / 2);
      currentStage = getNextStage(currentStage);
    }

    res.status(201).json({ message: '✅ כל שלבי הנוקאאוט נוצרו', teams: fullRanked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ עדכון תוצאה עם עלייה אוטומטית
router.put('/:gameId', async (req, res) => {
  try {
    const { scoreA, scoreB, goals, cards } = req.body;
    const updated = await Game.findByIdAndUpdate(
      req.params.gameId,
      { scoreA, scoreB, goals, cards },
      { new: true }
    );

    const next = getNextStage(updated.knockoutStage);
    if (next) {
      const all = await Game.find({ tournamentId: updated.tournamentId, knockoutStage: updated.knockoutStage });
      const finished = all.filter(g => g.scoreA != null && g.scoreB != null);

      if (finished.length === all.length) {
        const winners = finished.map(getWinner);
        const pairs = pairTeamsByRanking(winners);
        for (const p of pairs) {
          const game = new Game({
            tournamentId: updated.tournamentId,
            teamA: p.teamA,
            teamB: p.teamB,
            date: new Date(),
            time: '12:00',
            location: `מגרש ${next}`,
            knockoutStage: next,
            side: p.side
          });
          await game.save();
        }
      }
    }

    res.json({ message: '✅ המשחק עודכן', game: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ מחיקות
router.delete('/:gameId', async (req, res) => {
  try {
    await Game.findByIdAndDelete(req.params.gameId);
    res.json({ message: '🗑️ המשחק נמחק' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/deleteAll/:tournamentId', async (req, res) => {
  try {
    const result = await Game.deleteMany({ tournamentId: req.params.tournamentId, knockoutStage: { $ne: null } });
    res.json({ message: `🗑️ נמחקו ${result.deletedCount} משחקים` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/group-stage/:tournamentId', async (req, res) => {
  try {
    await Game.deleteMany({ tournamentId: req.params.tournamentId });
    res.json({ message: '✅ כל משחקי הליגה והבתים נמחקו' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

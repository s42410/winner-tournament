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

// ✅ שליפת משחקים לצפייה
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

// ✅ שליפת משחקים לניהול
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
    if (teamA === teamB) return res.status(400).json({ error: 'לא ניתן ליצור משחק בין אותה קבוצה' });

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

// ✅ smartPairing מותאם לכל הלוגיקות (1/2/3/4 בתים)
async function smartPairing(groups, stage, numTeams) {
  let pairs = [];

  // ממיין קבוצות בכל בית לפי נקודות והפרשי שערים
  for (const g of Object.keys(groups)) {
    groups[g].sort((a, b) => 
      b.points - a.points || b.goalsDiff - a.goalsDiff || b.goalsFor - a.goalsFor
    );
  }

  const allTeams = [];
  Object.keys(groups).forEach(groupName => {
    groups[groupName].forEach(teamObj => {
      allTeams.push({ ...teamObj, group: groupName });
    });
  });

  // ממיין את כל הקבוצות
  allTeams.sort((a, b) => 
    b.points - a.points || b.goalsDiff - a.goalsDiff || b.goalsFor - a.goalsFor
  );

  // בוחר רק את ה־numTeams הראשונות
  const selected = allTeams.slice(0, numTeams);

  // ההגרלה: ראשונים מול אחרונים
  for (let i = 0; i < numTeams / 2; i++) {
    pairs.push([selected[i].team, selected[numTeams - 1 - i].team]);
  }

  return pairs;
}


// ✅ יצירת שלב נוקאאוט אוטומטי עם טיפול ב-BYE
router.post('/create-knockout-auto', async (req, res) => {
  try {
    const { tournamentId, stage, numTeams } = req.body;
    if (!tournamentId || !stage || !numTeams) {
      return res.status(400).json({ error: '❗ חסרים נתונים' });
    }

    let expected = 0;
    if (stage === 'שמינית גמר') expected = 16;
    else if (stage === 'רבע גמר') expected = 8;
    else if (stage === 'חצי גמר') expected = 4;
    else if (stage === 'גמר') expected = 2;

    if (numTeams > expected) {
      return res.status(400).json({ error: `❗ יש יותר מדי קבוצות. ${expected} זה המקסימום לשלב ${stage}` });
    }

    const allTeams = await Team.find({ tournamentId });
    const allGames = await Game.find({ tournamentId }).populate('teamA teamB');
    const hasGroups = allTeams.some(t => t.group && t.group.trim() !== '');
    // ✅ בדיקת לוגיקה לפי כמות בתים וכמות קבוצות נדרשת
const numGroups = new Set(allTeams.map(t => t.group?.trim()).filter(Boolean)).size;
console.log(`מספר בתים: ${numGroups}, סך קבוצות: ${allTeams.length}`);

if (numGroups === 1) {
  if (stage === 'שמינית גמר' && allTeams.length < 16) {
    return res.status(400).json({ error: 'צריך לפחות 16 קבוצות בליגה לשמינית גמר' });
  }
  if (stage === 'רבע גמר' && allTeams.length < 8) {
    return res.status(400).json({ error: 'צריך לפחות 8 קבוצות בליגה לרבע גמר' });
  }
  if (stage === 'חצי גמר' && allTeams.length < 4) {
    return res.status(400).json({ error: 'צריך לפחות 4 קבוצות בליגה לחצי גמר' });
  }
  if (stage === 'גמר' && allTeams.length < 2) {
    return res.status(400).json({ error: 'צריך לפחות 2 קבוצות בליגה לגמר' });
  }
} else if (numGroups === 2 || numGroups === 3 || numGroups === 4) {
  // אותה לוגיקה גם לבתים מרובים: עדיפות לפי 16, 8, 4, 2
  if (stage === 'שמינית גמר' && allTeams.length < 16) {
    return res.status(400).json({ error: 'צריך לפחות 16 קבוצות בבתים לשמינית גמר' });
  }
  if (stage === 'רבע גמר' && allTeams.length < 8) {
    return res.status(400).json({ error: 'צריך לפחות 8 קבוצות בבתים לרבע גמר' });
  }
  if (stage === 'חצי גמר' && allTeams.length < 4) {
    return res.status(400).json({ error: 'צריך לפחות 4 קבוצות בבתים לחצי גמר' });
  }
  if (stage === 'גמר' && allTeams.length < 2) {
    return res.status(400).json({ error: 'צריך לפחות 2 קבוצות בבתים לגמר' });
  }
}

console.log('✅ תנאי לוגיקה עברו בהצלחה');

    let pairs = [];

    if (hasGroups) {
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

   pairs = await smartPairing(groups, stage, numTeams);
    } else {
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

    // הוסף BYE אם חסר
    if (numTeams < expected) {
      const byesNeeded = expected - numTeams;

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

      for (let i = 0; i < byesNeeded; i++) {
        pairs.push([sorted[i], null]);
      }
    }

    const newGames = [];
    for (let i = 0; i < pairs.length; i++) {
      const [teamA, teamB] = pairs[i];
      const game = new Game({
        tournamentId,
        teamA: teamA._id,
        teamB: teamB ? teamB._id : null,
        date: new Date(),
        time: '12:00',
        location: 'מגרש נוקאאוט',
        knockoutStage: stage,
        side: i < pairs.length / 2 ? 'L' : 'R'
      });
      await game.save();
      newGames.push(game);
    }

    res.status(201).json({ message: `✅ ${stage} נוצר`, games: newGames });

  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה ביצירת נוקאאוט', details: err.message });
  }
});

// ✅ עדכון תוצאה ויצירת שלב הבא לפי מנצחות בלבד
router.put('/:gameId', async (req, res) => {
  try {
    const { scoreA, scoreB, ...rest } = req.body;

    const updated = await Game.findByIdAndUpdate(
      req.params.gameId,
      { ...rest, scoreA, scoreB },
      { new: true }
    );

    const stages = ['שמינית גמר', 'רבע גמר', 'חצי גמר'];
    if (stages.includes(updated.knockoutStage)) {
      const allStageGames = await Game.find({
        tournamentId: updated.tournamentId,
        knockoutStage: updated.knockoutStage
      });

      const finished = allStageGames.filter(g => g.scoreA != null && g.scoreB != null && g.scoreA !== g.scoreB);
      if (finished.length === allStageGames.length) {
        const winners = finished.map(g => (g.scoreA > g.scoreB ? g.teamA : g.teamB));
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
              knockoutStage: nextStage,
              side: i < winners.length / 2 ? 'L' : 'R'
            });
            await game.save();
          }
          console.log(`🎉 ${nextStage} נוצר`);
        }
      }
    }

    res.json({ message: '✅ המשחק עודכן', game: updated });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בעדכון המשחק', details: err.message });
  }
});

// ✅ מחיקות
router.delete('/:gameId', async (req, res) => {
  try {
    await Game.findByIdAndDelete(req.params.gameId);
    res.json({ message: '🗑️ המשחק נמחק בהצלחה' });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה במחיקה', details: err.message });
  }
});

router.delete('/deleteAll/:tournamentId', async (req, res) => {
  try {
    const result = await Game.deleteMany({
      tournamentId: req.params.tournamentId,
      knockoutStage: { $ne: null }
    });
    res.json({ message: `🗑️ נמחקו ${result.deletedCount} משחקי נוקאאוט` });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה במחיקה', details: err.message });
  }
});

router.delete('/group-stage/:tournamentId', async (req, res) => {
  try {
    await Game.deleteMany({ tournamentId: req.params.tournamentId });
    res.json({ message: '✅ כל משחקי שלב הבתים והליגה נמחקו בהצלחה' });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה במחיקה', details: err.message });
  }
});

module.exports = router;

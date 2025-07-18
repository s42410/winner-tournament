const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const Team = require('../models/Team');
const mongoose = require('mongoose');


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
// ✅ יצירת שלב נוקאאוט אוטומטי עם טיפול ב-BYE ובדיקת לוגיקה מדויקת
router.post('/create-knockout-auto', async (req, res) => {
  try {
    const { tournamentId, stage, numTeams } = req.body;

    if (!tournamentId || !stage || !numTeams) {
      return res.status(400).json({ error: '❗ חסרים נתונים בבקשה' });
    }

    let expected = 0;
    if (stage === 'שמינית גמר') expected = 16;
    else if (stage === 'רבע גמר') expected = 8;
    else if (stage === 'חצי גמר') expected = 4;
    else if (stage === 'גמר') expected = 2;

    if (numTeams > expected) {
      return res.status(400).json({ error: `❗ בשלב ${stage} ניתן מקסימום ${expected} קבוצות` });
    }

    const allTeams = await Team.find({ tournamentId });
    const allGames = await Game.find({ tournamentId }).populate('teamA teamB');

    // בדיקה: כמה בתים וכמה קבוצות יש בפועל
    const numGroups = new Set(allTeams.map(t => t.group?.trim()).filter(Boolean)).size;
    console.log('✅ כל הקבוצות:', allTeams.map(t => t.name));
    console.log('✅ מספר בתים:', numGroups, 'כמות קבוצות:', allTeams.length);

    // בדיקת לוגיקה לכל שלב: אם אין מספיק קבוצות זה מחזיר שגיאה יפה
    if (stage === 'שמינית גמר' && allTeams.length < 16) {
      return res.status(400).json({ error: 'צריך לפחות 16 קבוצות לשמינית גמר' });
    }
    if (stage === 'רבע גמר' && allTeams.length < 8) {
      return res.status(400).json({ error: 'צריך לפחות 8 קבוצות לרבע גמר' });
    }
    if (stage === 'חצי גמר' && allTeams.length < 4) {
      return res.status(400).json({ error: 'צריך לפחות 4 קבוצות לחצי גמר' });
    }
    if (stage === 'גמר' && allTeams.length < 2) {
      return res.status(400).json({ error: 'צריך לפחות 2 קבוצות לגמר' });
    }

    // אם בחרת פחות קבוצות ממה שיש — זה בסדר
    if (numTeams > allTeams.length) {
      return res.status(400).json({ error: `❗ ביקשת ${numTeams} קבוצות אבל יש רק ${allTeams.length}` });
    }

    let pairs = [];
    const hasGroups = allTeams.some(t => t.group && t.group.trim() !== '');

    if (hasGroups) {
      const groups = {};
      allTeams.forEach(t => {
        const g = t.group.trim();
        if (!groups[g]) groups[g] = [];
        groups[g].push({ team: t, points: 0, goalsDiff: 0, goalsFor: 0 });
      });

for (const game of allGames) {
  if (!game.knockoutStage && game.scoreA != null && game.scoreB != null) {
    if (game.teamA && game.teamA.group && groups[game.teamA.group]) {
      const ta = groups[game.teamA.group].find(x => x.team._id.equals(game.teamA._id));
      if (ta) {
        ta.goalsFor += game.scoreA;
        ta.goalsDiff += game.scoreA - game.scoreB;
        if (game.scoreA > game.scoreB) ta.points += 3;
        else if (game.scoreA === game.scoreB) ta.points += 1;
      }
    }
    if (game.teamB && game.teamB.group && groups[game.teamB.group]) {
      const tb = groups[game.teamB.group].find(x => x.team._id.equals(game.teamB._id));
      if (tb) {
        tb.goalsFor += game.scoreB;
        tb.goalsDiff += game.scoreB - game.scoreA;
        if (game.scoreB > game.scoreA) tb.points += 3;
        else if (game.scoreA === game.scoreB) tb.points += 1;
      }
    }
  }
}



      pairs = await smartPairing(groups, stage, numTeams);

    } else {
      const stats = {};
      allTeams.forEach(t => stats[t._id] = { team: t, points: 0, goalsDiff: 0, goalsFor: 0 });

      for (const game of allGames) {
  if (!game.knockoutStage && game.scoreA != null && game.scoreB != null) {
    const ta = stats[game.teamA._id];
    const tb = stats[game.teamB._id];
    ta.goalsFor += game.scoreA;
    tb.goalsFor += game.scoreB;
    ta.goalsDiff += game.scoreA - game.scoreB;
    tb.goalsDiff += game.scoreB - game.scoreA;
    if (game.scoreA > game.scoreB) ta.points += 3;
    else if (game.scoreA < game.scoreB) tb.points += 3;
    else { ta.points += 1; tb.points += 1; }
  }
}


      const sorted = Object.values(stats).sort((a,b) => 
        b.points - a.points || b.goalsDiff - a.goalsDiff || b.goalsFor - a.goalsFor
      ).map(x => x.team);

      for (let i = 0; i < numTeams / 2; i++) {
        pairs.push([sorted[i], sorted[numTeams - 1 - i]]);
      }
    }

    // BYE אם חסר
    if (numTeams < expected) {
      const byesNeeded = expected - numTeams;
      console.log(`✅ מוסיף ${byesNeeded} BYE`);
      const stats = {};
      allTeams.forEach(t => stats[t._id] = { team: t, points: 0, goalsDiff: 0, goalsFor: 0 });
      for (const game of allGames) {
  if (!game.knockoutStage && game.scoreA != null && game.scoreB != null) {
    const ta = stats[game.teamA._id];
    const tb = stats[game.teamB._id];
    ta.goalsFor += game.scoreA;
    tb.goalsFor += game.scoreB;
    ta.goalsDiff += game.scoreA - game.scoreB;
    tb.goalsDiff += game.scoreB - game.scoreA;
    if (game.scoreA > game.scoreB) ta.points += 3;
    else if (game.scoreA < game.scoreB) tb.points += 3;
    else { ta.points += 1; tb.points += 1; }
  }
}

      const sorted = Object.values(stats).sort((a,b) => 
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
        location: `מגרש ${stage}`,
        knockoutStage: stage,
        side: i < pairs.length / 2 ? 'L' : 'R'
      });
      await game.save();
      newGames.push(game);
    }

    res.status(201).json({ message: `✅ ${stage} נוצר בהצלחה`, games: newGames });

  } catch (err) {
    console.error('❌ שגיאה ביצירת נוקאאוט:', err);
    res.status(500).json({ error: '❌ שגיאה כללית', details: err.message });
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
    const idStr = req.params.tournamentId;
    const query = {
      $or: [
        { tournamentId: new mongoose.Types.ObjectId(idStr) },
        { tournamentId: idStr }
      ],
      knockoutStage: { $ne: null }
    };

    const result = await Game.deleteMany(query);
    res.json({ message: `🗑️ נמחקו ${result.deletedCount} משחקי נוקאאוט` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.delete('/group-stage/:tournamentId', async (req, res) => {
  try {
    const idStr = req.params.tournamentId;
    const query = {
      $or: [
        { tournamentId: new mongoose.Types.ObjectId(idStr) },
        { tournamentId: idStr }
      ]
    };

    const result = await Game.deleteMany(query);
    res.json({ message: '✅ כל משחקי שלב הבתים והליגה נמחקו בהצלחה', details: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.put('/reset-scores/:tournamentId', async (req, res) => {
  try {
    const idStr = req.params.tournamentId;
    const query = {
      $or: [
        { tournamentId: new mongoose.Types.ObjectId(idStr) },
        { tournamentId: idStr }
      ]
    };

    console.log('🤖 איפוס תוצאות - QUERY:', query);

    const result = await Game.updateMany(
      query,
      { $set: { scoreA: null, scoreB: null, goals: [] } }
    );

    console.log('🔍 תוצאות איפוס:', result);

    res.json({ message: '🔄 כל התוצאות אופסו בהצלחה', details: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




module.exports = router;

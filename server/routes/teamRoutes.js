const express = require('express');
const router = express.Router();
const Team = require('../models/Team');

// ✅ שליפה של כל הקבוצות לפי מזהה טורניר (למנהל)
router.get('/:tournamentId', async (req, res) => {
  try {
    const teams = await Team.find({ tournamentId: req.params.tournamentId });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בקבלת הקבוצות', details: err.message });
  }
});

// ✅ שליפה לצפייה לפי טורניר (לצופים)
router.get('/tournaments/:tournamentId', async (req, res) => {
  try {
    const teams = await Team.find({ tournamentId: req.params.tournamentId });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בקבלת קבוצות לצפייה', details: err.message });
  }
});

// ✅ שליפה של קבוצה אחת לפי מזהה (כולל שחקנים)
router.get('/team/:teamId', async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ error: 'קבוצה לא נמצאה' });
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בקבלת קבוצה', details: err.message });
  }
});

// ✅ שליפה של שחקני קבוצה בלבד
router.get('/players/:teamId', async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ error: 'קבוצה לא נמצאה' });
    res.json(team.players || []);
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בקבלת שחקנים', details: err.message });
  }
});

// ✅ יצירת קבוצה (כולל group)
router.post('/', async (req, res) => {
  try {
    const { name, color, tournamentId, group } = req.body;
    if (!name || !color || !tournamentId) {
      return res.status(400).json({ error: 'נא למלא את כל השדות' });
    }

    const newTeam = new Team({ name, color, group, tournamentId, players: [] });
    await newTeam.save();
    res.status(201).json({ message: '✅ הקבוצה נוספה בהצלחה', team: newTeam });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה ביצירת הקבוצה', details: err.message });
  }
});

// ✅ עדכון קבוצה (שם, צבע, ואופציונלי group)
router.put('/:teamId', async (req, res) => {
  try {
    const { name, color, group } = req.body;

    if (!name || !color) {
      return res.status(400).json({ error: 'נא למלא את כל השדות' });
    }

    const updateFields = { name, color };
    if (group !== undefined) updateFields.group = group;

    const updated = await Team.findByIdAndUpdate(
      req.params.teamId,
      updateFields,
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'קבוצה לא נמצאה' });

    res.json({ message: '✏️ הקבוצה עודכנה בהצלחה', team: updated });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בעדכון קבוצה', details: err.message });
  }
});

// ✅ עדכון group בלבד (לשמירת בתים ע"י Enter)
router.put('/group/:teamId', async (req, res) => {
  try {
    const { group } = req.body;

    if (group === undefined) {
      return res.status(400).json({ error: 'שדה בית חסר' });
    }

    const updated = await Team.findByIdAndUpdate(
      req.params.teamId,
      { group },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'קבוצה לא נמצאה' });

    res.json({ message: '✅ הבית עודכן בהצלחה', team: updated });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בעדכון הבית', details: err.message });
  }
});

// ✅ הוספת שחקן לקבוצה
router.post('/add-player/:teamId', async (req, res) => {
  try {
    const { firstName, lastName, shirtNumber } = req.body;

    if (!firstName || !lastName || !shirtNumber) {
      return res.status(400).json({ error: 'נא למלא את כל השדות' });
    }

    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ error: 'קבוצה לא נמצאה' });

    team.players.push({ firstName, lastName, shirtNumber });
    await team.save();

    res.json({ message: '✅ שחקן נוסף בהצלחה', team });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בהוספת שחקן', details: err.message });
  }
});

// ✅ מחיקת שחקן מקבוצה לפי אינדקס
router.delete('/remove-player/:teamId/:index', async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ error: 'קבוצה לא נמצאה' });

    const index = parseInt(req.params.index);
    if (isNaN(index) || index < 0 || index >= team.players.length) {
      return res.status(400).json({ error: 'אינדקס שחקן לא תקין' });
    }

    team.players.splice(index, 1);
    await team.save();

    res.json({ message: '🗑️ שחקן נמחק בהצלחה', team });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה במחיקת שחקן', details: err.message });
  }
});

// ✅ מחיקת קבוצה
router.delete('/:teamId', async (req, res) => {
  try {
    await Team.findByIdAndDelete(req.params.teamId);
    res.json({ message: '🗑️ הקבוצה נמחקה בהצלחה' });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה במחיקת הקבוצה', details: err.message });
  }
});

module.exports = router;

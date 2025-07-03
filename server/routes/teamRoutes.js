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

// ✅ שליפה לצפייה לפי טורניר (דרוש ל-viewer-tournament)
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

// ✅ יצירת קבוצה (כולל HOUSE!)
router.post('/', async (req, res) => {
  try {
    const { name, color, house, tournamentId } = req.body;

    if (!name || !color || !tournamentId) {
      return res.status(400).json({ error: 'נא למלא את כל השדות' });
    }

    const newTeam = new Team({ name, color, house, tournamentId, players: [] });
    await newTeam.save();
    res.status(201).json({ message: '✅ הקבוצה נוספה בהצלחה', team: newTeam });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה ביצירת הקבוצה', details: err.message });
  }
});

// ✅ עדכון קבוצה (כולל HOUSE!)
router.put('/:teamId', async (req, res) => {
  try {
    const { name, color, house } = req.body;

    if (!name && !color && !house) {
      return res.status(400).json({ error: 'נא למלא לפחות שדה אחד לעדכון' });
    }

    const updateFields = {};
    if (name) updateFields.name = name;
    if (color) updateFields.color = color;
    if (house !== undefined) updateFields.house = house;

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

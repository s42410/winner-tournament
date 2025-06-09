const express = require('express');
const router = express.Router();
const Team = require('../models/Team');

// ✅ שליפה של כל הקבוצות לפי מזהה טורניר
router.get('/:tournamentId', async (req, res) => {
  try {
    const teams = await Team.find({ tournamentId: req.params.tournamentId });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בקבלת הקבוצות', details: err.message });
  }
});

// ✅ יצירת קבוצה
router.post('/', async (req, res) => {
  try {
    const { name, color, ageGroup, tournamentId } = req.body;

    if (!name || !color || !ageGroup || !tournamentId) {
      return res.status(400).json({ error: 'נא למלא את כל השדות' });
    }

    const newTeam = new Team({ name, color, ageGroup, tournamentId });
    await newTeam.save();
    res.status(201).json({ message: '✅ הקבוצה נוספה בהצלחה', team: newTeam });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה ביצירת הקבוצה', details: err.message });
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

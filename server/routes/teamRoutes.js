
const express = require('express');
const router = express.Router();
const Team = require('../models/Team');

// ✅ שליפת כל הקבוצות לפי מזהה טורניר מתוך query (לטבלת דירוג)
router.get('/', async (req, res) => {
  const tournamentId = req.query.tournamentId;
  if (!tournamentId) return res.status(400).json({ error: '❗ חסר מזהה טורניר ב-query' });

  try {
    const teams = await Team.find({ tournamentId });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בקבלת הקבוצות', details: err.message });
  }
});

// ✅ שליפת קבוצה אחת לפי מזהה (לדף ניהול שחקנים)
router.get('/team/:teamId', async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ error: 'קבוצה לא נמצאה' });
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בשליפת קבוצה', details: err.message });
  }
});

// ✅ שליפת רשימת שחקנים לפי מזהה קבוצה
router.get('/players/:teamId', async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ error: 'קבוצה לא נמצאה' });
    res.json(team.players);
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בקבלת שחקנים', details: err.message });
  }
});

// ✅ שליפת כל הקבוצות לפי מזהה טורניר (עבור ניהול קבוצות)
router.get('/:tournamentId', async (req, res) => {
  try {
    const teams = await Team.find({ tournamentId: req.params.tournamentId });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בקבלת הקבוצות', details: err.message });
  }
});

// ✅ יצירת קבוצה
router.post('/:tournamentId', async (req, res) => {
  const { name, color, grade } = req.body;
  const { tournamentId } = req.params;

  if (!name || !color || !grade) {
    return res.status(400).json({ error: '❗ נא למלא את כל השדות' });
  }

  try {
    const newTeam = new Team({ name, color, grade, tournamentId });
    await newTeam.save();
    res.status(201).json({ message: '✅ הקבוצה נשמרה בהצלחה', team: newTeam });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה ביצירת הקבוצה', details: err.message });
  }
});

// ✅ עדכון קבוצה
router.put('/:teamId', async (req, res) => {
  const { name, color, grade } = req.body;
  try {
    const updated = await Team.findByIdAndUpdate(
      req.params.teamId,
      { name, color, grade },
      { new: true }
    );
    res.json({ message: '✅ הקבוצה עודכנה', team: updated });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בעדכון', details: err.message });
  }
});

// ✅ מחיקת קבוצה
router.delete('/:teamId', async (req, res) => {
  try {
    await Team.findByIdAndDelete(req.params.teamId);
    res.json({ message: '🗑️ הקבוצה נמחקה' });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה במחיקה', details: err.message });
  }
});

// ✅ הוספת שחקן
router.post('/add-player/:teamId', async (req, res) => {
  const { firstName, lastName, shirtNumber } = req.body;
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ error: 'קבוצה לא נמצאה' });

    team.players.push({ firstName, lastName, shirtNumber });
    await team.save();
    res.json({ message: '✅ שחקן נוסף בהצלחה', team });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בהוספת שחקן', details: err.message });
  }
});

// ✅ הסרת שחקן לפי אינדקס
router.delete('/remove-player/:teamId/:index', async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ error: 'קבוצה לא נמצאה' });

    team.players.splice(req.params.index, 1);
    await team.save();
    res.json({ message: '🗑️ שחקן הוסר', team });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה במחיקת שחקן', details: err.message });
  }
});

module.exports = router;

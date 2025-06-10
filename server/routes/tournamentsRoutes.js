const express = require('express');
const router = express.Router();
const Tournament = require('../models/Tournament');

// שליפה של כל הטורנירים לפי אימייל
router.get('/', async (req, res) => {
  const email = req.query.email;
  try {
    const tournaments = email
      ? await Tournament.find({ createdByEmail: email })
      : await Tournament.find();
    res.json(tournaments);
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בקבלת הטורנירים', details: err.message });
  }
});

// שליפה לפי מזהה
router.get('/:id', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'טורניר לא נמצא' });
    res.json(tournament);
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בקבלת טורניר', details: err.message });
  }
});

// יצירת טורניר עם אימייל
router.post('/create', async (req, res) => {
  const { name, grade, type, email } = req.body;

  if (!name || !grade || !type || !email) {
    return res.status(400).json({ error: '❗ נא למלא את כל השדות' });
  }

  try {
    const newTournament = new Tournament({ name, ageGroup: grade, type, createdByEmail: email });
    await newTournament.save();
    res.status(201).json({
      message: '✅ הטורניר נוצר בהצלחה!',
      tournament: newTournament
    });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה ביצירת הטורניר', details: err.message });
  }
});

// עדכון טורניר
router.put('/:id', async (req, res) => {
  const { name, grade, type } = req.body;

  try {
    const updated = await Tournament.findByIdAndUpdate(
      req.params.id,
      { name, ageGroup: grade, type },
      { new: true }
    );
    res.json({ message: '📝 הטורניר עודכן בהצלחה', tournament: updated });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בעדכון הטורניר', details: err.message });
  }
});

// מחיקת טורניר
router.delete('/:id', async (req, res) => {
  try {
    await Tournament.findByIdAndDelete(req.params.id);
    res.json({ message: '🗑️ הטורניר נמחק' });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה במחיקת הטורניר', details: err.message });
  }
});

module.exports = router;

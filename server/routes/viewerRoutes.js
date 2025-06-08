// server/routes/viewerRoutes.js
const express = require('express');
const router = express.Router();
const Viewer = require('../models/Viewer');

// 📥 הרשמה
router.post('/register', async (req, res) => {
  const { email, password, phone } = req.body;

  if (!email || !password || !phone) {
    return res.status(400).json({ error: '❗ נא למלא את כל השדות' });
  }

  try {
    const existing = await Viewer.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: '📧 אימייל כבר רשום' });
    }

    const newViewer = new Viewer({ email, password, phone });
    await newViewer.save();

    res.status(201).json({ message: '✅ נרשמת בהצלחה', data: newViewer });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה ברישום', details: err.message });
  }
});

// 🔑 התחברות
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '❗ נא למלא אימייל וסיסמה' });
  }

  try {
    const viewer = await Viewer.findOne({ email });
    if (!viewer || viewer.password !== password) {
      return res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
    }

    res.json({ message: '✅ התחברת בהצלחה', viewer });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בשרת', details: err.message });
  }
});

module.exports = router;

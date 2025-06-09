const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');

// רישום מנהל חדש
router.post('/register', async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'נא למלא את כל השדות' });
  }

  try {
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(409).json({ error: '❌ משתמש כבר קיים במערכת' });
    }

    const newAdmin = new Admin({ fullName, email, password });
    await newAdmin.save();

    res.status(201).json({
      message: '✅ נרשמת בהצלחה',
      admin: {
        _id: newAdmin._id,
        fullName: newAdmin.fullName,
        email: newAdmin.email
      }
    });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בשרת', details: err.message });
  }
});

// התחברות מנהל
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'נא למלא את כל השדות' });
  }

  try {
    const admin = await Admin.findOne({ email });

    if (!admin || admin.password !== password) {
      return res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
    }

    res.json({
      message: '🎉 התחברת בהצלחה',
      admin: {
        _id: admin._id,
        fullName: admin.fullName,
        email: admin.email
      }
    });
  } catch (err) {
    res.status(500).json({ error: '❌ שגיאה בשרת', details: err.message });
  }
});

module.exports = router;

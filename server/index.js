const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// ✅ נתיבי API
const adminRoutes = require('./routes/adminRoutes');
const tournamentRoutes = require('./routes/tournamentsRoutes');
const teamRoutes = require('./routes/teamRoutes');
const gameRoutes = require('./routes/gamesRoutes');
const viewerRoutes = require('./routes/viewerRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ קבצים סטטיים
app.use(express.static(path.join(__dirname, '../client/public')));

// ✅ מידלווארים
app.use(cors());
app.use(express.json());

// ✅ שימוש בנתיבים
app.use('/api/admin', adminRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/viewers', viewerRoutes);

// ✅ חיבור למסד הנתונים
mongoose.connect(process.env.MONGO_URL)
  .then(() => {
    console.log('✅ התחברת למסד הנתונים בהצלחה');
    app.listen(PORT, () => {
      console.log(`🚀 השרת רץ על http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ שגיאה בחיבור למסד הנתונים:', err.message);
  });

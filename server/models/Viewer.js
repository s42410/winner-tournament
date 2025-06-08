// server/models/Viewer.js
const mongoose = require('mongoose');

const viewerSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  }
});

module.exports = mongoose.model('Viewer', viewerSchema);

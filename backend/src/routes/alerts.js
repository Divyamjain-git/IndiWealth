// alerts.js
const express = require('express');
const ar = express.Router();
const ac = require('../controllers/alertController');
const { protect } = require('../middleware/auth');
ar.get('/', protect, ac.getAlerts);
ar.post('/generate', protect, ac.generateAlerts);
ar.patch('/:id/read', protect, ac.markRead);
ar.patch('/:id/dismiss', protect, ac.dismiss);
module.exports = { alertsRouter: ar };

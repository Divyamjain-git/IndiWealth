// routes/goals.js
const express = require('express');
const r = express.Router();
const c = require('../controllers/goalController');
const { protect } = require('../middleware/auth');
r.get('/', protect, c.getGoals);
r.post('/', protect, c.createGoal);
r.put('/:id', protect, c.updateGoal);
r.delete('/:id', protect, c.deleteGoal);
r.get('/:id/analyze', protect, c.analyzeGoal);
r.get('/meta/suggestions', protect, c.getSuggestions);
module.exports = r;

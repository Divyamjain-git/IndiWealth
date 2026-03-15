/**
 * Score Controller
 */

const Score = require('../models/Score');

exports.getLatestScore = async (req, res, next) => {
  try {
    const score = await Score.findOne({ userId: req.user._id }).sort({ createdAt: -1 });
    if (!score) {
      return res.status(404).json({ success: false, message: 'No score found. Please complete your financial profile.' });
    }
    res.status(200).json({ success: true, data: { score } });
  } catch (error) { next(error); }
};

exports.getScoreHistory = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const scores = await Score.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('totalScore grade createdAt');
    res.status(200).json({ success: true, data: { scores: scores.reverse(), count: scores.length } });
  } catch (error) { next(error); }
};

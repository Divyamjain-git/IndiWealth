const Budget = require('../models/Budget');
const Score = require('../models/Score');

exports.getBudget = async (req, res, next) => {
  try {
    let budget = await Budget.findOne({ userId: req.user._id });
    if (!budget) {
      // Auto-create from latest score
      const score = await Score.findOne({ userId: req.user._id }).sort({ createdAt: -1 });
      const income = score?.metrics?.monthlyIncome || 0;
      budget = await Budget.create({
        userId: req.user._id,
        monthlyIncome: income,
        month: new Date().toISOString().slice(0, 7)
      });
    }
    // Compute budget analysis
    const needs = income => income * 0.50;
    const wants = income => income * 0.30;
    const savings = income => income * 0.20;
    const inc = budget.monthlyIncome;
    const analysis = {
      needsBudget: Math.round(needs(inc)),
      wantsBudget: Math.round(wants(inc)),
      savingsBudget: Math.round(savings(inc)),
      needsActual: Object.values(budget.needs || {}).reduce((s, v) => s + (v?.actual || 0), 0),
      wantsActual: Object.values(budget.wants || {}).reduce((s, v) => s + (v?.actual || 0), 0),
      savingsActual: Object.values(budget.savings || {}).reduce((s, v) => s + (v?.actual || 0), 0)
    };
    res.json({ success: true, data: { budget, analysis } });
  } catch (e) { next(e); }
};

exports.updateBudget = async (req, res, next) => {
  try {
    const budget = await Budget.findOneAndUpdate(
      { userId: req.user._id },
      { ...req.body, userId: req.user._id },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ success: true, data: { budget } });
  } catch (e) { next(e); }
};

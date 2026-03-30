import { getTenantModels } from '../utils/tenantModels.js';
import { useSupabase } from '../config/supabase.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a { [category]: totalAmount } map from actual expenditures for the period.
 * Works for both Supabase and Mongoose backends.
 */
async function buildActualsMap(req, periodStart, periodEnd) {
  const { Expenditure, Budget } = getTenantModels(req);

  if (useSupabase()) {
    return Budget.aggregateActuals(
      new Date(periodStart).toISOString(),
      new Date(periodEnd).toISOString()
    );
  }

  // Mongoose aggregate path
  const aggs = await Expenditure.aggregate([
    {
      $match: {
        date: { $gte: new Date(periodStart), $lte: new Date(periodEnd) }
      }
    },
    {
      $group: {
        _id: { $ifNull: [{ $trim: { input: '$category' } }, 'Uncategorized'] },
        total: { $sum: '$amount' }
      }
    }
  ]);

  const map = {};
  for (const a of aggs) {
    const cat = (a._id || 'Uncategorized').trim() || 'Uncategorized';
    map[cat] = a.total;
  }
  return map;
}

/**
 * Check for existing budgets whose period overlaps [start, end], excluding one id.
 */
async function findOverlapping(req, start, end, excludeId = null) {
  const { Budget } = getTenantModels(req);

  if (useSupabase()) {
    return Budget.findOverlapping(start, end, excludeId);
  }

  // Mongoose path: Budget is a real Mongoose model; query directly
  const query = {
    periodStart: { $lte: new Date(end) },
    periodEnd: { $gte: new Date(start) }
  };
  if (excludeId) query._id = { $ne: excludeId };
  return Budget.find(query);
}

// ─── Controllers ────────────────────────────────────────────────────────────

// POST /api/budgets
export const createBudget = async (req, res) => {
  try {
    const { Budget, ActivityLog } = getTenantModels(req);
    const { name, periodStart, periodEnd, lines = [] } = req.body;

    const overlapping = await findOverlapping(req, periodStart, periodEnd);
    if (overlapping.length > 0) {
      return res.status(409).json({
        error: 'A budget already exists that overlaps with the given period.'
      });
    }

    const budget = await Budget.create({ name, periodStart, periodEnd, lines });

    if (req.user.role === 'admin') {
      await ActivityLog.create({
        actor: req.user.username,
        role: req.user.role,
        action: `Created budget "${name || 'Untitled'}" for period ${periodStart} – ${periodEnd}`,
        affectedMember: null
      });
    }

    res.status(201).json({ message: 'Budget created successfully', budget });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/budgets
export const getAllBudgets = async (req, res) => {
  try {
    const { Budget } = getTenantModels(req);
    const budgets = await Budget.find();
    res.json(budgets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/budgets/:id
export const getBudgetById = async (req, res) => {
  try {
    const { Budget } = getTenantModels(req);
    const budget = await Budget.findById(req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget not found' });
    res.json(budget);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/budgets/:id
export const updateBudget = async (req, res) => {
  try {
    const { Budget, ActivityLog } = getTenantModels(req);
    const { id } = req.params;
    const { name, periodStart, periodEnd, lines } = req.body;

    const existing = await Budget.findById(id);
    if (!existing) return res.status(404).json({ error: 'Budget not found' });

    const newStart = periodStart || existing.periodStart;
    const newEnd = periodEnd || existing.periodEnd;

    const overlapping = await findOverlapping(req, newStart, newEnd, id);
    if (overlapping.length > 0) {
      return res.status(409).json({
        error: 'The updated period overlaps with another existing budget.'
      });
    }

    const updated = await Budget.update(id, {
      ...(name !== undefined && { name }),
      ...(periodStart && { periodStart }),
      ...(periodEnd && { periodEnd }),
      ...(lines !== undefined && { lines })
    });

    if (req.user.role === 'admin') {
      await ActivityLog.create({
        actor: req.user.username,
        role: req.user.role,
        action: `Updated budget "${updated.name || 'Untitled'}"`,
        affectedMember: null
      });
    }

    res.json({ message: 'Budget updated successfully', budget: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/budgets/:id
export const deleteBudget = async (req, res) => {
  try {
    const { Budget, ActivityLog } = getTenantModels(req);
    const { id } = req.params;

    const existing = await Budget.findById(id);
    if (!existing) return res.status(404).json({ error: 'Budget not found' });

    await Budget.findByIdAndDelete(id);

    if (req.user.role === 'admin') {
      await ActivityLog.create({
        actor: req.user.username,
        role: req.user.role,
        action: `Deleted budget "${existing.name || 'Untitled'}"`,
        affectedMember: null
      });
    }

    res.json({ message: 'Budget deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/budgets/:id/summary
export const getBudgetSummary = async (req, res) => {
  try {
    const { Budget } = getTenantModels(req);
    const budget = await Budget.findById(req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget not found' });

    const actualsMap = await buildActualsMap(req, budget.periodStart, budget.periodEnd);

    const lines = (budget.lines || []).map((line) => {
      const cat = (line.category || '').trim();
      const planned = Number(line.plannedAmount || 0);
      const actual = Number(actualsMap[cat] || 0);
      const variance = planned - actual;
      const percentUsed = planned > 0 ? Math.round((actual / planned) * 100) : null;
      return { category: cat, plannedAmount: planned, actualAmount: actual, variance, percentUsed };
    });

    // Collect categories already on budget lines for unbudgeted detection
    const budgetedCategories = new Set(lines.map((l) => l.category));
    const unbudgetedActual = Object.entries(actualsMap)
      .filter(([cat]) => !budgetedCategories.has(cat))
      .reduce((sum, [, amt]) => sum + amt, 0);

    const totalPlanned = lines.reduce((s, l) => s + l.plannedAmount, 0);
    const totalActual = lines.reduce((s, l) => s + l.actualAmount, 0) + unbudgetedActual;
    const totalVariance = totalPlanned - (totalActual - unbudgetedActual);

    res.json({
      budget: {
        id: budget.id || budget._id,
        name: budget.name,
        periodStart: budget.periodStart,
        periodEnd: budget.periodEnd
      },
      lines,
      totals: {
        planned: totalPlanned,
        actual: totalActual - unbudgetedActual,
        variance: totalVariance,
        unbudgetedActual
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

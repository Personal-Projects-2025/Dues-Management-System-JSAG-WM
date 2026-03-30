import { getTenantModels } from '../utils/tenantModels.js';
import { useSupabase } from '../config/supabase.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** { [category]: totalSpent } from expenditures in the period. */
async function buildActualsMap(req, periodStart, periodEnd) {
  const { Expenditure, Budget } = getTenantModels(req);
  if (useSupabase()) {
    return Budget.aggregateActuals(
      new Date(periodStart).toISOString(),
      new Date(periodEnd).toISOString()
    );
  }
  const aggs = await Expenditure.aggregate([
    { $match: { date: { $gte: new Date(periodStart), $lte: new Date(periodEnd) } } },
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

/** { [contributionTypeId | '__untagged__']: totalSpent } from expenditures in the period. */
async function buildFundActualsMap(req, periodStart, periodEnd) {
  const { Expenditure, Budget } = getTenantModels(req);
  if (useSupabase()) {
    return Budget.aggregateActualsByFund(
      new Date(periodStart).toISOString(),
      new Date(periodEnd).toISOString()
    );
  }
  const aggs = await Expenditure.aggregate([
    { $match: { date: { $gte: new Date(periodStart), $lte: new Date(periodEnd) } } },
    { $group: { _id: '$fundedByContributionTypeId', total: { $sum: '$amount' } } }
  ]);
  const map = {};
  for (const a of aggs) {
    const key = a._id ? a._id.toString() : '__untagged__';
    map[key] = a.total;
  }
  return map;
}

/** { [contributionTypeId | '__untyped__']: totalCollected } from contributions in the period. */
async function buildRevenueActualsMap(req, periodStart, periodEnd) {
  const { Contribution, Budget } = getTenantModels(req);
  if (useSupabase()) {
    return Budget.aggregateActualRevenue(
      new Date(periodStart).toISOString(),
      new Date(periodEnd).toISOString()
    );
  }
  const aggs = await Contribution.aggregate([
    { $match: { date: { $gte: new Date(periodStart), $lte: new Date(periodEnd) } } },
    { $group: { _id: '$contributionTypeId', total: { $sum: '$amount' } } }
  ]);
  const map = {};
  for (const a of aggs) {
    const key = a._id ? a._id.toString() : '__untyped__';
    map[key] = a.total;
  }
  return map;
}

/** Check for budgets whose period overlaps [start, end], optionally excluding one id. */
async function findOverlapping(req, start, end, excludeId = null) {
  const { Budget } = getTenantModels(req);
  if (useSupabase()) {
    return Budget.findOverlapping(start, end, excludeId);
  }
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
    const { name, periodStart, periodEnd, lines = [], fundLines = [], revenueLines = [] } = req.body;

    const overlapping = await findOverlapping(req, periodStart, periodEnd);
    if (overlapping.length > 0) {
      return res.status(409).json({ error: 'A budget already exists that overlaps with the given period.' });
    }

    const budget = await Budget.create({ name, periodStart, periodEnd, lines, fundLines, revenueLines });

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
    res.json(await Budget.find());
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
    const { name, periodStart, periodEnd, lines, fundLines, revenueLines } = req.body;

    const existing = await Budget.findById(id);
    if (!existing) return res.status(404).json({ error: 'Budget not found' });

    const newStart = periodStart || existing.periodStart;
    const newEnd = periodEnd || existing.periodEnd;

    const overlapping = await findOverlapping(req, newStart, newEnd, id);
    if (overlapping.length > 0) {
      return res.status(409).json({ error: 'The updated period overlaps with another existing budget.' });
    }

    const updated = await Budget.update(id, {
      ...(name !== undefined && { name }),
      ...(periodStart && { periodStart }),
      ...(periodEnd && { periodEnd }),
      ...(lines !== undefined && { lines }),
      ...(fundLines !== undefined && { fundLines }),
      ...(revenueLines !== undefined && { revenueLines })
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
    const { Budget, ContributionType } = getTenantModels(req);
    const budget = await Budget.findById(req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget not found' });

    // Resolve all contribution type names once (used by Phase 2 & 3)
    const allTypes = await ContributionType.find();
    const typeNameById = {};
    for (const ct of allTypes) {
      typeNameById[(ct.id || ct._id || '').toString()] = ct.name;
    }

    // ── Phase 1: Category spend ───────────────────────────────────────────
    const actualsMap = await buildActualsMap(req, budget.periodStart, budget.periodEnd);

    const lines = (budget.lines || []).map((line) => {
      const cat = (line.category || '').trim();
      const planned = Number(line.plannedAmount || 0);
      const actual = Number(actualsMap[cat] || 0);
      const variance = planned - actual;
      const percentUsed = planned > 0 ? Math.round((actual / planned) * 100) : null;
      return { category: cat, plannedAmount: planned, actualAmount: actual, variance, percentUsed };
    });

    const budgetedCategories = new Set(lines.map((l) => l.category));
    const unbudgetedActual = Object.entries(actualsMap)
      .filter(([cat]) => !budgetedCategories.has(cat))
      .reduce((sum, [, amt]) => sum + amt, 0);
    const totalPlanned = lines.reduce((s, l) => s + l.plannedAmount, 0);
    const totalActual = lines.reduce((s, l) => s + l.actualAmount, 0);

    // ── Phase 2: Fund spend ───────────────────────────────────────────────
    const fundActualsMap = await buildFundActualsMap(req, budget.periodStart, budget.periodEnd);

    const fundLines = (budget.fundLines || []).map((line) => {
      const typeId = (line.contributionTypeId || '').toString();
      const planned = Number(line.plannedAmount || 0);
      const actual = Number(fundActualsMap[typeId] || 0);
      const variance = planned - actual;
      const percentUsed = planned > 0 ? Math.round((actual / planned) * 100) : null;
      return {
        contributionTypeId: typeId,
        contributionTypeName: typeNameById[typeId] || 'Unknown fund',
        plannedAmount: planned,
        actualAmount: actual,
        variance,
        percentUsed
      };
    });

    const budgetedFundIds = new Set(fundLines.map((l) => l.contributionTypeId));
    const untaggedFundActual = Number(fundActualsMap['__untagged__'] || 0);
    const unbudgetedFundActual = Object.entries(fundActualsMap)
      .filter(([id]) => id !== '__untagged__' && !budgetedFundIds.has(id))
      .reduce((sum, [, amt]) => sum + amt, 0) + untaggedFundActual;
    const fundTotalPlanned = fundLines.reduce((s, l) => s + l.plannedAmount, 0);
    const fundTotalActual = fundLines.reduce((s, l) => s + l.actualAmount, 0);

    // ── Phase 3: Revenue (income targets) ─────────────────────────────────
    const revenueActualsMap = await buildRevenueActualsMap(req, budget.periodStart, budget.periodEnd);

    const revenueLines = (budget.revenueLines || []).map((line) => {
      const typeId = (line.contributionTypeId || '').toString();
      // Revenue lines store targetAmount, not plannedAmount
      const target = Number(line.targetAmount || 0);
      const actual = Number(revenueActualsMap[typeId] || 0);
      // Positive variance = surplus (good), negative = shortfall (bad) — reversed from spending
      const variance = actual - target;
      const percentCollected = target > 0 ? Math.round((actual / target) * 100) : null;
      return {
        contributionTypeId: typeId,
        contributionTypeName: typeNameById[typeId] || 'Unknown type',
        targetAmount: target,
        actualAmount: actual,
        variance,
        percentCollected
      };
    });

    const targetedTypeIds = new Set(revenueLines.map((l) => l.contributionTypeId));
    const untypedActual = Number(revenueActualsMap['__untyped__'] || 0);
    const untrackedActual = Object.entries(revenueActualsMap)
      .filter(([id]) => id !== '__untyped__' && !targetedTypeIds.has(id))
      .reduce((sum, [, amt]) => sum + amt, 0) + untypedActual;
    const revTotalTarget = revenueLines.reduce((s, l) => s + l.targetAmount, 0);
    const revTotalActual = revenueLines.reduce((s, l) => s + l.actualAmount, 0);

    res.json({
      budget: {
        id: budget.id || budget._id,
        name: budget.name,
        periodStart: budget.periodStart,
        periodEnd: budget.periodEnd
      },
      // Phase 1
      lines,
      totals: {
        planned: totalPlanned,
        actual: totalActual,
        variance: totalPlanned - totalActual,
        unbudgetedActual
      },
      // Phase 2
      fundLines,
      fundTotals: {
        planned: fundTotalPlanned,
        actual: fundTotalActual,
        variance: fundTotalPlanned - fundTotalActual,
        unbudgetedFundActual
      },
      // Phase 3
      revenueLines,
      revenueTotals: {
        target: revTotalTarget,
        actual: revTotalActual,
        variance: revTotalActual - revTotalTarget,
        untrackedActual
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

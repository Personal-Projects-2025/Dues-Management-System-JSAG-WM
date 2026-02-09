import { getTenantModels } from '../utils/tenantModels.js';

// Generate unique expense ID
const generateExpenseId = () => {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const randomSuffix = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `EXP${dateStr}-${randomSuffix}`;
};

// Create expenditure
export const createExpenditure = async (req, res) => {
  try {
    const { Expenditure, ActivityLog } = getTenantModels(req);
    const { title, description, amount, category, date, fundedByContributionTypeId } = req.body;

    if (!title || !amount) {
      return res.status(400).json({ error: 'Title and amount are required' });
    }

    // Generate unique expense ID
    let expenseId = generateExpenseId();
    let retries = 0;
    while (await Expenditure.findOne({ expenseId }) && retries < 10) {
      expenseId = generateExpenseId();
      retries++;
    }

    const expenditure = new Expenditure({
      expenseId,
      title,
      description: description || '',
      amount: parseFloat(amount),
      category: category || '',
      date: date ? new Date(date) : new Date(),
      spentBy: req.user.username,
      fundedByContributionTypeId: fundedByContributionTypeId || null,
      createdAt: new Date()
    });

    await expenditure.save();

    // Log activity (only for admin users)
    if (req.user.role === 'admin') {
      const log = new ActivityLog({
        actor: req.user.username,
        role: req.user.role,
        action: `Recorded an expenditure of GHS ${amount} for ${title}`,
        affectedMember: null
      });
      await log.save();
    }

    res.status(201).json({
      message: 'Expenditure recorded successfully',
      expenditure
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all expenditures
export const getAllExpenditures = async (req, res) => {
  try {
    const { Expenditure } = getTenantModels(req);
    const { startDate, endDate, category } = req.query;
    let query = {};

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    if (category) {
      query.category = category;
    }

    const expenditures = await Expenditure.find(query)
      .populate('fundedByContributionTypeId', 'name')
      .sort({ date: -1 });
    res.json(expenditures);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get expenditure by ID
export const getExpenditureById = async (req, res) => {
  try {
    const { Expenditure } = getTenantModels(req);
    const { id } = req.params;
    const expenditure = await Expenditure.findById(id);

    if (!expenditure) {
      return res.status(404).json({ error: 'Expenditure not found' });
    }

    res.json(expenditure);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update expenditure
export const updateExpenditure = async (req, res) => {
  try {
    const { Expenditure, ActivityLog } = getTenantModels(req);
    const { id } = req.params;
    const { title, description, amount, category, date, fundedByContributionTypeId } = req.body;

    const expenditure = await Expenditure.findById(id);
    if (!expenditure) {
      return res.status(404).json({ error: 'Expenditure not found' });
    }

    if (title) expenditure.title = title;
    if (description !== undefined) expenditure.description = description;
    if (amount) expenditure.amount = parseFloat(amount);
    if (category !== undefined) expenditure.category = category;
    if (date) expenditure.date = new Date(date);
    if (fundedByContributionTypeId !== undefined) expenditure.fundedByContributionTypeId = fundedByContributionTypeId || null;

    await expenditure.save();

    // Log activity (only for admin users)
    if (req.user.role === 'admin') {
      const log = new ActivityLog({
        actor: req.user.username,
        role: req.user.role,
        action: `Updated expenditure: ${title || expenditure.title}`,
        affectedMember: null
      });
      await log.save();
    }

    res.json({
      message: 'Expenditure updated successfully',
      expenditure
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete expenditure
export const deleteExpenditure = async (req, res) => {
  try {
    const { Expenditure, ActivityLog } = getTenantModels(req);
    const { id } = req.params;
    const expenditure = await Expenditure.findByIdAndDelete(id);

    if (!expenditure) {
      return res.status(404).json({ error: 'Expenditure not found' });
    }

    // Log activity (only for admin users)
    if (req.user.role === 'admin') {
      const log = new ActivityLog({
        actor: req.user.username,
        role: req.user.role,
        action: `Deleted expenditure: ${expenditure.title}`,
        affectedMember: null
      });
      await log.save();
    }

    res.json({ message: 'Expenditure deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get expenditure statistics
export const getExpenditureStats = async (req, res) => {
  try {
    const { Expenditure } = getTenantModels(req);
    const totalExpenditures = await Expenditure.aggregate([
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = totalExpenditures[0] || { totalSpent: 0, count: 0 };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


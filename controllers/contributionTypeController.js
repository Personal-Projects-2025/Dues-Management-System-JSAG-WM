import { getTenantModels } from '../utils/tenantModels.js';

// Ensure Dues type exists (for existing tenants that may not have been seeded)
const ensureDuesTypeExists = async (ContributionType) => {
  const dues = await ContributionType.findOne({ name: 'Dues' });
  if (!dues) {
    await ContributionType.create({
      name: 'Dues',
      description: 'Member dues payments',
      isSystem: true
    });
  }
};

// Get all contribution types
export const getAllContributionTypes = async (req, res) => {
  try {
    const { ContributionType } = getTenantModels(req);
    await ensureDuesTypeExists(ContributionType);
    const types = await ContributionType.find().sort({ isSystem: -1, name: 1 });
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create contribution type
export const createContributionType = async (req, res) => {
  try {
    const { ContributionType } = getTenantModels(req);
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const existing = await ContributionType.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    });
    if (existing) {
      return res.status(400).json({ error: 'A contribution type with this name already exists' });
    }

    const type = await ContributionType.create({
      name: name.trim(),
      description: description?.trim() || '',
      isSystem: false
    });

    res.status(201).json(type);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get contribution type by ID
export const getContributionTypeById = async (req, res) => {
  try {
    const { ContributionType } = getTenantModels(req);
    const type = await ContributionType.findById(req.params.id);
    if (!type) {
      return res.status(404).json({ error: 'Contribution type not found' });
    }
    res.json(type);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update contribution type
export const updateContributionType = async (req, res) => {
  try {
    const { ContributionType } = getTenantModels(req);
    const type = await ContributionType.findById(req.params.id);
    if (!type) {
      return res.status(404).json({ error: 'Contribution type not found' });
    }

    if (type.isSystem && type.name === 'Dues') {
      return res.status(400).json({ error: 'The Dues type cannot be modified' });
    }

    const { name, description } = req.body;
    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }
      const existing = await ContributionType.findOne({
        _id: { $ne: req.params.id },
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
      });
      if (existing) {
        return res.status(400).json({ error: 'A contribution type with this name already exists' });
      }
      type.name = name.trim();
    }
    if (description !== undefined) type.description = description?.trim() || '';

    await type.save();
    res.json(type);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete contribution type
export const deleteContributionType = async (req, res) => {
  try {
    const { ContributionType, Contribution } = getTenantModels(req);
    const type = await ContributionType.findById(req.params.id);
    if (!type) {
      return res.status(404).json({ error: 'Contribution type not found' });
    }

    if (type.isSystem && type.name === 'Dues') {
      return res.status(400).json({ error: 'The Dues type cannot be deleted' });
    }

    const usageCount = await Contribution.countDocuments({ contributionTypeId: type._id });
    if (usageCount > 0) {
      return res.status(400).json({
        error: `Cannot delete: this type is used by ${usageCount} contribution(s)`
      });
    }

    await ContributionType.findByIdAndDelete(req.params.id);
    res.json({ message: 'Contribution type deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

import mongoose from 'mongoose';
import { getTenantModels } from '../utils/tenantModels.js';

const buildSubgroupStats = (subgroups, memberStatsMap) => {
  return subgroups.map((subgroup) => {
    const stats = memberStatsMap.get(subgroup._id.toString()) || {
      totalCollected: 0,
      memberCount: 0
    };

    const totalCollected = stats.totalCollected;
    const memberCount = stats.memberCount;

    return {
      ...subgroup.toObject(),
      totalCollected,
      memberCount,
      averagePerMember: memberCount > 0 ? totalCollected / memberCount : 0
    };
  });
};

export const createSubgroup = async (req, res) => {
  try {
    const { Subgroup, Member } = getTenantModels(req);
    const { name, leaderId } = req.body;

    if (!name || !leaderId) {
      return res.status(400).json({ error: 'Name and leader are required' });
    }

    const leader = await Member.findById(leaderId);
    if (!leader) {
      return res.status(400).json({ error: 'Subgroup leader must be an existing member' });
    }

    const subgroup = new Subgroup({
      name: name.trim(),
      leaderId,
      createdBy: req.user?.userId || req.user?._id
    });

    await subgroup.save();

    // Ensure leader belongs to subgroup
    leader.subgroupId = subgroup._id;
    await leader.save();

    res.status(201).json(subgroup);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getSubgroups = async (req, res) => {
  try {
    const { Subgroup, Member } = getTenantModels(req);
    const subgroups = await Subgroup.find()
      .populate('leaderId', 'name memberId role contact')
      .sort({ createdAt: -1 });

    const memberStats = await Member.aggregate([
      {
        $group: {
          _id: '$subgroupId',
          totalCollected: { $sum: '$totalPaid' },
          memberCount: { $sum: 1 }
        }
      }
    ]);

    const memberStatsMap = new Map();
    memberStats.forEach((stat) => {
      if (stat._id) {
        memberStatsMap.set(stat._id.toString(), {
          totalCollected: stat.totalCollected,
          memberCount: stat.memberCount
        });
      }
    });

    const data = buildSubgroupStats(subgroups, memberStatsMap);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getSubgroupById = async (req, res) => {
  try {
    const { Subgroup, Member } = getTenantModels(req);
    const subgroup = await Subgroup.findById(req.params.id).populate('leaderId', 'name memberId role contact');

    if (!subgroup) {
      return res.status(404).json({ error: 'Subgroup not found' });
    }

    const members = await Member.find({ subgroupId: subgroup._id }).select('name memberId contact totalPaid role');
    const totalCollected = members.reduce((sum, member) => sum + (member.totalPaid || 0), 0);
    const memberCount = members.length;
    const averagePerMember = memberCount > 0 ? totalCollected / memberCount : 0;

    res.json({
      subgroup,
      members,
      stats: {
        totalCollected,
        memberCount,
        averagePerMember
      }
    });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({ error: 'Invalid subgroup ID' });
    }
    res.status(500).json({ error: error.message });
  }
};

export const updateSubgroup = async (req, res) => {
  try {
    const { Subgroup, Member } = getTenantModels(req);
    const { name, leaderId } = req.body;
    const subgroup = await Subgroup.findById(req.params.id);

    if (!subgroup) {
      return res.status(404).json({ error: 'Subgroup not found' });
    }

    if (name) {
      subgroup.name = name.trim();
    }

    if (leaderId) {
      const leader = await Member.findById(leaderId);
      if (!leader) {
        return res.status(400).json({ error: 'Subgroup leader must be an existing member' });
      }
      subgroup.leaderId = leaderId;

      // Assign leader to subgroup
      leader.subgroupId = subgroup._id;
      await leader.save();
    }

    await subgroup.save();

    const updatedSubgroup = await Subgroup.findById(subgroup._id).populate('leaderId', 'name memberId role contact');
    res.json(updatedSubgroup);
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({ error: 'Invalid subgroup ID' });
    }
    res.status(500).json({ error: error.message });
  }
};

export const deleteSubgroup = async (req, res) => {
  try {
    const { Subgroup, Member } = getTenantModels(req);
    const subgroup = await Subgroup.findById(req.params.id);
    if (!subgroup) {
      return res.status(404).json({ error: 'Subgroup not found' });
    }

    // Reassign members to null (Unassigned)
    await Member.updateMany(
      { subgroupId: subgroup._id },
      { $set: { subgroupId: null } }
    );

    await Subgroup.findByIdAndDelete(subgroup._id);

    res.json({ message: 'Subgroup deleted successfully. Members have been set to Unassigned.' });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({ error: 'Invalid subgroup ID' });
    }
    res.status(500).json({ error: error.message });
  }
};

export const getSubgroupLeaderboard = async (req, res) => {
  try {
    const { Subgroup, Member } = getTenantModels(req);
    const subgroups = await Subgroup.find().populate('leaderId', 'name memberId role contact');

    const memberStats = await Member.aggregate([
      {
        $group: {
          _id: '$subgroupId',
          totalCollected: { $sum: '$totalPaid' },
          memberCount: { $sum: 1 }
        }
      }
    ]);

    const memberStatsMap = new Map();
    let unassignedStat = null;
    memberStats.forEach((stat) => {
      if (stat._id) {
        memberStatsMap.set(stat._id.toString(), {
          totalCollected: stat.totalCollected,
          memberCount: stat.memberCount
        });
      } else {
        unassignedStat = stat;
      }
    });

    const entries = buildSubgroupStats(subgroups, memberStatsMap)
      .map((subgroup) => ({
        id: subgroup._id,
        name: subgroup.name,
        leader: subgroup.leaderId,
        totalCollected: subgroup.totalCollected || 0,
        totalMembers: subgroup.memberCount || 0,
        averagePerMember: subgroup.averagePerMember || 0
      }));

    if (unassignedStat) {
      const totalCollected = unassignedStat.totalCollected || 0;
      const memberCount = unassignedStat.memberCount || 0;
      entries.push({
        id: 'unassigned',
        name: 'Unassigned',
        leader: null,
        totalCollected,
        totalMembers: memberCount,
        averagePerMember: memberCount > 0 ? totalCollected / memberCount : 0
      });
    }

    const data = entries
      .sort((a, b) => b.totalCollected - a.totalCollected)
      .map((subgroup, index) => ({
        rank: index + 1,
        ...subgroup
      }));

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



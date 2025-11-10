import Member from '../models/Member.js';
import ActivityLog from '../models/ActivityLog.js';
import Subgroup from '../models/Subgroup.js';

export const getAllMembers = async (req, res) => {
  try {
    const { search, role } = req.query;
    let query = {};

    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { memberId: { $regex: search, $options: 'i' } },
          { contact: { $regex: search, $options: 'i' } }
        ]
      };
    }

    if (role) {
      query.role = role;
    }

    const members = await Member.find(query)
      .populate('subgroupId', 'name')
      .sort({ createdAt: -1 });
    
    // Calculate arrears for each member
    const membersWithArrears = members.map(member => {
      const arrears = member.calculateArrears();
      member.arrears = arrears;
      return member;
    });

    res.json(membersWithArrears);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getMemberById = async (req, res) => {
  try {
    const member = await Member.findById(req.params.id).populate('subgroupId', 'name');
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    member.arrears = member.calculateArrears();
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createMember = async (req, res) => {
  try {
    const { name, memberId, contact, joinDate, duesPerMonth, subgroupId, role } = req.body;

    if (!name || !duesPerMonth) {
      return res.status(400).json({ error: 'Name and dues per month are required' });
    }

    let resolvedSubgroupId = null;
    if (subgroupId) {
      const subgroup = await Subgroup.findById(subgroupId);
      if (!subgroup) {
        return res.status(400).json({ error: 'Invalid subgroup selected' });
      }
      resolvedSubgroupId = subgroupId;
    }

    const member = new Member({
      name,
      memberId,
      contact,
      joinDate: joinDate ? new Date(joinDate) : new Date(),
      duesPerMonth: parseFloat(duesPerMonth),
      totalPaid: 0,
      monthsCovered: 0,
      arrears: 0,
      subgroupId: resolvedSubgroupId,
      role: role && ['member', 'admin'].includes(role) ? role : 'member'
    });

    await member.save();

    // Log activity (only for admin users)
    if (req.user.role === 'admin') {
      const log = new ActivityLog({
        actor: req.user.username,
        role: req.user.role,
        action: `Created member: ${name}`,
        affectedMember: member._id.toString()
      });
      await log.save();
    }

    res.status(201).json(member);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Member ID already exists' });
    }
    res.status(500).json({ error: error.message });
  }
};

export const updateMember = async (req, res) => {
  try {
    const { name, memberId, contact, joinDate, duesPerMonth, subgroupId, role } = req.body;
    const member = await Member.findById(req.params.id);

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (name) member.name = name;
    if (memberId !== undefined) member.memberId = memberId;
    if (contact !== undefined) member.contact = contact;
    if (joinDate) member.joinDate = new Date(joinDate);
    if (duesPerMonth) member.duesPerMonth = parseFloat(duesPerMonth);
    if (role && ['member', 'admin'].includes(role)) {
      member.role = role;
    }

    if (subgroupId !== undefined) {
      if (subgroupId) {
        const subgroup = await Subgroup.findById(subgroupId);
        if (!subgroup) {
          return res.status(400).json({ error: 'Invalid subgroup selected' });
        }
        member.subgroupId = subgroupId;
      } else {
        member.subgroupId = null;
      }
    }

    await member.save();

    // Log activity (only for admin users)
    if (req.user.role === 'admin') {
      const log = new ActivityLog({
        actor: req.user.username,
        role: req.user.role,
        action: `Updated member: ${member.name}`,
        affectedMember: member._id.toString()
      });
      await log.save();
    }

    res.json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteMember = async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const memberName = member.name;
    await Member.findByIdAndDelete(req.params.id);

    // Log activity (only for admin users)
    if (req.user.role === 'admin') {
      const log = new ActivityLog({
        actor: req.user.username,
        role: req.user.role,
        action: `Deleted member: ${memberName}`,
        affectedMember: req.params.id
      });
      await log.save();
    }

    res.json({ message: 'Member deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getMembersInArrears = async (req, res) => {
  try {
    const members = await Member.find().populate('subgroupId', 'name');
    const membersInArrears = members
      .map(member => {
        member.arrears = member.calculateArrears();
        return member;
      })
      .filter(member => member.arrears > 0)
      .sort((a, b) => b.arrears - a.arrears);

    res.json(membersInArrears);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


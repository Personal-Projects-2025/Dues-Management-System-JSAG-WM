import Member from '../models/Member.js';
import { exportMembersToExcel, exportPaymentsToExcel } from '../utils/excelExporter.js';
import { generateReportPDF } from '../utils/pdfGenerator.js';

export const getDashboardStats = async (req, res) => {
  try {
    const members = await Member.find();
    const totalMembers = members.length;
    
    let totalCollected = 0;
    let membersInArrearsCount = 0;
    
    members.forEach(member => {
      totalCollected += member.totalPaid;
      member.arrears = member.calculateArrears();
      if (member.arrears > 0) {
        membersInArrearsCount++;
      }
    });

    // Get total admins
    const User = (await import('../models/User.js')).default;
    const totalAdmins = await User.countDocuments({ role: { $in: ['admin', 'super'] } });

    // Get total expenditures
    const Expenditure = (await import('../models/Expenditure.js')).default;
    const expenditures = await Expenditure.find();
    const totalSpent = expenditures.reduce((sum, exp) => sum + exp.amount, 0);
    const balanceRemaining = totalCollected - totalSpent;

    // Subgroup performance
    const Subgroup = (await import('../models/Subgroup.js')).default;
    const subgroups = await Subgroup.find().lean();
    const subgroupTotals = new Map();

    members.forEach(member => {
      const key = member.subgroupId ? member.subgroupId.toString() : 'unassigned';
      if (!subgroupTotals.has(key)) {
        subgroupTotals.set(key, { totalCollected: 0, memberCount: 0 });
      }
      const stat = subgroupTotals.get(key);
      stat.totalCollected += member.totalPaid;
      stat.memberCount += 1;
    });

    const subgroupStats = subgroups.map(subgroup => {
      const key = subgroup._id.toString();
      const stat = subgroupTotals.get(key) || { totalCollected: 0, memberCount: 0 };
      const leaderMember = subgroup.leaderId
        ? members.find(member => member._id.toString() === subgroup.leaderId.toString())
        : null;
      return {
        id: subgroup._id,
        name: subgroup.name,
        leader: leaderMember
          ? {
              id: leaderMember._id,
              name: leaderMember.name,
              memberId: leaderMember.memberId
            }
          : null,
        totalCollected: stat.totalCollected,
        totalMembers: stat.memberCount,
        averagePerMember: stat.memberCount > 0 ? stat.totalCollected / stat.memberCount : 0
      };
    });

    if (subgroupTotals.has('unassigned')) {
      const stat = subgroupTotals.get('unassigned');
      subgroupStats.push({
        id: 'unassigned',
        name: 'Unassigned',
        leader: null,
        totalCollected: stat.totalCollected,
        totalMembers: stat.memberCount,
        averagePerMember: stat.memberCount > 0 ? stat.totalCollected / stat.memberCount : 0
      });
    }

    subgroupStats.sort((a, b) => b.totalCollected - a.totalCollected);
    const topSubgroup = subgroupStats.length > 0 ? subgroupStats[0] : null;

    // Monthly income trend (last 12 months)
    const monthlyIncome = {};
    const monthlyExpenditure = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyIncome[monthKey] = 0;
      monthlyExpenditure[monthKey] = 0;
    }

    members.forEach(member => {
      member.paymentHistory.forEach(payment => {
        const paymentDate = new Date(payment.date);
        const monthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyIncome[monthKey] !== undefined) {
          monthlyIncome[monthKey] += payment.amount;
        }
      });
    });

    expenditures.forEach(exp => {
      const expDate = new Date(exp.date);
      const monthKey = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyExpenditure[monthKey] !== undefined) {
        monthlyExpenditure[monthKey] += exp.amount;
      }
    });

    res.json({
      totalMembers,
      totalCollected,
      totalSpent,
      balanceRemaining,
      membersInArrears: membersInArrearsCount,
      totalAdmins,
      monthlyIncome: Object.entries(monthlyIncome).map(([month, amount]) => ({ month, amount })),
      monthlyExpenditure: Object.entries(monthlyExpenditure).map(([month, amount]) => ({ month, amount })),
      subgroupStats,
      topSubgroup
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportMembersReport = async (req, res) => {
  try {
    const { format } = req.query;
    const members = await Member.find().sort({ name: 1 });

    if (format === 'excel') {
      const buffer = await exportMembersToExcel(members);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=members-report.xlsx');
      res.send(buffer);
    } else if (format === 'pdf') {
      const pdfBuffer = await generateReportPDF({ members }, 'Members Report');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=members-report.pdf');
      res.send(pdfBuffer);
    } else {
      res.json(members);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportPaymentsReport = async (req, res) => {
  try {
    const { format, startDate, endDate, memberId, recordedBy } = req.query;

    let query = {};
    if (memberId) {
      query._id = memberId;
    }

    const members = await Member.find(query);
    let allPayments = [];

    members.forEach(member => {
      member.paymentHistory.forEach(payment => {
        if (startDate && new Date(payment.date) < new Date(startDate)) return;
        if (endDate && new Date(payment.date) > new Date(endDate)) return;
        if (recordedBy && payment.recordedBy !== recordedBy) return;

        allPayments.push({
          memberName: member.name,
          amount: payment.amount,
          date: payment.date,
          monthsCovered: payment.monthsCovered,
          recordedBy: payment.recordedBy
        });
      });
    });

    if (format === 'excel') {
      const buffer = await exportPaymentsToExcel(allPayments);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=payments-report.xlsx');
      res.send(buffer);
    } else if (format === 'pdf') {
      const pdfBuffer = await generateReportPDF({ payments: allPayments }, 'Payments Report');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=payments-report.pdf');
      res.send(pdfBuffer);
    } else {
      res.json(allPayments);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


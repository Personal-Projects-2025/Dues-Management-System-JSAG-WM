import { getTenantModels } from '../utils/tenantModels.js';
import { generateReceiptPDFFromReceipt, generateContributionReceiptPDF } from '../utils/pdfGenerator.js';
import { sendEmail } from '../utils/mailer.js';
import { renderPaymentReceiptEmail, renderPaymentReceiptText, renderContributionReceiptEmail, renderContributionReceiptText } from '../utils/emailTemplates.js';
import { getUserModel } from '../models/User.js';

const generateReceiptId = () => {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const randomSuffix = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `RCT${dateStr}-${randomSuffix}`;
};

// Create contribution
export const createContribution = async (req, res) => {
  try {
    const {
      Member,
      Contribution,
      ContributionType,
      Receipt,
      ActivityLog
    } = getTenantModels(req);

    const { contributionTypeId, amount, date, memberId, remarks } = req.body;

    if (!contributionTypeId || !amount) {
      return res.status(400).json({ error: 'Contribution type and amount are required' });
    }

    const type = await ContributionType.findById(contributionTypeId);
    if (!type) {
      return res.status(404).json({ error: 'Contribution type not found' });
    }

    const paymentAmount = parseFloat(amount);
    const paymentDate = date ? new Date(date) : new Date();
    const isDues = type.name.toLowerCase() === 'dues';

    let member = null;
    let monthsCovered = 0;
    let savedPaymentId = null;

    if (memberId) {
      member = await Member.findById(memberId);
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }
      if (isDues) {
        monthsCovered = Math.floor(paymentAmount / (member.duesPerMonth || 1));
        const newPayment = {
          amount: paymentAmount,
          date: paymentDate,
          monthsCovered: monthsCovered,
          recordedBy: req.user.username
        };
        member.paymentHistory.push(newPayment);
        member.totalPaid += paymentAmount;
        member.monthsCovered += monthsCovered;
        member.lastPaymentDate = paymentDate;
        member.arrears = member.calculateArrears();
        await member.save();
        savedPaymentId = member.paymentHistory[member.paymentHistory.length - 1]._id;
      }
    }

    const contribution = await Contribution.create({
      contributionTypeId: type._id,
      amount: paymentAmount,
      date: paymentDate,
      recordedBy: req.user.username,
      memberId: memberId || null,
      remarks: remarks || ''
    });

    let receipt = null;
    let receiptEmailStatus = 'pending';

    const tenantData = req.tenant ? {
      name: req.tenant.name,
      config: req.tenant.config,
      contact: req.tenant.contact || {}
    } : null;
    const groupName = req.tenant?.config?.branding?.name || req.tenant?.name || process.env.GROUP_NAME || 'Dues Accountant';

    let receiptId = generateReceiptId();
    let retries = 0;
    while (await Receipt.findOne({ receiptId }) && retries < 10) {
      receiptId = generateReceiptId();
      retries++;
    }

    if (isDues && member && savedPaymentId) {
      receipt = await Receipt.create({
        receiptId,
        receiptType: 'dues',
        memberId: member._id,
        memberName: member.name,
        amount: paymentAmount,
        duesPerMonth: member.duesPerMonth,
        monthsCovered: monthsCovered,
        paymentDate: paymentDate,
        recordedBy: req.user.username,
        recordedAt: new Date(),
        remarks: remarks || '',
        paymentId: savedPaymentId,
        contributionTypeName: 'Dues'
      });
    } else {
      receipt = await Receipt.create({
        receiptId,
        receiptType: 'contribution',
        contributionId: contribution._id,
        contributionTypeName: type.name,
        amount: paymentAmount,
        paymentDate: paymentDate,
        recordedBy: req.user.username,
        recordedAt: new Date(),
        remarks: remarks || '',
        memberId: member?._id || null,
        memberName: member?.name || ''
      });
    }
    contribution.receiptId = receipt.receiptId;
    await contribution.save();

    let emailTo = null;
    let recipientName = req.user.username;

    if (member?.email) {
      emailTo = member.email;
      recipientName = member.name;
    } else {
      const User = await getUserModel();
      const recorderUser = await User.findOne({ username: req.user.username });
      if (recorderUser?.email) {
        emailTo = recorderUser.email;
      }
    }

    if (emailTo) {
      try {
        let pdfBuffer;
        let subject;
        let htmlContent;
        let textContent;

        if (receipt.receiptType === 'dues' && member) {
          const allReceipts = await Receipt.find({ memberId: member._id }).sort({ createdAt: -1 });
          pdfBuffer = await generateReceiptPDFFromReceipt(receipt, member, tenantData, allReceipts);
          subject = `Your Dues Payment Receipt - ${groupName}`;
          htmlContent = renderPaymentReceiptEmail({ member, receipt });
          textContent = renderPaymentReceiptText({ member, receipt });
        } else {
          pdfBuffer = await generateContributionReceiptPDF(receipt, tenantData);
          subject = `Contribution Receipt - ${groupName}`;
          htmlContent = renderContributionReceiptEmail({ receipt, recipientName });
          textContent = renderContributionReceiptText({ receipt, recipientName });
        }

        await sendEmail({
          to: [emailTo],
          subject,
          htmlContent,
          textContent,
          attachments: [{ name: `receipt-${receipt.receiptId}.pdf`, content: pdfBuffer }],
          senderName: groupName
        });
        receiptEmailStatus = 'sent';
      } catch (emailError) {
        console.error('Failed to send receipt email', emailError);
        receiptEmailStatus = 'failed';
      }
    } else {
      receiptEmailStatus = 'missing';
    }

    if (req.user.role === 'admin') {
      const log = new ActivityLog({
        actor: req.user.username,
        role: req.user.role,
        action: `Recorded ${type.name} contribution of GHS ${paymentAmount}${member ? ` for ${member.name}` : ''}`,
        affectedMember: member?._id?.toString() || null
      });
      await log.save();
    }

    res.status(201).json({
      message: 'Contribution recorded successfully',
      contribution: {
        ...contribution.toObject(),
        contributionType: { _id: type._id, name: type.name }
      },
      member: member || undefined,
      receipt: receipt ? { receiptId: receipt.receiptId, _id: receipt._id } : undefined,
      email: { to: emailTo || null, status: receiptEmailStatus }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all contributions (with filters)
export const getAllContributions = async (req, res) => {
  try {
    const { Contribution, ContributionType } = getTenantModels(req);
    const { contributionTypeId, memberId, startDate, endDate } = req.query;

    const query = {};
    if (contributionTypeId) query.contributionTypeId = contributionTypeId;
    if (memberId) query.memberId = memberId;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const contributions = await Contribution.find(query)
      .populate('contributionTypeId', 'name description')
      .populate('memberId', 'name memberId email')
      .sort({ date: -1 });

    const result = contributions.map((c) => ({
      ...c.toObject(),
      contributionType: c.contributionTypeId,
      member: c.memberId
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get contribution by ID
export const getContributionById = async (req, res) => {
  try {
    const { Contribution } = getTenantModels(req);
    const contribution = await Contribution.findById(req.params.id)
      .populate('contributionTypeId', 'name description')
      .populate('memberId', 'name memberId email');

    if (!contribution) {
      return res.status(404).json({ error: 'Contribution not found' });
    }

    res.json(contribution);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get financial breakdown data
export const getFinancialBreakdown = async (req, res) => {
  try {
    const { Contribution, Expenditure, ContributionType, Member } = getTenantModels(req);
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) dateFilter.date.$gte = new Date(startDate);
      if (endDate) dateFilter.date.$lte = new Date(endDate);
    }

    const types = await ContributionType.find().sort({ isSystem: -1, name: 1 });

    const byType = await Contribution.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$contributionTypeId', total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    const typeMap = Object.fromEntries(types.map((t) => [t._id.toString(), t]));
    const byTypeFormatted = byType.map((b) => ({
      contributionTypeId: b._id,
      contributionTypeName: typeMap[b._id?.toString()]?.name || 'Unknown',
      total: b.total,
      count: b.count
    }));

    const byExpenseSource = await Expenditure.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$fundedByContributionTypeId',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const byExpenseSourceFormatted = byExpenseSource.map((b) => ({
      fundedByContributionTypeId: b._id,
      fundedByContributionTypeName: b._id ? (typeMap[b._id.toString()]?.name || 'Unknown') : 'Unspecified',
      total: b.total,
      count: b.count
    }));

    const contributions = await Contribution.find(dateFilter)
      .populate('contributionTypeId', 'name')
      .populate('memberId', 'name memberId')
      .sort({ date: -1 })
      .limit(100);

    const expenditures = await Expenditure.find(dateFilter)
      .populate('fundedByContributionTypeId', 'name')
      .sort({ date: -1 })
      .limit(100);

    res.json({
      byContributionType: byTypeFormatted,
      byExpenseSource: byExpenseSourceFormatted,
      recentContributions: contributions,
      recentExpenditures: expenditures
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

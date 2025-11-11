import Member from '../models/Member.js';
import ActivityLog from '../models/ActivityLog.js';
import Receipt from '../models/Receipt.js';
import { generateReceiptPDFFromReceipt } from '../utils/pdfGenerator.js';
import { sendEmail } from '../utils/mailer.js';
import { renderPaymentReceiptEmail, renderPaymentReceiptText } from '../utils/emailTemplates.js';

// Generate unique receipt ID
const generateReceiptId = () => {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const randomSuffix = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `RCT${dateStr}-${randomSuffix}`;
};

export const recordPayment = async (req, res) => {
  try {
    const { memberId, amount, date, remarks } = req.body;

    if (!memberId || !amount) {
      return res.status(400).json({ error: 'Member ID and amount are required' });
    }

    const member = await Member.findById(memberId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const paymentAmount = parseFloat(amount);
    const paymentDate = date ? new Date(date) : new Date();
    const monthsCovered = Math.floor(paymentAmount / member.duesPerMonth);

    // Add payment to history
    const newPayment = {
      amount: paymentAmount,
      date: paymentDate,
      monthsCovered: monthsCovered,
      recordedBy: req.user.username
    };
    member.paymentHistory.push(newPayment);

    // Update member totals
    member.totalPaid += paymentAmount;
    member.monthsCovered += monthsCovered;
    member.lastPaymentDate = paymentDate;
    member.arrears = member.calculateArrears();

    await member.save();

    // Get the saved payment ID
    const savedPayment = member.paymentHistory[member.paymentHistory.length - 1];

    // Auto-generate receipt
    let receiptId = generateReceiptId();
    let retries = 0;
    while (await Receipt.findOne({ receiptId }) && retries < 10) {
      receiptId = generateReceiptId();
      retries++;
    }

    const receipt = new Receipt({
      receiptId,
      memberId: member._id,
      memberName: member.name,
      amount: paymentAmount,
      duesPerMonth: member.duesPerMonth,
      monthsCovered: monthsCovered,
      paymentDate: paymentDate,
      recordedBy: req.user.username,
      recordedAt: new Date(),
      remarks: remarks || '',
      paymentId: savedPayment._id
    });
    await receipt.save();

    let receiptEmailStatus = member.email ? 'pending' : 'missing';

    if (member.email) {
      try {
        const pdfBuffer = await generateReceiptPDFFromReceipt(receipt, member);
        const groupName = process.env.GROUP_NAME || 'Group Dues';
        await sendEmail({
          to: [member.email],
          subject: `Your Dues Payment Receipt - ${groupName}`,
          htmlContent: renderPaymentReceiptEmail({ member, receipt }),
          textContent: renderPaymentReceiptText({ member, receipt }),
          attachments: [
            {
              name: `receipt-${receipt.receiptId}.pdf`,
              content: pdfBuffer
            }
          ]
        });
        receiptEmailStatus = 'sent';
      } catch (emailError) {
        console.error('Failed to send receipt email', emailError);
        receiptEmailStatus = 'failed';
      }
    }

    // Log activity (only for admin users)
    if (req.user.role === 'admin') {
      const log = new ActivityLog({
        actor: req.user.username,
        role: req.user.role,
        action: `Recorded payment of ${paymentAmount} for ${member.name} (${monthsCovered} months)`,
        affectedMember: member._id.toString()
      });
      await log.save();
    }

    res.status(201).json({
      message: 'Payment recorded successfully',
      member,
      payment: {
        amount: paymentAmount,
        date: paymentDate,
        monthsCovered: monthsCovered,
        recordedBy: req.user.username
      },
      receipt: {
        receiptId: receipt.receiptId,
        _id: receipt._id
      },
      email: {
        to: member.email || null,
        status: receiptEmailStatus
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllPayments = async (req, res) => {
  try {
    const { memberId, startDate, endDate, recordedBy } = req.query;

    let query = {};
    if (memberId) {
      query._id = memberId;
    }

    const members = await Member.find(query);
    let allPayments = [];

    members.forEach(member => {
      member.paymentHistory.forEach(payment => {
        // Apply filters
        if (startDate && new Date(payment.date) < new Date(startDate)) return;
        if (endDate && new Date(payment.date) > new Date(endDate)) return;
        if (recordedBy && payment.recordedBy !== recordedBy) return;

        allPayments.push({
          _id: payment._id,
          memberId: member._id,
          memberName: member.name,
          amount: payment.amount,
          date: payment.date,
          monthsCovered: payment.monthsCovered,
          recordedBy: payment.recordedBy
        });
      });
    });

    // Sort by date descending
    allPayments.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(allPayments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPaymentById = async (req, res) => {
  try {
    const { memberId, paymentId } = req.params;
    const member = await Member.findById(memberId);

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const payment = member.paymentHistory.id(paymentId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({
      _id: payment._id,
      memberId: member._id,
      memberName: member.name,
      amount: payment.amount,
      date: payment.date,
      monthsCovered: payment.monthsCovered,
      recordedBy: payment.recordedBy
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


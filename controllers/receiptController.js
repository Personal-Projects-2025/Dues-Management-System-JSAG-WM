import Receipt from '../models/Receipt.js';
import Member from '../models/Member.js';
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

// Create receipt for a payment
export const createReceipt = async (req, res) => {
  try {
    const { paymentId, memberId, amount, monthsCovered, duesPerMonth, paymentDate, remarks } = req.body;

    if (!paymentId || !memberId || !amount || !monthsCovered || !duesPerMonth || !paymentDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const member = await Member.findById(memberId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Generate unique receipt ID
    let receiptId = generateReceiptId();
    let retries = 0;
    while (await Receipt.findOne({ receiptId }) && retries < 10) {
      receiptId = generateReceiptId();
      retries++;
    }

    const receipt = new Receipt({
      receiptId,
      memberId,
      memberName: member.name,
      amount,
      duesPerMonth,
      monthsCovered,
      paymentDate,
      recordedBy: req.user.username,
      recordedAt: new Date(),
      remarks: remarks || '',
      paymentId
    });

    await receipt.save();

    res.status(201).json({
      message: 'Receipt generated successfully',
      receipt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all receipts for a member
export const getMemberReceipts = async (req, res) => {
  try {
    const { memberId } = req.params;
    const receipts = await Receipt.find({ memberId }).sort({ createdAt: -1 });
    res.json(receipts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get receipt PDF
export const getReceiptPDF = async (req, res) => {
  try {
    const { receiptId } = req.params;
    const receipt = await Receipt.findOne({ receiptId });

    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const member = await Member.findById(receipt.memberId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const pdfBuffer = await generateReceiptPDFFromReceipt(receipt, member);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${receipt.receiptId}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get receipt by ID
export const getReceiptById = async (req, res) => {
  try {
    const { receiptId } = req.params;
    const receipt = await Receipt.findOne({ receiptId });

    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    res.json(receipt);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all receipts
export const getAllReceipts = async (req, res) => {
  try {
    const receipts = await Receipt.find().sort({ createdAt: -1 });
    res.json(receipts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const resendReceiptEmail = async (req, res) => {
  try {
    const { receiptId } = req.params;
    const receipt = await Receipt.findOne({ receiptId });

    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const member = await Member.findById(receipt.memberId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (!member.email) {
      return res.status(400).json({ error: 'Member does not have an email address on file' });
    }

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

    res.json({ message: 'Receipt email sent successfully' });
  } catch (error) {
    console.error('Failed to resend receipt email', error);
    res.status(500).json({ error: 'Failed to send receipt email' });
  }
};



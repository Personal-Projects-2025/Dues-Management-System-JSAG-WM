import { getTenantModels } from '../utils/tenantModels.js';
import { generateReceiptPDFFromReceipt, generateContributionReceiptPDF } from '../utils/pdfGenerator.js';
import { sendEmail } from '../utils/mailer.js';
import { renderPaymentReceiptEmail, renderPaymentReceiptText, renderContributionReceiptEmail, renderContributionReceiptText, renderRecorderReceiptEmail, renderRecorderReceiptText } from '../utils/emailTemplates.js';
import { getUserModel } from '../models/User.js';

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
    const { Receipt, Member } = getTenantModels(req);
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
    const { Receipt } = getTenantModels(req);
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
    const { Receipt, Member } = getTenantModels(req);
    const { receiptId } = req.params;
    const receipt = await Receipt.findOne({ receiptId });

    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const tenantData = req.tenant ? {
      name: req.tenant.name,
      config: req.tenant.config,
      contact: req.tenant.contact || {}
    } : null;

    let pdfBuffer;
    if (receipt.receiptType === 'contribution' || !receipt.memberId) {
      pdfBuffer = await generateContributionReceiptPDF(receipt, tenantData);
    } else {
      const member = await Member.findById(receipt.memberId);
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }
      const allReceipts = await Receipt.find({ memberId: receipt.memberId }).sort({ createdAt: -1 });
      pdfBuffer = await generateReceiptPDFFromReceipt(receipt, member, tenantData, allReceipts);
    }

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
    const { Receipt } = getTenantModels(req);
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
    const { Receipt } = getTenantModels(req);
    const receipts = await Receipt.find().sort({ createdAt: -1 });
    res.json(receipts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const resendReceiptEmail = async (req, res) => {
  try {
    const { Receipt, Member } = getTenantModels(req);
    const { receiptId } = req.params;
    const receipt = await Receipt.findOne({ receiptId });

    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const tenantData = req.tenant ? {
      name: req.tenant.name,
      config: req.tenant.config,
      contact: req.tenant.contact || {}
    } : null;
    const groupName = req.tenant?.config?.branding?.name || req.tenant?.name || process.env.GROUP_NAME || 'Dues Accountant';

    let emailTo = null;
    let recipientName = receipt.recordedBy;
    let pdfBuffer;
    let sendToMember = false;
    let member = null;

    if (receipt.receiptType === 'contribution' || !receipt.memberId) {
      pdfBuffer = await generateContributionReceiptPDF(receipt, tenantData);
      const User = await getUserModel();
      const recorderUser = await User.findOne({ username: receipt.recordedBy });
      if (recorderUser?.email) {
        emailTo = recorderUser.email;
      }
    } else {
      member = await Member.findById(receipt.memberId);
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }
      if (member.email) {
        emailTo = member.email;
        recipientName = member.name;
        sendToMember = true;
      } else {
        const User = await getUserModel();
        const recorderUser = await User.findOne({ username: receipt.recordedBy });
        if (recorderUser?.email) {
          emailTo = recorderUser.email;
        }
      }
      const allReceipts = await Receipt.find({ memberId: receipt.memberId }).sort({ createdAt: -1 });
      pdfBuffer = await generateReceiptPDFFromReceipt(receipt, member, tenantData, allReceipts);
    }

    if (!emailTo) {
      return res.status(400).json({ error: 'No email address available. The recorder must have an email on file.' });
    }

    if (sendToMember) {
      await sendEmail({
        to: [emailTo],
        subject: `Your Dues Payment Receipt - ${groupName}`,
        htmlContent: renderPaymentReceiptEmail({ member, receipt }),
        textContent: renderPaymentReceiptText({ member, receipt }),
        attachments: [{ name: `receipt-${receipt.receiptId}.pdf`, content: pdfBuffer }],
        senderName: groupName
      });
    } else {
      const paymentDescription = receipt.receiptType === 'dues' && receipt.memberName
        ? `dues payment for ${receipt.memberName}` : (receipt.contributionTypeName || 'contribution');
      await sendEmail({
        to: [emailTo],
        subject: `Receipt - ${groupName}`,
        htmlContent: renderRecorderReceiptEmail({ receipt, recipientName, paymentDescription }),
        textContent: renderRecorderReceiptText({ receipt, recipientName, paymentDescription }),
        attachments: [{ name: `receipt-${receipt.receiptId}.pdf`, content: pdfBuffer }],
        senderName: groupName
      });
    }

    res.json({ message: 'Receipt email sent successfully' });
  } catch (error) {
    console.error('Failed to resend receipt email', error);
    res.status(500).json({ error: 'Failed to send receipt email' });
  }
};



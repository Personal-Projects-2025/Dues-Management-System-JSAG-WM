import { getReceiptPublicLinkModel } from '../models/ReceiptPublicLink.js';
import { getTenantConnection } from '../utils/connectionManager.js';
import { getTenantModel } from '../models/Tenant.js';
import { generateReceiptPDFFromReceipt, generateContributionReceiptPDF } from '../utils/pdfGenerator.js';
import { useSupabase } from '../config/supabase.js';

/**
 * GET /api/public/receipt/:token/pdf
 * No auth. Token is unguessable; optional expiry enforced.
 */
export const getPublicReceiptPdf = async (req, res) => {
  try {
    if (useSupabase()) {
      return res.status(501).json({ error: 'Public receipt preview is not available in this deployment mode.' });
    }

    const { token } = req.params;
    if (!token || token.length < 32) {
      return res.status(404).json({ error: 'Not found' });
    }

    const ReceiptPublicLink = await getReceiptPublicLinkModel();
    const link = await ReceiptPublicLink.findOne({ token });
    if (!link) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (link.expiresAt && new Date() > link.expiresAt) {
      return res.status(410).json({ error: 'This receipt link has expired.' });
    }

    const tenantConnection = await getTenantConnection(link.databaseName);
    const Receipt = tenantConnection.models.Receipt;
    const Member = tenantConnection.models.Member;
    if (!Receipt) {
      return res.status(404).json({ error: 'Not found' });
    }

    const receipt = await Receipt.findOne({ receiptId: link.receiptId });
    if (!receipt) {
      return res.status(404).json({ error: 'Not found' });
    }

    const Tenant = await getTenantModel();
    const tenant = await Tenant.findOne({ databaseName: link.databaseName, deletedAt: null });
    const tenantData = tenant
      ? { name: tenant.name, config: tenant.config, contact: tenant.contact || {} }
      : { name: '', config: {}, contact: {} };

    let pdfBuffer;
    if (receipt.receiptType === 'contribution' || !receipt.memberId) {
      pdfBuffer = await generateContributionReceiptPDF(receipt, tenantData);
    } else {
      const member = await Member.findById(receipt.memberId);
      if (!member) {
        return res.status(404).json({ error: 'Not found' });
      }
      const allReceipts = await Receipt.find({ memberId: receipt.memberId }).sort({ createdAt: -1 });
      pdfBuffer = await generateReceiptPDFFromReceipt(receipt, member, tenantData, allReceipts);
    }

    link.accessCount = (link.accessCount || 0) + 1;
    link.lastAccessAt = new Date();
    await link.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receipt-${receipt.receiptId}.pdf"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('getPublicReceiptPdf', error);
    res.status(500).json({ error: 'Failed to load receipt' });
  }
};

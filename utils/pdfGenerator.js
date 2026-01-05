import PDFDocument from 'pdfkit';

// Helper function to format date as "January 3, 2026"
const formatDateRenderStyle = (date) => {
  const d = new Date(date);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

// Helper function to calculate months paid for (based on member's monthsCovered AFTER payment)
const calculateMonthsPaidFor = (member, receiptData) => {
  // Calculate the months THIS payment covers
  // Start from: joinDate + (monthsCovered BEFORE this payment)
  // End at: joinDate + (monthsCovered AFTER this payment)
  const monthsBeforePayment = member.monthsCovered - receiptData.monthsCovered;
  const monthsAfterPayment = member.monthsCovered;
  
  const startDate = new Date(member.joinDate);
  startDate.setMonth(startDate.getMonth() + monthsBeforePayment);
  
  const endDate = new Date(member.joinDate);
  endDate.setMonth(endDate.getMonth() + monthsAfterPayment - 1);
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const startStr = `${months[startDate.getMonth()]} ${startDate.getDate()}, ${startDate.getFullYear()}`;
  const endStr = `${months[endDate.getMonth()]} ${endDate.getDate()}, ${endDate.getFullYear()}`;
  
  return `${startStr} - ${endStr}`;
};

// Helper function to create service description table (modernized)
const createServiceTable = (doc, receiptData, startY, pageWidth, margin) => {
  const tableWidth = pageWidth - (margin * 2);
  const colWidths = {
    description: tableWidth * 0.5,
    qty: tableWidth * 0.15,
    unitPrice: tableWidth * 0.15,
    amount: tableWidth * 0.2
  };
  
  const startX = margin;
  let currentY = startY;
  const rowHeight = 20;
  const headerHeight = 25;
  
  // Table header - lightweight design
  doc.fontSize(10).fillColor('#666666');
  doc.font('Helvetica-Bold');
  doc.rect(startX, currentY, tableWidth, headerHeight).stroke();
  
  doc.text('Description', startX + 5, currentY + 8, { width: colWidths.description - 10 });
  doc.text('Qty', startX + colWidths.description + 5, currentY + 8, { width: colWidths.qty - 10 });
  doc.text('Unit price', startX + colWidths.description + colWidths.qty + 5, currentY + 8, { width: colWidths.unitPrice - 10 });
  doc.text('Amount', startX + colWidths.description + colWidths.qty + colWidths.unitPrice + 5, currentY + 8, { 
    width: colWidths.amount - 10,
    align: 'right'
  });
  
  currentY += headerHeight;
  
  // Service row
  doc.font('Helvetica').fillColor('#000000');
  doc.rect(startX, currentY, tableWidth, rowHeight).stroke();
  doc.text('Dues Payment', startX + 5, currentY + 6, { width: colWidths.description - 10 });
  doc.text(receiptData.monthsCovered.toString(), startX + colWidths.description + 5, currentY + 6, { width: colWidths.qty - 10 });
  doc.text(`GHS ${receiptData.duesPerMonth.toFixed(2)}`, startX + colWidths.description + colWidths.qty + 5, currentY + 6, { 
    width: colWidths.unitPrice - 10,
    align: 'right'
  });
  doc.text(`GHS ${receiptData.amount.toFixed(2)}`, startX + colWidths.description + colWidths.qty + colWidths.unitPrice + 5, currentY + 6, { 
    width: colWidths.amount - 10,
    align: 'right'
  });
  
  currentY += rowHeight;
  
  // Subtotal row
  doc.rect(startX, currentY, tableWidth, rowHeight).stroke();
  doc.text('Subtotal', startX + colWidths.description + colWidths.qty + 5, currentY + 6, { width: colWidths.unitPrice - 10 });
  doc.text(`GHS ${receiptData.amount.toFixed(2)}`, startX + colWidths.description + colWidths.qty + colWidths.unitPrice + 5, currentY + 6, { 
    width: colWidths.amount - 10,
    align: 'right'
  });
  
  currentY += rowHeight;
  
  // Total row - emphasized
  doc.font('Helvetica-Bold');
  doc.rect(startX, currentY, tableWidth, rowHeight).stroke();
  doc.text('Total', startX + colWidths.description + colWidths.qty + 5, currentY + 6, { width: colWidths.unitPrice - 10 });
  doc.text(`GHS ${receiptData.amount.toFixed(2)}`, startX + colWidths.description + colWidths.qty + colWidths.unitPrice + 5, currentY + 6, { 
    width: colWidths.amount - 10,
    align: 'right'
  });
  
  currentY += rowHeight;
  
  // Amount paid row
  doc.font('Helvetica');
  doc.rect(startX, currentY, tableWidth, rowHeight).stroke();
  doc.text('Amount paid', startX + colWidths.description + colWidths.qty + 5, currentY + 6, { width: colWidths.unitPrice - 10 });
  doc.text(`GHS ${receiptData.amount.toFixed(2)}`, startX + colWidths.description + colWidths.qty + colWidths.unitPrice + 5, currentY + 6, { 
    width: colWidths.amount - 10,
    align: 'right'
  });
  
  doc.font('Helvetica');
  doc.fillColor('#000000');
  
  return currentY + rowHeight + 20;
};

// Helper function to create billing summary section
const createSummarySection = (doc, receiptData, memberData, startY, pageWidth, margin, primaryColor) => {
  let currentY = startY;
  const startX = margin;
  
  // Calculate values
  const monthsPaidFor = calculateMonthsPaidFor(memberData, receiptData);
  const outstandingBalance = (memberData.arrears || 0) * (memberData.duesPerMonth || receiptData.duesPerMonth);
  const monthsInArrears = memberData.arrears || 0;
  
  // Section heading
  doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryColor);
  doc.text('Billing Summary', startX, currentY);
  currentY += 20;
  
  // Summary items - compact labeled value pairs
  doc.fontSize(10).font('Helvetica').fillColor('#000000');
  
  // Months Paid For
  doc.text('Months Paid For:', startX, currentY);
  doc.text(monthsPaidFor, startX + 120, currentY);
  currentY += 15;
  
  // Outstanding Balance (emphasized if > 0)
  if (outstandingBalance > 0) {
    doc.font('Helvetica-Bold').fontSize(11);
  }
  doc.text('Outstanding Balance:', startX, currentY);
  doc.text(`GHS ${outstandingBalance.toFixed(2)}`, startX + 120, currentY);
  currentY += 15;
  
  // Months in Arrears (emphasized if > 0)
  if (monthsInArrears > 0) {
    doc.font('Helvetica-Bold').fontSize(11);
  } else {
    doc.font('Helvetica').fontSize(10);
  }
  doc.text('Months in Arrears:', startX, currentY);
  doc.text(monthsInArrears.toString(), startX + 120, currentY);
  
  // Reset font
  doc.font('Helvetica').fontSize(10);
  
  return currentY + 30;
};

// Helper function to create customer information section
const createCustomerSection = (doc, memberData, receiptData, startY, pageWidth, margin) => {
  let currentY = startY;
  const startX = margin;
  
  // Section heading
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#333333');
  doc.text('Bill to', startX, currentY);
  currentY += 18;
  
  // Customer information
  doc.fontSize(10).font('Helvetica').fillColor('#000000');
  doc.text(memberData.name || receiptData.memberName, startX, currentY);
  currentY += 12;
  
  if (memberData.email) {
    doc.text(memberData.email, startX, currentY);
    currentY += 12;
  }
  
  return currentY + 30;
};

// Helper function to create payment confirmation section
const createPaymentConfirmation = (doc, receiptData, startY, pageWidth, margin, primaryColor) => {
  let currentY = startY;
  const startX = margin;
  
  // Large, prominent amount
  doc.fontSize(28).font('Helvetica-Bold').fillColor(primaryColor);
  const amountText = `GHS ${receiptData.amount.toFixed(2)}`;
  doc.text(amountText, startX, currentY);
  
  // Payment date - secondary emphasis
  currentY += 35;
  doc.fontSize(14).font('Helvetica').fillColor('#666666');
  doc.text(`Paid on ${formatDateRenderStyle(receiptData.paymentDate)}`, startX, currentY);
  
  return currentY + 40;
};

// Helper function to create payment history table (modernized - limit to 4 most recent)
const createPaymentHistoryTable = (doc, member, receipts, startY, pageWidth, margin) => {
  if (!member.paymentHistory || member.paymentHistory.length === 0) {
    return startY;
  }
  
  const tableWidth = pageWidth - (margin * 2);
  const colWidths = {
    paymentMethod: tableWidth * 0.25,
    date: tableWidth * 0.25,
    amountPaid: tableWidth * 0.25,
    receiptNumber: tableWidth * 0.25
  };
  
  const startX = margin;
  let currentY = startY;
  const rowHeight = 20;
  const headerHeight = 25;
  
  // Section heading
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#333333');
  doc.text('Payment History', startX, currentY);
  currentY += 18;
  
  // Note about showing only recent payments
  doc.fontSize(9).font('Helvetica').fillColor('#999999');
  doc.text('Showing 4 most recent payments', startX, currentY);
  currentY += 15;
  
  // Table header - lighter visual weight
  doc.fontSize(10).fillColor('#666666');
  doc.font('Helvetica-Bold');
  doc.rect(startX, currentY, tableWidth, headerHeight).stroke();
  
  doc.text('Payment method', startX + 5, currentY + 8, { width: colWidths.paymentMethod - 10 });
  doc.text('Date', startX + colWidths.paymentMethod + 5, currentY + 8, { width: colWidths.date - 10 });
  doc.text('Amount paid', startX + colWidths.paymentMethod + colWidths.date + 5, currentY + 8, { 
    width: colWidths.amountPaid - 10,
    align: 'right'
  });
  doc.text('Receipt number', startX + colWidths.paymentMethod + colWidths.date + colWidths.amountPaid + 5, currentY + 8, { width: colWidths.receiptNumber - 10 });
  
  currentY += headerHeight;
  
  // Create a map of payment IDs to receipt IDs for quick lookup
  const paymentToReceiptMap = {};
  receipts.forEach(receipt => {
    if (receipt.paymentId) {
      // Convert to string for comparison
      const paymentIdStr = receipt.paymentId.toString();
      paymentToReceiptMap[paymentIdStr] = receipt.receiptId;
    }
  });
  
  // Payment rows (sorted by date, newest first) - limit to 4 most recent
  const sortedPayments = [...member.paymentHistory]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 4);
  
  doc.font('Helvetica').fillColor('#000000');
  sortedPayments.forEach((payment) => {
    doc.rect(startX, currentY, tableWidth, rowHeight).stroke();
    
    // Try to find matching receipt by payment ID
    let receiptId = '-';
    if (payment._id) {
      const paymentIdStr = payment._id.toString();
      receiptId = paymentToReceiptMap[paymentIdStr] || '-';
    }
    
    const paymentMethod = 'Cash'; // Default, could be enhanced later
    
    doc.text(paymentMethod, startX + 5, currentY + 6, { width: colWidths.paymentMethod - 10 });
    doc.text(formatDateRenderStyle(payment.date), startX + colWidths.paymentMethod + 5, currentY + 6, { width: colWidths.date - 10 });
    doc.text(`GHS ${payment.amount.toFixed(2)}`, startX + colWidths.paymentMethod + colWidths.date + 5, currentY + 6, { 
      width: colWidths.amountPaid - 10,
      align: 'right'
    });
    doc.text(receiptId, startX + colWidths.paymentMethod + colWidths.date + colWidths.amountPaid + 5, currentY + 6, { width: colWidths.receiptNumber - 10 });
    
    currentY += rowHeight;
  });
  
  doc.fillColor('#000000');
  
  return currentY + 20;
};

export const generateReceiptPDF = (paymentData, memberData) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text('Payment Receipt', { align: 'center' });
      doc.moveDown();

      // Member Info
      doc.fontSize(14).text(`Member: ${memberData.name}`);
      if (memberData.memberId) {
        doc.text(`Member ID: ${memberData.memberId}`);
      }
      if (memberData.contact) {
        doc.text(`Contact: ${memberData.contact}`);
      }
      doc.moveDown();

      // Payment Details
      doc.fontSize(12);
      doc.text(`Amount Paid: ${paymentData.amount}`);
      doc.text(`Payment Date: ${new Date(paymentData.date).toLocaleDateString()}`);
      doc.text(`Months Covered: ${paymentData.monthsCovered}`);
      doc.text(`Recorded By: ${paymentData.recordedBy}`);
      doc.moveDown();

      // Footer
      doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

export const generateReceiptPDFFromReceipt = (receiptData, memberData, tenantData = null, allReceipts = []) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'LETTER' // Letter size (8.5" x 11")
      });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Get page dimensions
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 50;
      const contentWidth = pageWidth - (margin * 2);
      let currentY = margin + 20;

      // Extract tenant information and colors
      const tenantName = tenantData?.config?.branding?.name || tenantData?.name || '';
      const tenantAddress = tenantData?.contact?.address || '';
      const tenantEmail = tenantData?.contact?.email || '';
      const tenantPhone = tenantData?.contact?.phone || '';
      const primaryColor = tenantData?.config?.branding?.primaryColor || '#3B82F6';
      const secondaryColor = tenantData?.config?.branding?.secondaryColor || '#1E40AF';

      // HEADER SECTION - Modern card-based layout
      // Receipt title - large, bold, with tenant primary color
      doc.fontSize(30).font('Helvetica-Bold').fillColor(primaryColor);
      doc.text('Receipt', margin, currentY);
      
      // Organization name - prominent but secondary
      if (tenantName) {
        doc.fontSize(18).font('Helvetica-Bold').fillColor('#333333');
        const tenantNameWidth = doc.widthOfString(tenantName);
        doc.text(tenantName, pageWidth - margin - tenantNameWidth, currentY);
      }
      
      currentY += 35;

      // Receipt metadata - lighter, secondary style
      doc.fontSize(10).font('Helvetica').fillColor('#666666');
      doc.text(`Receipt number ${receiptData.receiptId}`, margin, currentY);
      currentY += 12;
      
      doc.text(`Date paid ${formatDateRenderStyle(receiptData.paymentDate)}`, margin, currentY);
      currentY += 40; // Clear visual separation after header

      // COMPANY INFORMATION BLOCK (Right side, aligned with header)
      if (tenantAddress || tenantEmail || tenantPhone) {
        const companyY = margin + 20;
        doc.fontSize(10).font('Helvetica').fillColor('#666666');
        let companyInfoY = companyY + 35; // Align with receipt metadata
        
        if (tenantAddress) {
          const addressLines = tenantAddress.split('\n').filter(line => line.trim());
          addressLines.forEach(line => {
            doc.text(line, pageWidth - margin - 200, companyInfoY, { width: 200, align: 'right' });
            companyInfoY += 12;
          });
        }
        
        if (tenantEmail) {
          doc.text(tenantEmail, pageWidth - margin - 200, companyInfoY, { width: 200, align: 'right' });
          companyInfoY += 12;
        }
        
        if (tenantPhone) {
          doc.text(tenantPhone, pageWidth - margin - 200, companyInfoY, { width: 200, align: 'right' });
        }
      }

      // BILLING SUMMARY SECTION - Grouped summary
      currentY = createSummarySection(doc, receiptData, memberData, currentY, pageWidth, margin, primaryColor);

      // CUSTOMER INFORMATION SECTION - Clean "Bill to" section
      currentY = createCustomerSection(doc, memberData, receiptData, currentY, pageWidth, margin);

      // PAYMENT CONFIRMATION SECTION - Prominent amount display
      currentY = createPaymentConfirmation(doc, receiptData, currentY, pageWidth, margin, primaryColor);

      // SERVICE DESCRIPTION TABLE - Modernized charges breakdown
      currentY = createServiceTable(doc, receiptData, currentY, pageWidth, margin);

      // PAYMENT HISTORY TABLE - Limited to 4 most recent
      if (memberData.paymentHistory && memberData.paymentHistory.length > 0) {
        currentY = createPaymentHistoryTable(doc, memberData, allReceipts, currentY, pageWidth, margin);
      }

      // FOOTER - Simplified, compact branding
      const footerY = pageHeight - margin - 50;
      currentY = footerY;

      doc.fontSize(9).fillColor('#999999');
      const fontSize = 9;
      const beforeDues = 'Powered by ';
      const duesAccountantText = 'DUES ACCOUNTANT';
      const beforeWinsward = ', a product of ';
      const winswardTechText = 'WINSWARD TECH';
      
      // Calculate text widths and positions
      const beforeDuesWidth = doc.widthOfString(beforeDues, { fontSize });
      const duesAccountantWidth = doc.widthOfString(duesAccountantText, { fontSize });
      const beforeWinswardWidth = doc.widthOfString(beforeWinsward, { fontSize });
      const winswardTechWidth = doc.widthOfString(winswardTechText, { fontSize });
      
      const totalWidth = beforeDuesWidth + duesAccountantWidth + beforeWinswardWidth + winswardTechWidth;
      const startX = (pageWidth - totalWidth) / 2;
      let currentX = startX;
      
      // Draw the marketing text with links using tenant secondary color
      doc.fillColor('#999999').text(beforeDues, currentX, currentY, { fontSize });
      currentX += beforeDuesWidth;
      
      // DUES ACCOUNTANT with link
      doc.fillColor(secondaryColor).text(duesAccountantText, currentX, currentY, { 
        fontSize,
        link: 'https://duesaccountant.com',
        underline: true
      });
      doc.link(currentX, currentY - fontSize * 0.8, duesAccountantWidth, fontSize * 1.2, 'https://duesaccountant.com');
      currentX += duesAccountantWidth;
      
      doc.fillColor('#999999').text(beforeWinsward, currentX, currentY, { fontSize });
      currentX += beforeWinswardWidth;
      
      // WINSWARD TECH with link
      doc.fillColor(secondaryColor).text(winswardTechText, currentX, currentY, { 
        fontSize,
        link: 'https://winswardtech.com',
        underline: true
      });
      doc.link(currentX, currentY - fontSize * 0.8, winswardTechWidth, fontSize * 1.2, 'https://winswardtech.com');

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

export const generateReportPDF = (reportData, title) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text(title, { align: 'center' });
      doc.moveDown();

      if (reportData.members) {
        doc.fontSize(14).text('Members Report');
        doc.moveDown();
        reportData.members.forEach((member, index) => {
          doc.fontSize(12).text(`${index + 1}. ${member.name} - Total Paid: ${member.totalPaid}`);
        });
      }

      if (reportData.payments) {
        doc.moveDown();
        doc.fontSize(14).text('Payments Report');
        doc.moveDown();
        reportData.payments.forEach((payment, index) => {
          doc.fontSize(12).text(`${index + 1}. ${payment.memberName} - ${payment.amount} on ${new Date(payment.date).toLocaleDateString()}`);
        });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};


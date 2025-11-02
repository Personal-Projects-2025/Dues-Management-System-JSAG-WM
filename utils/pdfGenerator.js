import PDFDocument from 'pdfkit';

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


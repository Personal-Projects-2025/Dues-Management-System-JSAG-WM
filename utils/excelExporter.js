import ExcelJS from 'exceljs';

export const exportMembersToExcel = async (members) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Members');

  worksheet.columns = [
    { header: 'Name', key: 'name', width: 30 },
    { header: 'Member ID', key: 'memberId', width: 15 },
    { header: 'Contact', key: 'contact', width: 20 },
    { header: 'Join Date', key: 'joinDate', width: 15 },
    { header: 'Dues Per Month', key: 'duesPerMonth', width: 15 },
    { header: 'Total Paid', key: 'totalPaid', width: 15 },
    { header: 'Months Covered', key: 'monthsCovered', width: 15 },
    { header: 'Arrears', key: 'arrears', width: 15 },
    { header: 'Last Payment Date', key: 'lastPaymentDate', width: 20 }
  ];

  members.forEach(member => {
    worksheet.addRow({
      name: member.name,
      memberId: member.memberId || '',
      contact: member.contact || '',
      joinDate: member.joinDate ? new Date(member.joinDate).toLocaleDateString() : '',
      duesPerMonth: member.duesPerMonth,
      totalPaid: member.totalPaid,
      monthsCovered: member.monthsCovered,
      arrears: member.arrears,
      lastPaymentDate: member.lastPaymentDate ? new Date(member.lastPaymentDate).toLocaleDateString() : ''
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

export const exportPaymentsToExcel = async (payments) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Payments');

  worksheet.columns = [
    { header: 'Member Name', key: 'memberName', width: 30 },
    { header: 'Amount', key: 'amount', width: 15 },
    { header: 'Date', key: 'date', width: 20 },
    { header: 'Months Covered', key: 'monthsCovered', width: 15 },
    { header: 'Recorded By', key: 'recordedBy', width: 20 }
  ];

  payments.forEach(payment => {
    worksheet.addRow({
      memberName: payment.memberName,
      amount: payment.amount,
      date: new Date(payment.date).toLocaleDateString(),
      monthsCovered: payment.monthsCovered,
      recordedBy: payment.recordedBy
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

export const exportLogsToExcel = async (logs) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Activity Logs');

  worksheet.columns = [
    { header: 'Actor', key: 'actor', width: 20 },
    { header: 'Role', key: 'role', width: 15 },
    { header: 'Action', key: 'action', width: 50 },
    { header: 'Date', key: 'date', width: 20 },
    { header: 'Affected Member', key: 'affectedMember', width: 30 }
  ];

  logs.forEach(log => {
    worksheet.addRow({
      actor: log.actor,
      role: log.role,
      action: log.action,
      date: new Date(log.date).toLocaleString(),
      affectedMember: log.affectedMember || ''
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};


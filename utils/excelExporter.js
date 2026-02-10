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

const MAX_BULK_ROWS = 500;

/**
 * Parse an Excel buffer for bulk member upload.
 * First row = headers (case-insensitive: Name, Email, Phone, Subgroup). Rows 2+ = data.
 * Returns { members, errors: [] }. Skips rows with empty name. Max MAX_BULK_ROWS rows.
 */
export const parseBulkMembersExcel = async (buffer) => {
  const errors = [];
  const members = [];
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    return { members: [], errors: [{ message: 'Excel must have a header row and at least one data row' }] };
  }
  const headerRow = sheet.getRow(1);
  const colIndex = {};
  for (let c = 1; c <= headerRow.cellCount; c++) {
    const val = (headerRow.getCell(c).value ?? '').toString().trim().toLowerCase();
    if (val === 'name') colIndex.name = c;
    else if (val === 'email') colIndex.email = c;
    else if (val === 'phone') colIndex.phone = c;
    else if (val === 'subgroup') colIndex.subgroup = c;
  }
  if (!colIndex.name) {
    return { members: [], errors: [{ message: 'Excel must have a "Name" column in the first row' }] };
  }
  const dataRowCount = sheet.rowCount - 1;
  if (dataRowCount > MAX_BULK_ROWS) {
    return {
      members: [],
      errors: [{ message: `Maximum ${MAX_BULK_ROWS} rows allowed. File has ${dataRowCount} data rows.` }]
    };
  }
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const name = (row.getCell(colIndex.name).value ?? '').toString().trim();
    if (!name) continue;
    const email = colIndex.email ? (row.getCell(colIndex.email).value ?? '').toString().trim() : '';
    const contact = colIndex.phone ? (row.getCell(colIndex.phone).value ?? '').toString().trim() : '';
    const subgroup = colIndex.subgroup ? (row.getCell(colIndex.subgroup).value ?? '').toString().trim() : '';
    members.push({ name, email, contact, subgroup });
  }
  return { members, errors };
};

/**
 * Generate bulk upload template: one sheet with headers Name, Email, Phone, Subgroup and example rows.
 */
export const generateBulkMembersTemplate = async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Members');
  sheet.columns = [
    { header: 'Name', key: 'name', width: 30 },
    { header: 'Email', key: 'email', width: 35 },
    { header: 'Phone', key: 'phone', width: 20 },
    { header: 'Subgroup', key: 'subgroup', width: 20 }
  ];
  sheet.addRow({ name: 'John Doe', email: 'john@example.com', phone: '0244123456', subgroup: 'Group A' });
  sheet.addRow({ name: 'Jane Smith', email: 'jane@example.com', phone: '0555123456', subgroup: 'Group B' });
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


import { getTenantModels } from '../utils/tenantModels.js';
import { exportLogsToExcel } from '../utils/excelExporter.js';

export const getActivityLogs = async (req, res) => {
  try {
    const { ActivityLog } = getTenantModels(req);
    const { actor, startDate, endDate, action } = req.query;
    const userRole = req.user.role;
    const username = req.user.username;

    let query = {};

    // Admin users can only see their own logs
    if (userRole === 'admin') {
      query.actor = username;
    }

    // Super users can see all logs and filter by actor
    if (userRole === 'super' && actor) {
      query.actor = actor;
    }

    if (startDate) {
      query.date = { ...query.date, $gte: new Date(startDate) };
    }
    if (endDate) {
      query.date = { ...query.date, $lte: new Date(endDate) };
    }
    if (action) {
      query.action = { $regex: action, $options: 'i' };
    }

    const logs = await ActivityLog.find(query).sort({ date: -1 }).limit(1000);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportActivityLogs = async (req, res) => {
  try {
    const { ActivityLog } = getTenantModels(req);
    const { actor, startDate, endDate, action } = req.query;
    const userRole = req.user.role;
    const username = req.user.username;

    let query = {};

    if (userRole === 'admin') {
      query.actor = username;
    }

    if (userRole === 'super' && actor) {
      query.actor = actor;
    }

    if (startDate) {
      query.date = { ...query.date, $gte: new Date(startDate) };
    }
    if (endDate) {
      query.date = { ...query.date, $lte: new Date(endDate) };
    }
    if (action) {
      query.action = { $regex: action, $options: 'i' };
    }

    const logs = await ActivityLog.find(query).sort({ date: -1 });
    const buffer = await exportLogsToExcel(logs);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=activity-logs.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteActivityLog = async (req, res) => {
  try {
    // Only super users can delete logs
    if (req.user.role !== 'super') {
      return res.status(403).json({ error: 'Only super users can delete logs' });
    }

    const { ActivityLog } = getTenantModels(req);
    const log = await ActivityLog.findByIdAndDelete(req.params.id);
    if (!log) {
      return res.status(404).json({ error: 'Log not found' });
    }

    res.json({ message: 'Log deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


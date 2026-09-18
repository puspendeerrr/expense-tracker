/**
 * Report Controller — dashboard analytics + Excel export.
 *
 * Both endpoints resolve the group from the authenticated user's own membership. A client-supplied
 * groupId is never read, so a user cannot reach another group's data by manipulating parameters.
 */

const {
  parseReportFilters,
  resolveUserGroup,
  buildReport,
  buildExportDataset,
} = require('../services/reportingService');
const { generateFinancialReport } = require('../services/excelExportService');

/**
 * @desc   Full dashboard analytics report for the authenticated user's group
 * @route  GET /api/reports/dashboard
 * @access Private
 */
const getDashboardReport = async (req, res) => {
  try {
    const parsed = parseReportFilters(req.query);
    if (!parsed.ok) {
      return res.status(400).json({ message: parsed.error });
    }

    const resolved = await resolveUserGroup(req.user._id);
    if (!resolved.ok) {
      // Not an error condition — a groupless user is a valid state the client renders for.
      return res.status(200).json({ hasGroup: false, user: req.user });
    }

    const report = await buildReport(
      req.user._id.toString(),
      resolved.group,
      resolved.membership,
      parsed.filters
    );

    return res.json({ hasGroup: true, ...report });
  } catch (error) {
    console.error('Get Dashboard Report Error:', error);
    return res.status(500).json({ message: 'Server error generating dashboard report' });
  }
};

/**
 * @desc   Export the currently filtered financial scope as an .xlsx workbook
 * @route  GET /api/reports/export?format=xlsx
 * @access Private
 */
const exportFinancialReport = async (req, res) => {
  try {
    const format = (req.query.format || 'xlsx').toLowerCase();
    if (format !== 'xlsx') {
      return res.status(400).json({ message: 'Unsupported export format. Only "xlsx" is supported.' });
    }

    const parsed = parseReportFilters(req.query);
    if (!parsed.ok) {
      return res.status(400).json({ message: parsed.error });
    }

    const resolved = await resolveUserGroup(req.user._id);
    if (!resolved.ok) {
      return res.status(resolved.status).json({ message: resolved.error });
    }

    const { report, fullExpenses } = await buildExportDataset(
      req.user._id.toString(),
      resolved.group,
      resolved.membership,
      parsed.filters
    );

    const { buffer, filename } = await generateFinancialReport({
      report,
      fullExpenses,
      user: req.user,
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    // Expose the filename so the browser fetch layer can name the download correctly.
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Cache-Control', 'no-store');

    return res.status(200).send(buffer);
  } catch (error) {
    console.error('Export Financial Report Error:', error);
    // The client may already be reading a binary stream; keep the failure JSON and explicit.
    if (res.headersSent) {
      return res.end();
    }
    return res.status(500).json({ message: 'Unable to generate report. Please try again.' });
  }
};

module.exports = { getDashboardReport, exportFinancialReport };

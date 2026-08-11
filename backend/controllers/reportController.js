const { findEmployeeByUserId } = require('../services/employeeService');
const { validateYearQuery } = require('../validators/reportValidator');
const {
  getOverviewReport,
  getLeaveSummaryReport,
  getDepartmentSummaryReport,
  getLeaveTrendsReport,
} = require('../services/reportService');

/**
 * Helper to resolve acting user role and manager employee record
 */
const resolveUserContext = async (req) => {
  const role = req.user.role;
  let managerEmpId = null;

  if (role === 'employee') {
    const err = new Error('Forbidden: Employees are not authorized to access reporting APIs.');
    err.statusCode = 403;
    throw err;
  }

  if (role === 'manager') {
    const managerEmp = await findEmployeeByUserId(req.user.userId);
    if (!managerEmp) {
      const err = new Error('Manager employee profile not found.');
      err.statusCode = 404;
      throw err;
    }
    managerEmpId = managerEmp.id;
  }

  return { role, managerEmpId };
};

/**
 * GET /api/reports/overview
 */
const getOverview = async (req, res, next) => {
  try {
    const context = await resolveUserContext(req);
    const reportData = await getOverviewReport(context);

    return res.status(200).json({
      success: true,
      data: reportData,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * GET /api/reports/leave-summary
 */
const getLeaveSummary = async (req, res, next) => {
  try {
    const context = await resolveUserContext(req);

    const yearValidation = validateYearQuery(req.query.year);
    if (!yearValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: yearValidation.message,
      });
    }

    const summaryData = await getLeaveSummaryReport({
      ...context,
      year: yearValidation.year,
    });

    return res.status(200).json({
      success: true,
      summary: summaryData,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * GET /api/reports/department-summary
 */
const getDepartmentSummary = async (req, res, next) => {
  try {
    const context = await resolveUserContext(req);
    const departmentData = await getDepartmentSummaryReport(context);

    return res.status(200).json({
      success: true,
      data: departmentData,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * GET /api/reports/leave-trends
 */
const getLeaveTrends = async (req, res, next) => {
  try {
    const context = await resolveUserContext(req);

    const yearValidation = validateYearQuery(req.query.year);
    if (!yearValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: yearValidation.message,
      });
    }

    const trendsData = await getLeaveTrendsReport({
      ...context,
      year: yearValidation.year,
    });

    return res.status(200).json({
      success: true,
      data: trendsData,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

module.exports = {
  getOverview,
  getLeaveSummary,
  getDepartmentSummary,
  getLeaveTrends,
};

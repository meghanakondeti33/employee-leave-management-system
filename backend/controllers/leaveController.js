const { validateCreateLeaveInput, validateRejectionInput } = require('../validators/leaveValidator');
const { findEmployeeByUserId } = require('../services/employeeService');
const { createAuditLog } = require('../services/auditService');
const {
  checkPolicyExists,
  checkLeaveBalance,
  checkOverlappingLeaves,
  createLeaveRequest: createLeaveRequestService,
  findEmployeeLeaveRequests,
  findLeaveRequestById,
  updateLeaveRequestStatus,
  approveLeaveRequestTransaction,
  rejectLeaveRequestTransaction,
} = require('../services/leaveService');

/**
 * POST /api/leaves
 * Submit a new leave request
 */
const createLeaveRequest = async (req, res, next) => {
  try {
    const employee = await findEmployeeByUserId(req.user.userId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found for the authenticated user.',
      });
    }

    const validation = validateCreateLeaveInput(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.errors.join(' '),
      });
    }

    const { leavePolicyId, startDate, endDate, reason } = req.body;
    const requestedDays = validation.days;

    // 1. Verify policy exists
    const policy = await checkPolicyExists(leavePolicyId);
    if (!policy) {
      return res.status(404).json({
        success: false,
        message: `Leave policy with ID ${leavePolicyId} does not exist.`,
      });
    }

    // 2. Check remaining leave balance for current year
    const requestYear = new Date(startDate).getFullYear();
    const balanceCheck = await checkLeaveBalance(employee.id, leavePolicyId, requestYear, requestedDays);

    if (!balanceCheck.hasBalance) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient leave balance.',
        details: {
          requestedDays,
          remainingDays: balanceCheck.remainingDays,
        },
      });
    }

    // 3. Check for overlapping pending or approved leave requests
    const hasOverlap = await checkOverlappingLeaves(employee.id, startDate, endDate);
    if (hasOverlap) {
      return res.status(409).json({
        success: false,
        message: 'Leave request overlaps with an existing pending or approved leave request.',
      });
    }

    // 4. Create pending leave request
    const leaveRequest = await createLeaveRequestService({
      employeeId: employee.id,
      leavePolicyId,
      startDate,
      endDate,
      days: requestedDays,
      reason,
      actingUserId: req.user.userId,
    });

    return res.status(201).json({
      success: true,
      message: 'Leave request created successfully',
      leaveRequest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leaves/my
 * View authenticated employee's own leave requests with optional status filtering
 */
const getMyLeaveRequests = async (req, res, next) => {
  try {
    const employee = await findEmployeeByUserId(req.user.userId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found for the authenticated user.',
      });
    }

    const ALLOWED_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];
    const statusQuery = req.query.status ? req.query.status.trim().toLowerCase() : null;

    if (statusQuery && !ALLOWED_STATUSES.includes(statusQuery)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status filter. Allowed values: ${ALLOWED_STATUSES.join(', ')}.`,
      });
    }

    const leaveRequests = await findEmployeeLeaveRequests(employee.id, statusQuery);

    return res.status(200).json({
      success: true,
      count: leaveRequests.length,
      leaveRequests,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leaves/:id
 * View individual leave request belonging to the authenticated employee
 */
const getLeaveRequestById = async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    if (isNaN(requestId) || requestId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid leave request ID parameter.',
      });
    }

    const leaveRequest = await findLeaveRequestById(requestId);
    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found.',
      });
    }

    const employee = await findEmployeeByUserId(req.user.userId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found.',
      });
    }

    if (leaveRequest.employee_id !== employee.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only view your own leave requests.',
      });
    }

    return res.status(200).json({
      success: true,
      leaveRequest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/leaves/:id
 * Cancel pending leave request (Soft update status = 'cancelled')
 */
const cancelLeaveRequest = async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    if (isNaN(requestId) || requestId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid leave request ID parameter.',
      });
    }

    const leaveRequest = await findLeaveRequestById(requestId);
    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found.',
      });
    }

    const employee = await findEmployeeByUserId(req.user.userId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found.',
      });
    }

    if (leaveRequest.employee_id !== employee.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only cancel your own leave requests.',
      });
    }

    if (leaveRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Only pending leave requests can be cancelled. Current status is '${leaveRequest.status}'.`,
      });
    }

    const updatedRequest = await updateLeaveRequestStatus(requestId, 'cancelled');

    await createAuditLog({
      userId: req.user.userId,
      action: 'LEAVE_CANCELLED',
      entityType: 'leave_request',
      entityId: requestId,
      description: 'Cancelled pending leave request',
    });

    return res.status(200).json({
      success: true,
      message: 'Leave request cancelled successfully',
      leaveRequest: updatedRequest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/leaves/:id/approve
 * Approve leave request (Manager / Admin)
 */
const approveLeaveRequest = async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    if (isNaN(requestId) || requestId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid leave request ID parameter.',
      });
    }

    const updatedRequest = await approveLeaveRequestTransaction({
      requestId,
      actingUserId: req.user.userId,
      actingRole: req.user.role,
    });

    return res.status(200).json({
      success: true,
      message: 'Leave request approved',
      request: updatedRequest,
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
 * PUT /api/leaves/:id/reject
 * Reject leave request with rejection reason (Manager / Admin)
 */
const rejectLeaveRequest = async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    if (isNaN(requestId) || requestId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid leave request ID parameter.',
      });
    }

    const validation = validateRejectionInput(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.errors.join(' '),
      });
    }

    const updatedRequest = await rejectLeaveRequestTransaction({
      requestId,
      rejectionReason: req.body.rejectionReason,
      actingUserId: req.user.userId,
      actingRole: req.user.role,
    });

    return res.status(200).json({
      success: true,
      message: 'Leave request rejected',
      request: updatedRequest,
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
  createLeaveRequest,
  getMyLeaveRequests,
  getLeaveRequestById,
  cancelLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
};

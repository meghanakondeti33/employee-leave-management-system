const isValidDate = (dateString) => {
  if (typeof dateString !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  const d = new Date(dateString);
  return d instanceof Date && !isNaN(d.getTime());
};

/**
 * Calculate inclusive calendar days between start and end date
 * e.g., 2026-08-20 to 2026-08-22 = 3 days
 */
const calculateLeaveDays = (startDateStr, endDateStr) => {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24)) + 1;
  return diffDays;
};

const validateCreateLeaveInput = ({ leavePolicyId, startDate, endDate, reason }) => {
  const errors = [];

  if (!leavePolicyId || isNaN(parseInt(leavePolicyId, 10)) || parseInt(leavePolicyId, 10) <= 0) {
    errors.push('A valid leavePolicyId is required.');
  }

  if (!startDate || !isValidDate(startDate)) {
    errors.push('A valid startDate in YYYY-MM-DD format is required.');
  }

  if (!endDate || !isValidDate(endDate)) {
    errors.push('A valid endDate in YYYY-MM-DD format is required.');
  }

  if (startDate && endDate && isValidDate(startDate) && isValidDate(endDate)) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      errors.push('endDate cannot be earlier than startDate.');
    }
  }

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    errors.push('A reason for the leave request is required.');
  }

  const days = (startDate && endDate && isValidDate(startDate) && isValidDate(endDate) && new Date(endDate) >= new Date(startDate))
    ? calculateLeaveDays(startDate, endDate)
    : 0;

  return {
    isValid: errors.length === 0,
    errors,
    days,
  };
};

const validateRejectionInput = ({ rejectionReason }) => {
  const errors = [];

  if (!rejectionReason || typeof rejectionReason !== 'string' || !rejectionReason.trim()) {
    errors.push('A valid rejection reason is required.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

module.exports = {
  isValidDate,
  calculateLeaveDays,
  validateCreateLeaveInput,
  validateRejectionInput,
};

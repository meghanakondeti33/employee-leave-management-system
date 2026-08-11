/**
 * Validate optional year query parameter for reporting endpoints
 * @param {string|number|undefined} year 
 * @returns {Object} { isValid, year, message }
 */
const validateYearQuery = (year) => {
  if (year === undefined || year === null || year === '') {
    return { isValid: true, year: null };
  }

  const yearStr = String(year).trim();
  const isFourDigits = /^\d{4}$/.test(yearStr);
  const parsedYear = parseInt(yearStr, 10);

  if (!isFourDigits || isNaN(parsedYear) || parsedYear < 1900 || parsedYear > 2100) {
    return {
      isValid: false,
      year: null,
      message: 'Invalid year parameter. Must be a valid 4-digit year (e.g., 2026).',
    };
  }

  return {
    isValid: true,
    year: parsedYear,
  };
};

module.exports = {
  validateYearQuery,
};

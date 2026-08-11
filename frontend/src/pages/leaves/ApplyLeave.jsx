import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

export const ApplyLeave = () => {
  const navigate = useNavigate();

  const [leavePolicyId, setLeavePolicyId] = useState('1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const [formErrors, setFormErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Inclusive days calculation feedback for user
  const calculateRequestedDays = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;
    const diffTime = end.getTime() - start.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const requestedDays = calculateRequestedDays();

  const validate = () => {
    const errors = {};
    if (!leavePolicyId) errors.leavePolicyId = 'Please select a leave policy.';
    if (!startDate) errors.startDate = 'Start date is required.';
    if (!endDate) errors.endDate = 'End date is required.';
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      errors.endDate = 'End date cannot be prior to start date.';
    }
    if (!reason.trim()) errors.reason = 'Please state a reason for leave.';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    setSuccessMessage('');

    if (!validate()) return;

    setSubmitting(true);
    try {
      const response = await api.post('/leaves', {
        leavePolicyId: parseInt(leavePolicyId, 10),
        startDate,
        endDate,
        reason,
      });

      if (response && response.success) {
        setSuccessMessage('Leave request submitted successfully!');
        setTimeout(() => {
          navigate('/leaves');
        }, 1500);
      }
    } catch (err) {
      setApiError(err.message || 'Failed to submit leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container max-w-2xl">
      <div className="page-header">
        <h1>Apply for Leave</h1>
        <p>Submit a new leave request for manager review.</p>
      </div>

      <div className="card">
        {successMessage && (
          <div className="alert alert-success" role="alert">
            <span>✅ {successMessage}</span>
          </div>
        )}

        {apiError && (
          <div className="alert alert-danger" role="alert">
            <span>⚠️ {apiError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="leave-form" noValidate>
          <div className="form-group">
            <label htmlFor="leavePolicyId">Leave Policy / Type</label>
            <select
              id="leavePolicyId"
              value={leavePolicyId}
              onChange={(e) => setLeavePolicyId(e.target.value)}
              className={formErrors.leavePolicyId ? 'input-error' : ''}
              disabled={submitting}
            >
              <option value="1">Annual / Casual Leave</option>
              <option value="2">Sick Leave</option>
            </select>
            {formErrors.leavePolicyId && <span className="field-error">{formErrors.leavePolicyId}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="startDate">Start Date</label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={formErrors.startDate ? 'input-error' : ''}
                disabled={submitting}
              />
              {formErrors.startDate && <span className="field-error">{formErrors.startDate}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="endDate">End Date</label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={formErrors.endDate ? 'input-error' : ''}
                disabled={submitting}
              />
              {formErrors.endDate && <span className="field-error">{formErrors.endDate}</span>}
            </div>
          </div>

          {requestedDays > 0 && (
            <div className="form-info-box">
              <span>Duration requested: <strong>{requestedDays} Day(s)</strong></span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="reason">Reason for Request</label>
            <textarea
              id="reason"
              rows="4"
              placeholder="Provide context for your leave request..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={formErrors.reason ? 'input-error' : ''}
              disabled={submitting}
            />
            {formErrors.reason && <span className="field-error">{formErrors.reason}</span>}
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate('/leaves')} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

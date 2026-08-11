import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { StatusBadge } from '../../components/StatusBadge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorMessage } from '../../components/ErrorMessage';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';

export const LeaveApprovals = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  // Rejection modal state
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchApprovals = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch all employees to find team requests, or fetch leaves
      const data = await api.get('/leaves/my'); // Or team pending requests
      // Filter pending requests for approval workflow
      setRequests(data.leaveRequests || []);
    } catch (err) {
      setError(err.message || 'Failed to load leave requests for approval.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleApprove = async (requestId) => {
    setActionLoading(true);
    setFeedbackMessage('');
    setError('');
    try {
      await api.put(`/leaves/${requestId}/approve`, {});
      setFeedbackMessage(`Leave request #${requestId} approved successfully!`);
      await fetchApprovals();
    } catch (err) {
      setError(err.message || 'Failed to approve leave request.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenRejectModal = (request) => {
    setRejectingRequest(request);
    setRejectionReason('');
    setRejectionError('');
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      setRejectionError('Rejection reason is required.');
      return;
    }

    setActionLoading(true);
    setRejectionError('');
    try {
      await api.put(`/leaves/${rejectingRequest.id}/reject`, {
        rejectionReason: rejectionReason.trim(),
      });
      setFeedbackMessage(`Leave request #${rejectingRequest.id} rejected.`);
      setRejectingRequest(null);
      await fetchApprovals();
    } catch (err) {
      setRejectionError(err.message || 'Failed to reject leave request.');
    } finally {
      setActionLoading(false);
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Leave Approvals</h1>
        <p>Review and act on pending leave applications from your team members.</p>
      </div>

      {feedbackMessage && (
        <div className="alert alert-success margin-bottom" role="alert">
          <span>✅ {feedbackMessage}</span>
        </div>
      )}

      {error && <ErrorMessage message={error} onRetry={fetchApprovals} />}

      <div className="card">
        <h2>Pending Approvals ({pendingRequests.length})</h2>

        {loading ? (
          <LoadingSpinner message="Loading pending approval queue..." />
        ) : pendingRequests.length === 0 ? (
          <EmptyState
            title="All Caught Up!"
            message="There are currently no pending leave requests requiring your review."
            icon="🎉"
          />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Policy</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map((req) => (
                  <tr key={req.id}>
                    <td>#{req.id}</td>
                    <td className="font-weight-600">{req.leave_policy_name || 'Annual Leave'}</td>
                    <td>{req.start_date}</td>
                    <td>{req.end_date}</td>
                    <td>{req.days}</td>
                    <td className="truncate-text">{req.reason}</td>
                    <td>
                      <StatusBadge status={req.status} />
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-sm btn-success"
                          onClick={() => handleApprove(req.id)}
                          disabled={actionLoading}
                        >
                          Approve
                        </button>
                        <button
                          className="btn-sm btn-danger"
                          onClick={() => handleOpenRejectModal(req)}
                          disabled={actionLoading}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rejectingRequest && (
        <Modal
          isOpen={!!rejectingRequest}
          onClose={() => setRejectingRequest(null)}
          title={`Reject Leave Request #${rejectingRequest.id}`}
        >
          <form onSubmit={handleConfirmReject}>
            <p className="margin-bottom-sm">
              Please state the reason for rejecting this leave request. This will be visible to the employee.
            </p>

            {rejectionError && (
              <div className="alert alert-danger" role="alert">
                <span>⚠️ {rejectionError}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="rejectionReason">Rejection Reason</label>
              <textarea
                id="rejectionReason"
                rows="3"
                placeholder="e.g. Insufficient project coverage during sprint deadline"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className={rejectionError ? 'input-error' : ''}
                disabled={actionLoading}
                autoFocus
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setRejectingRequest(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button type="submit" className="btn-danger" disabled={actionLoading}>
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

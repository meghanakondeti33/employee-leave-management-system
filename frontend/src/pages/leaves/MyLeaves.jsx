import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { StatusBadge } from '../../components/StatusBadge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorMessage } from '../../components/ErrorMessage';
import { EmptyState } from '../../components/EmptyState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LeaveDetailsModal } from './LeaveDetailsModal';

export const MyLeaves = () => {
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [cancelRequestId, setCancelRequestId] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  const fetchMyLeaves = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/leaves/my');
      setRequests(data.leaveRequests || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch leave requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyLeaves();
  }, []);

  const handleCancelRequest = async () => {
    if (!cancelRequestId) return;
    setCancelling(true);
    try {
      await api.delete(`/leaves/${cancelRequestId}`);
      setActionSuccess('Leave request cancelled successfully.');
      setCancelRequestId(null);
      await fetchMyLeaves();
    } catch (err) {
      setError(err.message || 'Failed to cancel leave request.');
    } finally {
      setCancelling(false);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  return (
    <div className="page-container">
      <div className="page-header-row">
        <div>
          <h1>My Leave Requests</h1>
          <p>Track status and submission history of your leave applications.</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/apply-leave')}>
          ➕ New Leave Request
        </button>
      </div>

      {actionSuccess && (
        <div className="alert alert-success margin-bottom" role="alert">
          <span>✅ {actionSuccess}</span>
        </div>
      )}

      {error && <ErrorMessage message={error} onRetry={fetchMyLeaves} />}

      <div className="card">
        <div className="filter-bar">
          <label htmlFor="statusFilter">Filter by Status:</label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select-input"
          >
            <option value="all">All Statuses ({requests.length})</option>
            <option value="pending">Pending ({requests.filter((r) => r.status === 'pending').length})</option>
            <option value="approved">Approved ({requests.filter((r) => r.status === 'approved').length})</option>
            <option value="rejected">Rejected ({requests.filter((r) => r.status === 'rejected').length})</option>
            <option value="cancelled">Cancelled ({requests.filter((r) => r.status === 'cancelled').length})</option>
          </select>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading leave applications..." />
        ) : filteredRequests.length === 0 ? (
          <EmptyState
            title="No Leave Requests Found"
            message={
              statusFilter === 'all'
                ? "You haven't submitted any leave requests yet."
                : `No leave requests match status '${statusFilter}'.`
            }
          />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Policy</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Days</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => (
                  <tr key={req.id}>
                    <td className="font-weight-600">{req.leave_policy_name || 'Annual Leave'}</td>
                    <td>{req.start_date}</td>
                    <td>{req.end_date}</td>
                    <td>{req.days}</td>
                    <td>
                      <StatusBadge status={req.status} />
                    </td>
                    <td>{new Date(req.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-sm btn-secondary" onClick={() => setSelectedRequest(req)}>
                          Details
                        </button>
                        {req.status === 'pending' && (
                          <button
                            className="btn-sm btn-danger-outline"
                            onClick={() => setCancelRequestId(req.id)}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedRequest && (
        <LeaveDetailsModal
          isOpen={!!selectedRequest}
          onClose={() => setSelectedRequest(null)}
          request={selectedRequest}
        />
      )}

      {cancelRequestId && (
        <ConfirmDialog
          isOpen={!!cancelRequestId}
          onClose={() => setCancelRequestId(null)}
          onConfirm={handleCancelRequest}
          title="Cancel Leave Request"
          message="Are you sure you want to cancel this pending leave request? This action cannot be undone."
          confirmText="Yes, Cancel Request"
          isDanger={true}
          isLoading={cancelling}
        />
      )}
    </div>
  );
};

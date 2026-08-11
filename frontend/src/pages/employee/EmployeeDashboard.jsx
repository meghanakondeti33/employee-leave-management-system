import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorMessage } from '../../components/ErrorMessage';
import { LeaveDetailsModal } from '../leaves/LeaveDetailsModal';

export const EmployeeDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/leaves/my');
      setRequests(data.leaveRequests || []);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length;
  const totalDaysUsed = requests
    .filter((r) => r.status === 'approved')
    .reduce((sum, r) => sum + parseFloat(r.days || 0), 0);

  return (
    <div className="page-container">
      <div className="dashboard-banner">
        <div>
          <h1>Welcome, {user?.email}!</h1>
          <p className="text-secondary">Employee Workforce Portal & Leave Dashboard</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/apply-leave')}>
          ➕ Apply for Leave
        </button>
      </div>

      {loading ? (
        <LoadingSpinner message="Fetching dashboard metrics..." />
      ) : error ? (
        <ErrorMessage message={error} onRetry={fetchDashboardData} />
      ) : (
        <>
          <div className="stats-grid">
            <StatCard title="Total Applications" value={requests.length} icon="📋" color="blue" />
            <StatCard title="Pending Requests" value={pendingCount} icon="⏳" color="amber" />
            <StatCard title="Approved Leaves" value={approvedCount} icon="✅" color="emerald" />
            <StatCard title="Approved Days Used" value={`${totalDaysUsed.toFixed(1)} Days`} icon="📅" color="purple" />
          </div>

          <div className="card margin-top">
            <div className="card-header-row">
              <h2>Recent Leave Requests</h2>
              <button className="btn-link" onClick={() => navigate('/leaves')}>
                View All →
              </button>
            </div>

            {requests.length === 0 ? (
              <p className="text-muted">No leave requests submitted yet.</p>
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
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.slice(0, 5).map((req) => (
                      <tr key={req.id}>
                        <td className="font-weight-600">{req.leave_policy_name || 'Annual Leave'}</td>
                        <td>{req.start_date}</td>
                        <td>{req.end_date}</td>
                        <td>{req.days}</td>
                        <td>
                          <StatusBadge status={req.status} />
                        </td>
                        <td>
                          <button className="btn-sm btn-secondary" onClick={() => setSelectedRequest(req)}>
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {selectedRequest && (
        <LeaveDetailsModal
          isOpen={!!selectedRequest}
          onClose={() => setSelectedRequest(null)}
          request={selectedRequest}
        />
      )}
    </div>
  );
};

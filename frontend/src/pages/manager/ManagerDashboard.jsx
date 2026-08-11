import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { StatCard } from '../../components/StatCard';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorMessage } from '../../components/ErrorMessage';

export const ManagerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOverview = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/reports/overview');
      setMetrics(response.data);
    } catch (err) {
      setError(err.message || 'Failed to load manager team metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  return (
    <div className="page-container">
      <div className="dashboard-banner">
        <div>
          <h1>Manager Operations Dashboard</h1>
          <p className="text-secondary">Logged in as: <strong>{user?.email}</strong> (Manager)</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/leave-approvals')}>
          ✅ Review Leave Approvals
        </button>
      </div>

      {loading ? (
        <LoadingSpinner message="Calculating team statistics..." />
      ) : error ? (
        <ErrorMessage message={error} onRetry={fetchOverview} />
      ) : (
        <>
          <div className="stats-grid">
            <StatCard title="Team Members" value={metrics?.totalEmployees} icon="👥" color="blue" />
            <StatCard title="Pending Approvals" value={metrics?.pendingLeaveRequests} icon="⏳" color="amber" />
            <StatCard title="Approved Leaves" value={metrics?.approvedLeaveRequests} icon="✅" color="emerald" />
            <StatCard title="Rejected Requests" value={metrics?.rejectedLeaveRequests} icon="❌" color="red" />
          </div>

          <div className="card margin-top">
            <h2>Team Leave Summary</h2>
            <div className="summary-pills">
              <div className="summary-pill">
                <span className="pill-label">Total Days Used by Team:</span>
                <span className="pill-value">{metrics?.totalLeaveDaysUsed?.toFixed(1)} Days</span>
              </div>
              <div className="summary-pill">
                <span className="pill-label">Total Remaining Team Balance:</span>
                <span className="pill-value">{metrics?.totalLeaveDaysRemaining?.toFixed(1)} Days</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { StatCard } from '../../components/StatCard';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorMessage } from '../../components/ErrorMessage';

export const AdminDashboard = () => {
  const navigate = useNavigate();

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOverview = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/reports/overview');
      setOverview(response.data);
    } catch (err) {
      setError(err.message || 'Failed to load organization overview.');
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
          <h1>System Administration Dashboard</h1>
          <p className="text-secondary">Organization-Wide Leave & Workforce Management Control Center</p>
        </div>
        <div className="action-buttons">
          <button className="btn-primary" onClick={() => navigate('/employees')}>
            👥 Manage Employees
          </button>
          <button className="btn-secondary" onClick={() => navigate('/reports')}>
            📈 View Analytics
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Aggregating system overview metrics..." />
      ) : error ? (
        <ErrorMessage message={error} onRetry={fetchOverview} />
      ) : (
        <>
          <div className="stats-grid">
            <StatCard title="Total Employees" value={overview?.totalEmployees} icon="👥" color="blue" />
            <StatCard title="Departments" value={overview?.totalDepartments} icon="🏢" color="purple" />
            <StatCard title="Pending Requests" value={overview?.pendingLeaveRequests} icon="⏳" color="amber" />
            <StatCard title="Approved Requests" value={overview?.approvedLeaveRequests} icon="✅" color="emerald" />
            <StatCard title="Rejected Requests" value={overview?.rejectedLeaveRequests} icon="❌" color="red" />
            <StatCard
              title="Total Days Consumed"
              value={`${overview?.totalLeaveDaysUsed?.toFixed(1)} Days`}
              icon="📅"
              color="indigo"
            />
            <StatCard
              title="Total Days Remaining"
              value={`${overview?.totalLeaveDaysRemaining?.toFixed(1)} Days`}
              icon="💼"
              color="teal"
            />
          </div>
        </>
      )}
    </div>
  );
};

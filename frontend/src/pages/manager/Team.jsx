import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorMessage } from '../../components/ErrorMessage';
import { EmptyState } from '../../components/EmptyState';

export const Team = () => {
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTeam = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/employees');
      setTeamMembers(data.employees || []);
    } catch (err) {
      setError(err.message || 'Failed to load team members.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>My Team Directory</h1>
        <p>Overview of direct reports and team members under your management.</p>
      </div>

      {error && <ErrorMessage message={error} onRetry={fetchTeam} />}

      <div className="card">
        <h2>Team Members ({teamMembers.length})</h2>

        {loading ? (
          <LoadingSpinner message="Loading team directory..." />
        ) : teamMembers.length === 0 ? (
          <EmptyState title="No Team Members Found" message="You currently have no direct reports assigned." icon="👥" />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Joining Date</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {teamMembers.map((emp) => (
                  <tr key={emp.id}>
                    <td className="font-mono">{emp.employee_code}</td>
                    <td className="font-weight-600">
                      {emp.first_name} {emp.last_name}
                    </td>
                    <td>{emp.email}</td>
                    <td>{emp.department_name}</td>
                    <td>{emp.joining_date}</td>
                    <td>
                      <span className={`role-tag role-${emp.role}`}>{emp.role}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

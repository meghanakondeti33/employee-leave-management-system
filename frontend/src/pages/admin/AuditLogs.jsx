import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorMessage } from '../../components/ErrorMessage';
import { EmptyState } from '../../components/EmptyState';

export const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAuditLogs = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pagination.limit),
      });

      if (actionFilter) params.append('action', actionFilter);
      if (entityTypeFilter) params.append('entityType', entityTypeFilter);

      const response = await api.get(`/audit-logs?${params.toString()}`);
      setLogs(response.data || []);
      setPagination(response.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Failed to load security audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs(1);
  }, [actionFilter, entityTypeFilter]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchAuditLogs(newPage);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Security & Activity Audit Logs</h1>
        <p>Centralized security trail tracking system logins, employee edits, and leave lifecycle decisions.</p>
      </div>

      {error && <ErrorMessage message={error} onRetry={() => fetchAuditLogs(pagination.page)} />}

      <div className="card">
        <div className="filter-row margin-bottom">
          <div className="form-group inline-group">
            <label htmlFor="actionFilter">Filter by Action:</label>
            <select
              id="actionFilter"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="select-input"
            >
              <option value="">All Actions</option>
              <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
              <option value="LOGIN_FAILED">LOGIN_FAILED</option>
              <option value="EMPLOYEE_CREATED">EMPLOYEE_CREATED</option>
              <option value="EMPLOYEE_UPDATED">EMPLOYEE_UPDATED</option>
              <option value="EMPLOYEE_DELETED">EMPLOYEE_DELETED</option>
              <option value="LEAVE_REQUESTED">LEAVE_REQUESTED</option>
              <option value="LEAVE_APPROVED">LEAVE_APPROVED</option>
              <option value="LEAVE_REJECTED">LEAVE_REJECTED</option>
              <option value="LEAVE_CANCELLED">LEAVE_CANCELLED</option>
            </select>
          </div>

          <div className="form-group inline-group">
            <label htmlFor="entityTypeFilter">Filter by Entity:</label>
            <select
              id="entityTypeFilter"
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="select-input"
            >
              <option value="">All Entities</option>
              <option value="user">user</option>
              <option value="employee">employee</option>
              <option value="leave_request">leave_request</option>
            </select>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading audit trail..." />
        ) : logs.length === 0 ? (
          <EmptyState title="No Audit Logs Found" message="No activity records match the selected filters." icon="🛡️" />
        ) : (
          <>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User ID</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Entity ID</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="font-mono text-sm">{new Date(log.createdAt).toLocaleString()}</td>
                      <td>User #{log.userId}</td>
                      <td>
                        <span className="action-tag">{log.action}</span>
                      </td>
                      <td className="text-secondary">{log.entityType}</td>
                      <td>{log.entityId ? `#${log.entityId}` : '-'}</td>
                      <td>{log.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="pagination-bar">
              <span className="pagination-info">
                Showing Page {pagination.page} of {pagination.totalPages} ({pagination.total} Total Entries)
              </span>
              <div className="action-buttons">
                <button
                  className="btn-sm btn-secondary"
                  disabled={pagination.page <= 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  ← Previous
                </button>
                <button
                  className="btn-sm btn-secondary"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

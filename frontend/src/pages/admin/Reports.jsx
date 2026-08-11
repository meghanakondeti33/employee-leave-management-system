import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorMessage } from '../../components/ErrorMessage';

export const Reports = () => {
  const [summary, setSummary] = useState(null);
  const [deptSummary, setDeptSummary] = useState([]);
  const [trends, setTrends] = useState([]);
  const [selectedYear, setSelectedYear] = useState('2026');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    try {
      const [sumRes, deptRes, trendRes] = await Promise.all([
        api.get(`/reports/leave-summary?year=${selectedYear}`),
        api.get('/reports/department-summary'),
        api.get(`/reports/leave-trends?year=${selectedYear}`),
      ]);

      setSummary(sumRes.summary);
      setDeptSummary(deptRes.data || []);
      setTrends(trendRes.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [selectedYear]);

  const totalStatusRequests = summary
    ? summary.pending + summary.approved + summary.rejected + summary.cancelled
    : 0;

  return (
    <div className="page-container">
      <div className="page-header-row">
        <div>
          <h1>Reports & Analytics</h1>
          <p>Workforce leave distribution, department statistics, and seasonal trends.</p>
        </div>
        <div className="filter-group">
          <label htmlFor="yearSelect">Report Year:</label>
          <select
            id="yearSelect"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="select-input"
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Aggregating reporting datasets..." />
      ) : error ? (
        <ErrorMessage message={error} onRetry={fetchReports} />
      ) : (
        <>
          {/* Status Distribution */}
          <div className="card">
            <h2>Leave Application Status Distribution ({selectedYear})</h2>
            <div className="distribution-grid margin-top-sm">
              <div className="dist-card dist-pending">
                <span className="dist-label">Pending Review</span>
                <span className="dist-count">{summary?.pending}</span>
                <span className="dist-percentage">
                  {totalStatusRequests ? ((summary.pending / totalStatusRequests) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="dist-card dist-approved">
                <span className="dist-label">Approved</span>
                <span className="dist-count">{summary?.approved}</span>
                <span className="dist-percentage">
                  {totalStatusRequests ? ((summary.approved / totalStatusRequests) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="dist-card dist-rejected">
                <span className="dist-label">Rejected</span>
                <span className="dist-count">{summary?.rejected}</span>
                <span className="dist-percentage">
                  {totalStatusRequests ? ((summary.rejected / totalStatusRequests) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="dist-card dist-cancelled">
                <span className="dist-label">Cancelled</span>
                <span className="dist-count">{summary?.cancelled}</span>
                <span className="dist-percentage">
                  {totalStatusRequests ? ((summary.cancelled / totalStatusRequests) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Department Leave Summary */}
          <div className="card margin-top">
            <h2>Department Leave Summary</h2>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Department ID</th>
                    <th>Department Name</th>
                    <th>Headcount</th>
                    <th>Total Requests</th>
                    <th>Approved Leave Days Consumed</th>
                  </tr>
                </thead>
                <tbody>
                  {deptSummary.map((dept) => (
                    <tr key={dept.departmentId}>
                      <td>#{dept.departmentId}</td>
                      <td className="font-weight-600">{dept.departmentName}</td>
                      <td>{dept.employeeCount} Employees</td>
                      <td>{dept.leaveRequests} Requests</td>
                      <td className="font-weight-600">{dept.approvedLeaveDays.toFixed(1)} Days</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Monthly Leave Trends */}
          <div className="card margin-top">
            <h2>Monthly Consumed Leave Trends ({selectedYear})</h2>
            {trends.length === 0 ? (
              <p className="text-muted margin-top-sm">No approved leave records found for year {selectedYear}.</p>
            ) : (
              <div className="trends-bar-container margin-top">
                {trends.map((t) => (
                  <div key={t.month} className="trend-bar-row">
                    <span className="trend-month">{t.month}</span>
                    <div className="trend-bar-wrapper">
                      <div
                        className="trend-bar-fill"
                        style={{ width: `${Math.min(100, (t.leaveDays / 20) * 100)}%` }}
                      ></div>
                    </div>
                    <span className="trend-value">{t.leaveDays.toFixed(1)} Days</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

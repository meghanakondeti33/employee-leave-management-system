import React from 'react';
import { useAuth } from '../context/AuthContext';

export const Reports = () => {
  const { user } = useAuth();

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Reports & Analytics</h1>
        <p>Workforce leave statistics, department summaries, and leave usage trends.</p>
      </div>

      <div className="card">
        <h2>Analytics Overview</h2>
        <p className="text-muted">
          Reporting module for <strong>{user?.role?.toUpperCase()}</strong> role. Full visual charts and filters will be activated in Phase 10.
        </p>
      </div>
    </div>
  );
};

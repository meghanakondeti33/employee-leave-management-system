import React from 'react';
import { useAuth } from '../context/AuthContext';

export const AuditLogs = () => {
  const { user } = useAuth();

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Audit & Activity Logs</h1>
        <p>Centralized security audit log trail of employee and leave actions.</p>
      </div>

      <div className="card">
        <h2>Security Audit Logs</h2>
        <p className="text-muted">
          Admin audit view for <strong>{user?.role?.toUpperCase()}</strong> role. Interactive audit log table will be activated in Phase 10.
        </p>
      </div>
    </div>
  );
};

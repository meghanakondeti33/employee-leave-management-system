import React from 'react';
import { useAuth } from '../context/AuthContext';

export const Leaves = () => {
  const { user } = useAuth();
  const title = user?.role === 'employee' ? 'My Leave Requests' : (user?.role === 'manager' ? 'Leave Approvals' : 'Leave Management');

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>{title}</h1>
        <p>Leave application submission, status tracking, and approval management.</p>
      </div>

      <div className="card">
        <h2>{title} Panel</h2>
        <p className="text-muted">
          Active workflow interface for <strong>{user?.role?.toUpperCase()}</strong> role. Full forms and workflow controls will be activated in Phase 10.
        </p>
      </div>
    </div>
  );
};

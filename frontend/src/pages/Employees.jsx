import React from 'react';
import { useAuth } from '../context/AuthContext';

export const Employees = () => {
  const { user } = useAuth();
  const title = user?.role === 'manager' ? 'Team Directory' : 'Employee Directory';

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>{title}</h1>
        <p>Manage workforce profiles and reporting hierarchy.</p>
      </div>

      <div className="card">
        <h2>{title} Overview</h2>
        <p className="text-muted">
          Employee management controls for <strong>{user?.role?.toUpperCase()}</strong> role. Full interactive table controls will be activated in Phase 10.
        </p>
      </div>
    </div>
  );
};

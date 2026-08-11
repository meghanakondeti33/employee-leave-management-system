import React from 'react';
import { useAuth } from '../context/AuthContext';

export const Dashboard = () => {
  const { user } = useAuth();

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome back, <strong>{user?.email}</strong>!</p>
      </div>

      <div className="card">
        <h2>Role Status</h2>
        <p>
          Authenticated Role: <span className={`role-tag role-${user?.role}`}>{user?.role?.toUpperCase()}</span>
        </p>
        <p className="text-muted">
          Your navigation menu has been populated with tools authorized for your role profile.
        </p>
      </div>
    </div>
  );
};

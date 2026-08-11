import React from 'react';
import { Link } from 'react-router-dom';

export const NotFound = () => {
  return (
    <div className="page-container flex-center">
      <div className="card text-center max-w-md">
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p className="text-muted">The requested page does not exist or has been moved.</p>
        <Link to="/dashboard" className="btn-primary inline-block margin-top">
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
};

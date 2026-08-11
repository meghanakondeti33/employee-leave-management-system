import React from 'react';

export const ErrorMessage = ({ message = 'Failed to load data.', onRetry }) => {
  return (
    <div className="alert alert-danger error-component" role="alert">
      <span className="alert-icon">⚠️</span>
      <div className="error-content">
        <span>{message}</span>
        {onRetry && (
          <button className="btn-retry" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

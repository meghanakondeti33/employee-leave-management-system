import React from 'react';

export const LoadingSpinner = ({ message = 'Loading data...' }) => {
  return (
    <div className="component-loader">
      <div className="spinner"></div>
      <p>{message}</p>
    </div>
  );
};

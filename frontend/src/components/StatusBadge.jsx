import React from 'react';

export const StatusBadge = ({ status }) => {
  const normalizedStatus = (status || 'pending').toLowerCase();
  
  const labelMap = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  };

  return (
    <span className={`status-badge status-${normalizedStatus}`}>
      <span className="status-badge-dot"></span>
      {labelMap[normalizedStatus] || normalizedStatus}
    </span>
  );
};

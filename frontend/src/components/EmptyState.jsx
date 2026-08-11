import React from 'react';

export const EmptyState = ({ title = 'No records found', message = 'There are no items to display at this time.', icon = '📭', action }) => {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h3 className="empty-title">{title}</h3>
      <p className="empty-message">{message}</p>
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
};

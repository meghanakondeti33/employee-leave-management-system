import React from 'react';

export const StatCard = ({ title, value, icon, color = 'blue', description }) => {
  return (
    <div className={`stat-card stat-color-${color}`}>
      <div className="stat-header">
        <span className="stat-title">{title}</span>
        {icon && <span className="stat-icon">{icon}</span>}
      </div>
      <div className="stat-value">{value !== undefined && value !== null ? value : '-'}</div>
      {description && <div className="stat-description">{description}</div>}
    </div>
  );
};

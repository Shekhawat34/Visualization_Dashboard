import React from 'react';

const CardContainer = ({ title, children, className = '', actionButtons = null }) => {
  return (
    <div className={`card ${className}`}>
      <div className="card-header">
        <h3 className="card-title">{title}</h3>
        {actionButtons && <div className="card-actions">{actionButtons}</div>}
      </div>
      <div className="card-body">
        {children}
      </div>
    </div>
  );
};

export default CardContainer;
import React from 'react';

const NoDataMessage = ({ message = 'No data available', icon = '📊' }) => {
  return (
    <div className="no-data-message">
      <div className="no-data-icon">{icon}</div>
      <div className="no-data-text">{message}</div>
    </div>
  );
};

export default NoDataMessage;
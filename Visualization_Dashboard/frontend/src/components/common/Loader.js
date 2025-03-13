import React from 'react';

const Loader = ({ message = 'Loading...' }) => {
  return (
    <div className="loader">
      <div className="loader-spinner"></div>
      <div className="loader-message" style={{ marginLeft: '10px' }}>{message}</div>
    </div>
  );
};

export default Loader;
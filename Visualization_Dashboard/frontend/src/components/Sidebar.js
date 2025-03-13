import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/Sidebar.css';

const Sidebar = ({ isOpen, toggleSidebar, filterOptions, activeFilters, onFilterChange }) => {
  const location = useLocation();

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h1 className="sidebar-title">Insights Dashboard</h1>
        <p className="sidebar-subtitle">Global Trend Analysis</p>
      </div>

      <div className="sidebar-content">
        <nav>
          <ul className="nav-menu">
            <li className="nav-item">
              <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
                <span className="nav-icon">📊</span>
                <span>Dashboard</span>
              </Link>
            </li>
            
          </ul>
        </nav>

     
      </div>

      <div className="sidebar-footer">
        <p>Data Insights Platform v1.0</p>
      </div>
    </aside>
  );
};

export default Sidebar;

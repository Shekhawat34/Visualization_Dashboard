import React, { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/FilterPanel.css';

const FilterPanel = ({ onFilterChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    end_year: [],
    topics: [],
    sectors: [],
    regions: [],
    pestle: [],
    sources: [],
    countries: [],
    cities: []
  });
  
  const [selectedFilters, setSelectedFilters] = useState({
    end_year: 'all',
    topic: 'all',
    sector: 'all',
    region: 'all',
    pestle: 'all',
    source: 'all',
    swot: 'all',
    country: 'all',
    city: 'all'
  });
  
  const [isLoading, setIsLoading] = useState(true);

  // Fetch filter options from API
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        setIsLoading(true);
        const data = await api.getFilters();
        setFilterOptions(data);
      } catch (error) {
        console.error('Error fetching filter options:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFilterOptions();
  }, []);

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    
    setSelectedFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Apply filters
  const handleApplyFilters = () => {
    onFilterChange(selectedFilters);
  };

  // Reset all filters
  const handleResetFilters = () => {
    const resetFilters = {
      end_year: 'all',
      topic: 'all',
      sector: 'all',
      region: 'all',
      pestle: 'all',
      source: 'all',
      swot: 'all',
      country: 'all',
      city: 'all'
    };
    
    setSelectedFilters(resetFilters);
    onFilterChange(resetFilters);
  };

  // Toggle panel collapse
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`filter-panel ${isCollapsed ? 'filter-panel-collapsed' : ''}`}>
      <div className="filter-panel-header">
        <h3 className="filter-panel-title">Filters</h3>
        <button 
          className="filter-panel-toggle" 
          onClick={toggleCollapse}
        >
          {isCollapsed ? '▼' : '▲'}
        </button>
      </div>
      
      {isLoading ? (
        <div className="loader">
          <div className="loader-spinner"></div>
          <div style={{ marginLeft: '10px' }}>Loading filters...</div>
        </div>
      ) : (
        <div className="filter-form">
          {/* Year Filter */}
          <div className="filter-group">
            <label className="filter-label" htmlFor="end_year">Year</label>
            <select 
              id="end_year" 
              name="end_year"
              className="filter-select"
              value={selectedFilters.end_year}
              onChange={handleFilterChange}
            >
              <option value="all">All Years</option>
              {filterOptions.end_year && filterOptions.end_year.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          
          {/* Topic Filter */}
          <div className="filter-group">
            <label className="filter-label" htmlFor="topic">Topic</label>
            <select 
              id="topic" 
              name="topic"
              className="filter-select"
              value={selectedFilters.topic}
              onChange={handleFilterChange}
            >
              <option value="all">All Topics</option>
              {filterOptions.topics && filterOptions.topics.map(topic => (
                <option key={topic} value={topic}>{topic}</option>
              ))}
            </select>
          </div>
          
          {/* Sector Filter */}
          <div className="filter-group">
            <label className="filter-label" htmlFor="sector">Sector</label>
            <select 
              id="sector" 
              name="sector"
              className="filter-select"
              value={selectedFilters.sector}
              onChange={handleFilterChange}
            >
              <option value="all">All Sectors</option>
              {filterOptions.sectors && filterOptions.sectors.map(sector => (
                <option key={sector} value={sector}>{sector}</option>
              ))}
            </select>
          </div>
          
          {/* Region Filter */}
          <div className="filter-group">
            <label className="filter-label" htmlFor="region">Region</label>
            <select 
              id="region" 
              name="region"
              className="filter-select"
              value={selectedFilters.region}
              onChange={handleFilterChange}
            >
              <option value="all">All Regions</option>
              {filterOptions.regions && filterOptions.regions.map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>
          
          {/* PESTLE Filter */}
          <div className="filter-group">
            <label className="filter-label" htmlFor="pestle">PESTLE</label>
            <select 
              id="pestle" 
              name="pestle"
              className="filter-select"
              value={selectedFilters.pestle}
              onChange={handleFilterChange}
            >
              <option value="all">All PESTLE</option>
              {filterOptions.pestle && filterOptions.pestle.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          
          {/* Source Filter */}
          <div className="filter-group">
            <label className="filter-label" htmlFor="source">Source</label>
            <select 
              id="source" 
              name="source"
              className="filter-select"
              value={selectedFilters.source}
              onChange={handleFilterChange}
            >
              <option value="all">All Sources</option>
              {filterOptions.sources && filterOptions.sources.map(source => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </div>
          
          {/* Country Filter */}
          <div className="filter-group">
            <label className="filter-label" htmlFor="country">Country</label>
            <select 
              id="country" 
              name="country"
              className="filter-select"
              value={selectedFilters.country}
              onChange={handleFilterChange}
            >
              <option value="all">All Countries</option>
              {filterOptions.countries && filterOptions.countries.map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>
          
          {/* Filter Actions */}
          <div className="filter-actions">
            <button 
              className="btn filter-reset" 
              onClick={handleResetFilters}
            >
              Reset
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleApplyFilters}
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterPanel;
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import api from '../../services/api';
import CardContainer from '../common/CardContainer';
import Loader from '../common/Loader';
import NoDataMessage from '../common/NoDataMessage';
import { createTooltip, formatNumber } from '../../utils/helpers';

const RegionChart = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metric, setMetric] = useState('count'); // 'count', 'intensity', 'likelihood', 'relevance'
  const [filteredData, setFilteredData] = useState(null);
  const [regionFilter, setRegionFilter] = useState(''); // Filter by region
  const [sourceFilter, setSourceFilter] = useState(''); // Filter by source
  const [regions, setRegions] = useState([]); // Available regions for filtering
  const [sources, setSources] = useState([]); // Available sources for filtering
  const [selectedRegionInfo, setSelectedRegionInfo] = useState(null); // To display sources and topics
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  
  // Fetch regions and sources for filter dropdowns
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const filtersData = await api.getFilters();
        setRegions(filtersData.regions || []);
        setSources(filtersData.sources || []);
      } catch (err) {
        console.error('Error fetching filter options:', err);
      }
    };
    
    fetchFilters();
  }, []);
  
  // Fetch region data based on filters
  useEffect(() => {
    const fetchRegionData = async () => {
      try {
        setLoading(true);
        
        // Build filter object
        const filters = {};
        if (regionFilter) filters.region = regionFilter;
        if (sourceFilter) filters.source = sourceFilter;
        
        const regionData = await api.getRegions(filters);
        setData(regionData);
        
        // Set filtered data
        if (regionFilter) {
          // Find the selected region data to display sources and topics
          const selectedRegion = regionData.find(r => r.region === regionFilter);
          if (selectedRegion) {
            setSelectedRegionInfo(selectedRegion);
          }
          setFilteredData(regionData.filter(d => d.region === regionFilter));
        } else {
          setFilteredData(regionData);
          setSelectedRegionInfo(null);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching region data:', err);
        setError('Failed to load region data');
        setLoading(false);
      }
    };
    
    fetchRegionData();
  }, [regionFilter, sourceFilter]);
  
  useEffect(() => {
    if (filteredData && filteredData.length > 0 && !loading) {
      renderChart();
    }
  }, [filteredData, loading, metric]);
  
  useEffect(() => {
    // Add resize listener
    const handleResize = () => {
      if (filteredData && filteredData.length > 0 && !loading) {
        renderChart();
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [filteredData, loading, metric]);
  
  const renderChart = () => {
    if (!svgRef.current || !containerRef.current) return;
    
    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();
    
    // Set dimensions
    const containerWidth = containerRef.current.clientWidth;
    const margin = { top: 30, right: 20, bottom: 80, left: 60 };
    const width = containerWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;
    
    // Process and sort data
    const processedData = [...filteredData]
      .filter(d => d.region && d.region !== 'Unknown' && d[metric] > 0)
      .sort((a, b) => b[metric] - a[metric]);
    
    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Create tooltip
    const tooltip = createTooltip(d3);
    
    // Create scales
    const x = d3.scaleBand()
      .domain(processedData.map(d => d.region))
      .range([0, width])
      .padding(0.3);
    
    const y = d3.scaleLinear()
      .domain([0, d3.max(processedData, d => d[metric]) * 1.1])
      .nice()
      .range([height, 0]);
    
    // Create gradient for bars
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'region-bar-gradient')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0)
      .attr('y1', height)
      .attr('x2', 0)
      .attr('y2', 0);
    
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#3182bd');
    
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#6baed6');
    
    // Add X axis without labels (they will show only on hover)
    const xAxis = svg.append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickSize(0).tickFormat(''));
    
    // Add only a single line for X axis
    xAxis.select('.domain').attr('stroke', '#ccc');
    
    // Add Y axis with only min and max values
    const yAxisValues = [0, d3.max(processedData, d => d[metric])];
    const yAxis = svg.append('g')
      .attr('class', 'axis y-axis')
      .call(d3.axisLeft(y)
        .tickValues(yAxisValues)
        .tickFormat(d => formatNumber(d)));
    
    // Add Y axis label
    svg.append('text')
      .attr('class', 'axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 15)
      .attr('x', -height / 2)
      .attr('dy', '1em')
      .attr('text-anchor', 'middle')
      .text(metric === 'count' ? 'Number of Events' : metric.charAt(0).toUpperCase() + metric.slice(1));
    
    // Create horizontal bars with rounded corners
    const bars = svg.selectAll('.bar')
      .data(processedData)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.region))
      .attr('width', x.bandwidth())
      .attr('y', height)
      .attr('height', 0)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', 'url(#region-bar-gradient)')
      .on('mouseover', function(event, d) {
        // Highlight bar
        d3.select(this)
          .transition()
          .duration(300)
          .attr('opacity', 0.8)
          .attr('stroke', '#2c3e50')
          .attr('stroke-width', 2);
        
        // Show tooltip with region name, value, and sources/topics
        tooltip.transition()
          .duration(200)
          .style('opacity', 0.9);
        
        let tooltipContent = `
          <strong>${d.region}</strong><br/>
          ${metric === 'count' ? 'Count' : metric.charAt(0).toUpperCase() + metric.slice(1)}: ${formatNumber(d[metric])}
        `;
        
      
        
        tooltip.html(tooltipContent)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
        
        // Show region name temporarily below the bar
        svg.append('text')
          .attr('class', 'temp-region-label')
          .attr('x', x(d.region) + x.bandwidth() / 2)
          .attr('y', height + 20)
          .attr('text-anchor', 'middle')
          .attr('font-size', '12px')
          .text(d.region);
      })
      .on('mouseout', function() {
        // Restore bar appearance
        d3.select(this)
          .transition()
          .duration(300)
          .attr('opacity', 1)
          .attr('stroke', 'none');
        
        // Hide tooltip
        tooltip.transition()
          .duration(500)
          .style('opacity', 0);
        
        // Remove temporary region label
        svg.selectAll('.temp-region-label').remove();
      })
      .on('click', function(event, d) {
        // Show region name temporarily below the bar (persists until another bar is clicked)
        svg.selectAll('.clicked-region-label').remove();
        
        svg.append('text')
          .attr('class', 'clicked-region-label')
          .attr('x', x(d.region) + x.bandwidth() / 2)
          .attr('y', height + 20)
          .attr('text-anchor', 'middle')
          .attr('font-size', '12px')
          .attr('font-weight', 'bold')
          .text(d.region);
        
        // Set selected region to display info
        setSelectedRegionInfo(d);
      });
    
    // Animate bars on load
    bars.transition()
      .duration(800)
      .delay((d, i) => i * 50)
      .attr('y', d => y(d[metric]))
      .attr('height', d => height - y(d[metric]));
    
    // Add value labels on top of bars
    svg.selectAll('.bar-label')
      .data(processedData)
      .enter()
      .append('text')
      .attr('class', 'bar-label')
      .attr('x', d => x(d.region) + x.bandwidth() / 2)
      .attr('y', d => y(d[metric]) - 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('opacity', 0)
      .text(d => formatNumber(d[metric]))
      .transition()
      .duration(800)
      .delay((d, i) => 800 + i * 50)
      .attr('opacity', 1);
    
    // Display region names below chart when filtered
    if (regionFilter) {
      svg.selectAll('.region-label')
        .data(processedData)
        .enter()
        .append('text')
        .attr('class', 'region-label')
        .attr('x', d => x(d.region) + x.bandwidth() / 2)
        .attr('y', height + 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .text(d => d.region);
    }
  };
  
  const handleMetricChange = (newMetric) => {
    // Animate transition between metrics
    d3.selectAll('.bar')
      .transition()
      .duration(500)
      .attr('y', svgRef.current.clientHeight)
      .attr('height', 0)
      .on('end', () => {
        setMetric(newMetric);
      });
  };
  
  // Reset filters
  const handleReset = () => {
    setRegionFilter('');
    setSourceFilter('');
    setSelectedRegionInfo(null);
  };
  
  // Render source and topic info when a region is selected
  const renderRegionInfo = () => {
    if (!selectedRegionInfo) return null;
    
    return (
      <div className="region-details">
        <h4>Information for {selectedRegionInfo.region}</h4>
        
        {selectedRegionInfo.sources && selectedRegionInfo.sources.length > 0 && (
          <div className="info-section">
            <h5>Sources:</h5>
            <div className="tag-container">
              {selectedRegionInfo.sources.map((source, idx) => (
                <span 
                  key={`source-${idx}`} 
                  className="info-tag source-tag"
                  onClick={() => setSourceFilter(source)}
                  title={`Filter by ${source}`}
                  style={{ cursor: 'pointer' }}
                >
                  {source}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {selectedRegionInfo.topics && selectedRegionInfo.topics.length > 0 && (
          <div className="info-section">
            <h5>Topics:</h5>
            <div className="tag-container">
              {selectedRegionInfo.topics.map((topic, idx) => (
                <span key={`topic-${idx}`} className="info-tag topic-tag">{topic}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  // Generate title with active filters
  const generateChartTitle = () => {
    let title = "Region Distribution";
    const filters = [];
    
   
    
    if (filters.length > 0) {
      title += ` - ${filters.join(', ')}`;
    }
    
    return title;
  };
  
  const actionButtons = (
    <div className="chart-actions">
      <div className="filter-controls">
        <select 
          className="filter-select"
          value={regionFilter} 
          onChange={(e) => setRegionFilter(e.target.value)}
          title="Filter by Region"
        >
          <option value="">All Regions</option>
          {regions.map((region, idx) => (
            <option key={idx} value={region}>{region}</option>
          ))}
        </select>
        
        <select 
          className="filter-select"
          value={sourceFilter} 
          onChange={(e) => setSourceFilter(e.target.value)}
          title="Filter by Source"
        >
          <option value="">All Sources</option>
          {sources.map((source, idx) => (
            <option key={idx} value={source}>{source}</option>
          ))}
        </select>
        
        {(regionFilter || sourceFilter) && (
          <button className="reset-filter-btn" onClick={handleReset} title="Reset all filters">
            Reset Filters
          </button>
        )}
      </div>
      
      <button 
        className={`chart-action-btn ${metric === 'count' ? 'active' : ''}`} 
        onClick={() => handleMetricChange('count')}
        title="Event Count"
      >
        Count
      </button>
      <button 
        className={`chart-action-btn ${metric === 'intensity' ? 'active' : ''}`} 
        onClick={() => handleMetricChange('intensity')}
        title="Intensity"
      >
        Intensity
      </button>
      <button 
        className={`chart-action-btn ${metric === 'likelihood' ? 'active' : ''}`} 
        onClick={() => handleMetricChange('likelihood')}
        title="Likelihood"
      >
        Likelihood
      </button>
      <button 
        className={`chart-action-btn ${metric === 'relevance' ? 'active' : ''}`} 
        onClick={() => handleMetricChange('relevance')}
        title="Relevance"
      >
        Relevance
      </button>
      <button 
        className="refresh-btn" 
        onClick={() => {
          setLoading(true);
          const filters = {};
          if (regionFilter) filters.region = regionFilter;
          if (sourceFilter) filters.source = sourceFilter;
          
          api.getRegions(filters).then(data => {
            setData(data);
            setFilteredData(regionFilter ? data.filter(d => d.region === regionFilter) : data);
            setLoading(false);
          }).catch(err => {
            setError('Failed to reload data');
            setLoading(false);
          });
        }}
        title="Refresh data"
      >
        <span className="refresh-icon">↻</span>
      </button>
    </div>
  );
  
  // Add some CSS for the new components
  const styles = `
    <style>
      .filter-controls {
        display: flex;
        align-items: center;
        margin-right: 15px;
        flex-wrap: wrap;
        gap: 8px;
      }
      
      .filter-select {
        padding: 6px 10px;
        border-radius: 4px;
        border: 1px solid #ccc;
        min-width: 120px;
      }
      
      .reset-filter-btn {
        background-color: #f1f1f1;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 6px 10px;
        cursor: pointer;
      }
      
      .reset-filter-btn:hover {
        background-color: #e0e0e0;
      }
      
      .region-details {
        margin-top: 20px;
        padding: 15px;
        background-color: #f9f9f9;
        border-radius: 8px;
        border: 1px solid #e0e0e0;
      }
      
      .info-section {
        margin-bottom: 15px;
      }
      
      .info-section h5 {
        margin-bottom: 8px;
        color: #333;
      }
      
      .tag-container {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      
      .info-tag {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 16px;
        font-size: 12px;
        color: white;
      }
      
      .source-tag {
        background-color: #3498db;
      }
      
      .source-tag:hover {
        background-color: #2980b9;
      }
      
      .topic-tag {
        background-color: #2ecc71;
      }
      
      /* Active filter indicator */
      .active-filter-badge {
        position: relative;
        display: inline-flex;
        align-items: center;
        margin-left: 5px;
        padding: 3px 6px;
        border-radius: 10px;
        background-color: #2980b9;
        color: white;
        font-size: 10px;
      }
      
      /* Mobile responsiveness */
      @media (max-width: 768px) {
        .chart-actions {
          flex-direction: column;
          align-items: flex-start;
        }
        
        .filter-controls {
          margin-bottom: 10px;
          width: 100%;
        }
        
        .filter-select {
          flex-grow: 1;
        }
      }
    </style>
  `;
  
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: styles }} />
      <CardContainer title={generateChartTitle()} actionButtons={actionButtons}>
        {loading ? (
          <Loader message="Loading region data..." />
        ) : error ? (
          <NoDataMessage message={error} icon="⚠️" />
        ) : !filteredData || filteredData.length === 0 ? (
          <NoDataMessage message="No data available" />

        ) : (
          <>
            <div className="chart-container" ref={containerRef}>
              <svg ref={svgRef} className="region-chart"></svg>
            </div>
            {selectedRegionInfo && renderRegionInfo()}
          </>
        )}
      </CardContainer>
    </>
  );
};

export default RegionChart;
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import api from '../../services/api';
import CardContainer from '../common/CardContainer';
import Loader from '../common/Loader';
import NoDataMessage from '../common/NoDataMessage';
import { createTooltip, cleanData, formatNumber, debounce } from '../../utils/helpers';

const SectorChart = ({ fullSize = false }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metric, setMetric] = useState('intensity');
  const [sortCriteria, setSortCriteria] = useState('count');
  const [sectors, setSectors] = useState([]);
  const [selectedSector, setSelectedSector] = useState('all');
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  
  // Fetch available sectors for the filter
  useEffect(() => {
    const fetchSectorOptions = async () => {
      try {
        const filtersData = await api.getFilters();
        setSectors(['all', ...filtersData.sectors]);
      } catch (err) {
        console.error('Error fetching sector options:', err);
      }
    };
    
    fetchSectorOptions();
  }, []);
  
  useEffect(() => {
    const fetchSectorData = async () => {
      try {
        setLoading(true);
        // Create filter object based on selectedSector
        const filters = {};
        // NOTE: We're NOT filtering here because we want the /sectors endpoint
        // to return all sector aggregations, then we'll filter on the client side
        
        const sectorData = await api.getSectors(filters);
        
        // If a specific sector is selected, filter the data
        if (selectedSector !== 'all') {
          const filteredData = sectorData.filter(item => item.sector === selectedSector);
          setData(filteredData);
        } else {
          setData(sectorData);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching sector data:', err);
        setError('Failed to load sector data');
        setLoading(false);
      }
    };
    
    fetchSectorData();
  }, [selectedSector]);
  
  useEffect(() => {
    if (data && data.length > 0 && !loading) {
      renderChart();
    }
  }, [data, loading, metric, sortCriteria]);
  
  useEffect(() => {
    // Add resize listener
    const handleResize = debounce(() => {
      if (data && data.length > 0 && !loading) {
        renderChart();
      }
    }, 300);
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [data, loading, metric, sortCriteria]);
  
  const renderChart = () => {
    if (!svgRef.current || !containerRef.current) return;
    
    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();
    
    // Create tooltip if not already created
    if (!tooltipRef.current) {
      tooltipRef.current = createTooltip(d3);
    }
    
    const containerWidth = containerRef.current.clientWidth;
    // Increase bottom margin to make room for hover labels
    const margin = { top: 20, right: 30, bottom: 50, left: 70 };
    const width = containerWidth - margin.left - margin.right;
    const height = (fullSize ? 450 : 350) - margin.top - margin.bottom;
    
    // Process and sort data
    const cleanedData = cleanData(data, ['sector', 'count', 'intensity', 'likelihood', 'relevance']);
    let sortedData = [...cleanedData];
    
    if (sortCriteria === 'count') {
      sortedData.sort((a, b) => b.count - a.count);
    } else {
      sortedData.sort((a, b) => b[metric] - a[metric]);
    }
    
    // Take top 10 sectors if there are more
    const finalData = sortedData.slice(0, 10);
    const displayData = selectedSector !== 'all' 
      ? finalData.filter(d => d.sector === selectedSector)
      : finalData;
    
    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    // Create scales
    const x = d3.scaleBand()
      .domain(displayData.map(d => d.sector))
      .range([0, width])
      .padding(0.3);
    
    const y = d3.scaleLinear()
      .domain([0, d3.max(displayData, d => 
        sortCriteria === 'count' ? d.count : d[metric]
      ) * 1.1])
      .nice()
      .range([height, 0]);
    
    // Create gradient for bars
    const defs = svg.append('defs');
    
    const gradient = defs.append('linearGradient')
      .attr('id', 'sector-bar-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
      
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#4364E8')
      .attr('stop-opacity', 1);
      
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#6FB1FC')
      .attr('stop-opacity', 0.7);
    
    // Create simplified y-axis (only start and end values)
    const yAxis = svg.append('g')
      .attr('class', 'axis y-axis')
      .call(
        d3.axisLeft(y)
          .tickValues([0, d3.max(displayData, d => sortCriteria === 'count' ? d.count : d[metric])])
          .tickFormat(d => formatNumber(d))
      );
    
    // Create x-axis without visible labels
    const xAxis = svg.append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0, ${height})`)
      .call(
        d3.axisBottom(x)
          .tickSize(0)
          .tickFormat("")
      );
    
    // Add Y axis label
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 20)
      .attr('x', -height / 2)
      .attr('dy', '1em')
      .attr('text-anchor', 'middle')
      .attr('class', 'axis-label')
      .text(sortCriteria === 'count' ? 'Number of Events' : 
        `Avg. ${metric.charAt(0).toUpperCase() + metric.slice(1)}`);
    
    // Add X axis label
    svg.append('text')
      .attr('y', height + margin.bottom - 10)
      .attr('x', width / 2)
      .attr('text-anchor', 'middle')
      .attr('class', 'axis-label')
      .text('Sectors');
    
    // Create a container for the hover label
    const hoverLabel = svg.append('g')
      .attr('class', 'hover-label-container')
      .style('opacity', 0);
    
    hoverLabel.append('text')
      .attr('class', 'hover-label')
      .attr('text-anchor', 'middle')
      .attr('font-weight', 'bold')
      .attr('dy', '0.35em');
    
    // Draw bars with transition
    const bars = svg.selectAll('.bar')
      .data(displayData)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.sector))
      .attr('width', x.bandwidth())
      .attr('y', height) // Start from bottom
      .attr('height', 0) // Initial height 0 for transition
      .attr('fill', 'url(#sector-bar-gradient)')
      .attr('rx', 3) // Rounded corners
      .attr('ry', 3);
    
    // Create the animate-in transition
    bars.transition()
      .duration(800)
      .delay((d, i) => i * 50)
      .ease(d3.easeElastic.period(0.4))
      .attr('y', d => y(sortCriteria === 'count' ? d.count : d[metric]))
      .attr('height', d => height - y(sortCriteria === 'count' ? d.count : d[metric]));
    
    // Add bar value labels
    svg.selectAll('.bar-label')
      .data(displayData)
      .enter()
      .append('text')
      .attr('class', 'bar-label')
      .attr('x', d => x(d.sector) + x.bandwidth() / 2)
      .attr('y', d => y(sortCriteria === 'count' ? d.count : d[metric]) - 5)
      .attr('text-anchor', 'middle')
      .attr('opacity', 0) // Start invisible for transition
      .text(d => formatNumber(sortCriteria === 'count' ? d.count : d[metric]))
      .transition()
      .duration(800)
      .delay((d, i) => i * 50 + 400) // Slight delay after bars
      .attr('opacity', 1);
    
    // Add interactivity
    bars.on('mouseover', function(event, d) {
      // Highlight the bar
      d3.select(this)
        .transition()
        .duration(300)
        .attr('fill', '#FFA726')
        .attr('width', x.bandwidth() * 1.05)
        .attr('x', x(d.sector) - (x.bandwidth() * 0.025));
      
      // Position and show sector name on hover
      hoverLabel
        .attr('transform', `translate(${x(d.sector) + x.bandwidth() / 2}, ${height + 25})`)
        .transition()
        .duration(200)
        .style('opacity', 1);
      
      hoverLabel.select('text')
        .text(d.sector);
      
      // Show tooltip
      tooltipRef.current
        .transition()
        .duration(200)
        .style('opacity', 0.95);
      
      let tooltipContent = `
        <div class="tooltip-title">${d.sector}</div>
        <div class="tooltip-row"><span>Count:</span> <span>${formatNumber(d.count)}</span></div>
      `;
      
      if (d.intensity) {
        tooltipContent += `<div class="tooltip-row"><span>Intensity:</span> <span>${formatNumber(d.intensity)}</span></div>`;
      }
      
      if (d.likelihood) {
        tooltipContent += `<div class="tooltip-row"><span>Likelihood:</span> <span>${formatNumber(d.likelihood)}</span></div>`;
      }
      
      if (d.relevance) {
        tooltipContent += `<div class="tooltip-row"><span>Relevance:</span> <span>${formatNumber(d.relevance)}</span></div>`;
      }
      
      tooltipRef.current
        .html(tooltipContent)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseout', function() {
      // Restore bar style
      d3.select(this)
        .transition()
        .duration(300)
        .attr('fill', 'url(#sector-bar-gradient)')
        .attr('width', x.bandwidth())
        .attr('x', d => x(d.sector));
      
      // Hide hover label
      hoverLabel
        .transition()
        .duration(200)
        .style('opacity', 0);
      
      // Hide tooltip
      tooltipRef.current
        .transition()
        .duration(500)
        .style('opacity', 0);
    })
    .on('click', function(event, d) {
      // Show the sector name on click for mobile users too
      hoverLabel
        .attr('transform', `translate(${x(d.sector) + x.bandwidth() / 2}, ${height + 25})`)
        .transition()
        .duration(200)
        .style('opacity', 1);
      
      hoverLabel.select('text')
        .text(d.sector);
    });
  };
  
  const handleMetricChange = (newMetric) => {
    d3.selectAll('.bar')
      .transition()
      .duration(500)
      .attr('y', d => d3.select(svgRef.current).node().clientHeight - 100)
      .attr('height', 0)
      .on('end', () => {
        setMetric(newMetric);
        setSortCriteria(newMetric);
      });
  };
  
  const handleSortChange = (criteria) => {
    setSortCriteria(criteria);
  };
  
  const handleSectorChange = (event) => {
    setSelectedSector(event.target.value);
  };
  
  const actionButtons = (
    <div className="chart-actions">
      <div className="sector-filter">
        <select 
          value={selectedSector} 
          onChange={handleSectorChange}
          className="filter-select"
        >
          {sectors.map(sector => (
            <option key={sector} value={sector}>
              {sector === 'all' ? 'All Sectors' : sector}
            </option>
          ))}
        </select>
      </div>
      <div className="metrics-buttons">
        <button 
          className={`chart-action-btn ${metric === 'intensity' ? 'active' : ''}`}
          onClick={() => handleMetricChange('intensity')}
        >
          Intensity
        </button>
        <button 
          className={`chart-action-btn ${metric === 'likelihood' ? 'active' : ''}`}
          onClick={() => handleMetricChange('likelihood')}
        >
          Likelihood
        </button>
        <button 
          className={`chart-action-btn ${metric === 'relevance' ? 'active' : ''}`}
          onClick={() => handleMetricChange('relevance')}
        >
          Relevance
        </button>
        <button 
          className={`chart-action-btn ${sortCriteria === 'count' ? 'active' : ''}`}
          onClick={() => handleSortChange('count')}
        >
          Count
        </button>
      </div>
      <button className="refresh-btn" onClick={() => {
        setLoading(true);
        const filters = {};
        if (selectedSector !== 'all') {
          filters.sector = selectedSector;
        }
        api.getSectors(filters).then(data => {
          setData(data);
          setLoading(false);
        }).catch(err => {
          setError('Failed to reload data');
          setLoading(false);
        });
      }}>
        <span className="refresh-icon">↻</span>
      </button>
    </div>
  );
  
  // Adding CSS for the chart and filter
  const chartStyles = `
    .axis path,
    .axis line {
      stroke: #cccccc;
    }
    
    .axis text {
      fill: #666666;
    }
    
    .bar-label {
      fill: #333333;
      font-size: 12px;
    }
    
    .hover-label {
      fill: #333333;
      font-size: 14px;
    }
    
    .axis-label {
      fill: #555555;
      font-size: 13px;
    }
    
    .chart-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 15px;
    }
    
    .filter-select {
      padding: 8px 12px;
      border-radius: 4px;
      border: 1px solid #ccc;
      background-color: white;
      font-size: 14px;
      min-width: 160px;
      margin-right: 10px;
    }
    
    .sector-filter {
      display: flex;
      align-items: center;
    }

    /* Added styles for better hover labels and responsiveness */
    .chart-container {
      position: relative;
      width: 100%;
      height: 100%;
    }

    .chart-svg {
      width: 100%;
      height: 100%;
    }

    .hover-label {
      pointer-events: none;
      font-weight: bold;
    }

    @media (max-width: 768px) {
      .chart-actions {
        flex-direction: column;
        align-items: flex-start;
      }
      
      .metrics-buttons {
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
      }
      
      .chart-action-btn {
        margin-bottom: 5px;
      }
    }
  `;
  
  return (
    <CardContainer title="Sector Distribution" actionButtons={actionButtons}>
      <style>{chartStyles}</style>
      <div ref={containerRef} className="chart-container" style={{ width: '100%', height: fullSize ? '450px' : '350px' }}>
        {loading ? (
          <Loader message="Loading sector data..." />
        ) : error ? (
          <NoDataMessage message={error} icon="⚠️" />
        ) : !data || data.length === 0 ? (
          <NoDataMessage message="No sector data available" />
        ) : (
          <svg ref={svgRef} className="chart-svg"></svg>
        )}
      </div>
    </CardContainer>
  );
};

export default SectorChart;
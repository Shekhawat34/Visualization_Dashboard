import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import api from '../../services/api';
import CardContainer from '../common/CardContainer';
import Loader from '../common/Loader';
import NoDataMessage from '../common/NoDataMessage';
import { formatNumber, createTooltip } from '../../utils/helpers';

const IntensityChart = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartType, setChartType] = useState('bar'); // 'bar' or 'horizontal'
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await api.getTopN('intensity', 'country', 10);
        setData(result);
        setLoading(false);
      } catch (err) {
        setError('Failed to load intensity data');
        setLoading(false);
        console.error(err);
      }
    };
    
    fetchData();
  }, []);
  
  useEffect(() => {
    if (data.length > 0 && svgRef.current) {
      drawChart();
    }
  }, [data, chartType]);
  
  const drawChart = () => {
    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();
    
    // Chart dimensions
    const margin = chartType === 'bar' 
      ? { top: 20, right: 30, bottom: 60, left: 60 } 
      : { top: 20, right: 30, bottom: 40, left: 120 };
    const width = svgRef.current.clientWidth - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Create tooltip
    if (!tooltipRef.current) {
      tooltipRef.current = createTooltip(d3);
    }
    
    // Color scale for bars
    const colorScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value)])
      .range(['#74b9ff', '#0984e3']);
    
    if (chartType === 'bar') {
      // Vertical bar chart
      
      // Scales
      const x = d3.scaleBand()
        .domain(data.map(d => d.name))
        .range([0, width])
        .padding(0.2);
      
      const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.value) * 1.1])
        .range([height, 0]);
      
      // Background grid lines
      svg.append('g')
        .attr('class', 'grid')
        .attr('opacity', 0.1)
        .call(d3.axisLeft(y)
          .ticks(5)
          .tickSize(-width)
          .tickFormat(''));
      
      // Axes
      svg.append('g')
        .attr('class', 'axis x-axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .style('font-size', '10px');
      
      svg.append('g')
        .attr('class', 'axis y-axis')
        .call(d3.axisLeft(y).ticks(5));
      
      // Bars
      svg.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.name))
        .attr('width', x.bandwidth())
        .attr('y', d => y(d.value))
        .attr('height', 0) // Start with height 0 for animation
        .attr('fill', d => colorScale(d.value))
        .attr('rx', 2) // Rounded corners
        .attr('ry', 2)
        .transition() // Add transition for animation
        .duration(800)
        .delay((d, i) => i * 50) // Stagger the animation
        .attr('height', d => height - y(d.value));
      
      // Add interactive hover effects after transition
      svg.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar-overlay')
        .attr('x', d => x(d.name))
        .attr('width', x.bandwidth())
        .attr('y', d => y(d.value))
        .attr('height', d => height - y(d.value))
        .attr('opacity', 0) // Invisible overlay
        .on('mouseover', function(event, d) {
          // Highlight bar
          d3.select(this.parentNode)
            .selectAll('.bar')
            .filter((bar) => bar.name === d.name)
            .transition()
            .duration(300)
            .attr('fill', '#0057ff')
            .attr('opacity', 1);
          
          // Show tooltip
          tooltipRef.current.transition()
            .duration(200)
            .style('opacity', .9);
          tooltipRef.current.html(`
            <div style="background: rgba(0,0,0,0.8); color: white; padding: 10px; border-radius: 4px;">
              <strong>${d.name}</strong><br/>
              Intensity: ${formatNumber(d.value)}<br/>
              Count: ${d.count}
            </div>
          `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function(event, d) {
          // Restore bar color
          d3.select(this.parentNode)
            .selectAll('.bar')
            .filter((bar) => bar.name === d.name)
            .transition()
            .duration(300)
            .attr('fill', colorScale(d.value));
          
          // Hide tooltip
          tooltipRef.current.transition()
            .duration(500)
            .style('opacity', 0);
        });
      
      // Axes labels
      svg.append('text')
        .attr('class', 'axis-label')
        .attr('text-anchor', 'middle')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom - 10)
        .text('Country')
        .style('font-size', '12px');
      
      svg.append('text')
        .attr('class', 'axis-label')
        .attr('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -margin.left + 15)
        .text('Average Intensity')
        .style('font-size', '12px');
        
      // Add value labels on top of bars
      svg.selectAll('.bar-label')
        .data(data)
        .enter()
        .append('text')
        .attr('class', 'bar-label')
        .attr('x', d => x(d.name) + x.bandwidth() / 2)
        .attr('y', d => y(d.value) - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '9px')
        .style('opacity', 0)
        .text(d => formatNumber(d.value))
        .transition()
        .duration(800)
        .delay((d, i) => i * 50 + 400) // Start after bar animation
        .style('opacity', 1);
    } else {
      // Horizontal bar chart for better readability with many data points
      
      // Sort data for horizontal chart
      const sortedData = [...data].sort((a, b) => a.value - b.value);
      
      // Scales
      const x = d3.scaleLinear()
        .domain([0, d3.max(sortedData, d => d.value) * 1.1])
        .range([0, width]);
      
      const y = d3.scaleBand()
        .domain(sortedData.map(d => d.name))
        .range([0, height])
        .padding(0.2);
      
      // Background grid
      svg.append('g')
        .attr('class', 'grid')
        .attr('opacity', 0.1)
        .call(d3.axisBottom(x)
          .ticks(5)
          .tickSize(height)
          .tickFormat(''));
      
      // Axes
      svg.append('g')
        .attr('class', 'axis x-axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(5));
      
      svg.append('g')
        .attr('class', 'axis y-axis')
        .call(d3.axisLeft(y));
      
      // Bars
      svg.selectAll('.bar')
        .data(sortedData)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('y', d => y(d.name))
        .attr('height', y.bandwidth())
        .attr('x', 0)
        .attr('width', 0) // Start with width 0 for animation
        .attr('fill', d => colorScale(d.value))
        .attr('rx', 2) // Rounded corners
        .attr('ry', 2)
        .transition() // Add transition for animation
        .duration(800)
        .delay((d, i) => i * 50)
        .attr('width', d => x(d.value));
      
      // Add interactive hover effects after transition
      svg.selectAll('.bar-overlay')
        .data(sortedData)
        .enter()
        .append('rect')
        .attr('class', 'bar-overlay')
        .attr('y', d => y(d.name))
        .attr('height', y.bandwidth())
        .attr('x', 0)
        .attr('width', d => x(d.value))
        .attr('opacity', 0) // Invisible overlay
        .on('mouseover', function(event, d) {
          // Highlight bar
          d3.select(this.parentNode)
            .selectAll('.bar')
            .filter((bar) => bar.name === d.name)
            .transition()
            .duration(300)
            .attr('fill', '#0057ff');
          
          // Show tooltip
          tooltipRef.current.transition()
            .duration(200)
            .style('opacity', .9);
          tooltipRef.current.html(`
            <div style="background: rgba(0,0,0,0.8); color: white; padding: 10px; border-radius: 4px;">
              <strong>${d.name}</strong><br/>
              Intensity: ${formatNumber(d.value)}<br/>
              Count: ${d.count}
            </div>
          `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function(event, d) {
          // Restore bar color
          d3.select(this.parentNode)
            .selectAll('.bar')
            .filter((bar) => bar.name === d.name)
            .transition()
            .duration(300)
            .attr('fill', colorScale(d.value));
          
          // Hide tooltip
          tooltipRef.current.transition()
            .duration(500)
            .style('opacity', 0);
        });
      
      // Axes labels
      svg.append('text')
        .attr('class', 'axis-label')
        .attr('text-anchor', 'middle')
        .attr('x', width / 2)
        .attr('y', height + 30)
        .text('Average Intensity')
        .style('font-size', '12px');
      
      // Add value labels at the end of bars
      svg.selectAll('.bar-label')
        .data(sortedData)
        .enter()
        .append('text')
        .attr('class', 'bar-label')
        .attr('x', d => x(d.value) + 5)
        .attr('y', d => y(d.name) + y.bandwidth() / 2)
        .attr('dominant-baseline', 'middle')
        .style('font-size', '9px')
        .style('opacity', 0)
        .text(d => formatNumber(d.value))
        .transition()
        .duration(800)
        .delay((d, i) => i * 50 + 400) // Start after bar animation
        .style('opacity', 1);
    }
  };
  
  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      if (data.length > 0) {
        drawChart();
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      // Clean up tooltip when component unmounts
      if (tooltipRef.current) {
        d3.select('.d3-tooltip').remove();
        tooltipRef.current = null;
      }
    };
  }, [data, chartType]);
  
  const toggleChartType = () => {
    setChartType(chartType === 'bar' ? 'horizontal' : 'bar');
  };
  
  const actionButtons = (
    <div className="chart-action-buttons">
      <button className="chart-type-btn" onClick={toggleChartType} title="Toggle chart type">
        <i className={`fas fa-${chartType === 'bar' ? 'align-left' : 'bars'}`}></i>
      </button>
      <button className="refresh-btn" onClick={() => {
        setLoading(true);
        api.getTopN('intensity', 'country', 10)
          .then(result => {
            setData(result);
            setLoading(false);
          })
          .catch(err => {
            setError('Failed to refresh data');
            setLoading(false);
            console.error(err);
          });
      }}>
        <i className="fas fa-sync-alt"></i>
      </button>
    </div>
  );
  
  return (
    <CardContainer title="Top Countries by Intensity" actionButtons={actionButtons}>
      {loading ? (
        <Loader message="Loading intensity data..." />
      ) : error ? (
        <NoDataMessage message={error} icon="⚠️" />
      ) : data.length === 0 ? (
        <NoDataMessage message="No intensity data available" />
      ) : (
        <div className="chart-container">
          <svg ref={svgRef} className="chart-svg"></svg>
        </div>
      )}
    </CardContainer>
  );
};

export default IntensityChart;
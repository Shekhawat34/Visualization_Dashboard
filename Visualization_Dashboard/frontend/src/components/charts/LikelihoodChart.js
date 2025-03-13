import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import api from '../../services/api';
import CardContainer from '../common/CardContainer';
import Loader from '../common/Loader';
import NoDataMessage from '../common/NoDataMessage';
import { formatNumber, createTooltip } from '../../utils/helpers';

const LikelihoodChart = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await api.getTopN('likelihood', 'topic', 10);
        setData(result);
        setLoading(false);
      } catch (err) {
        setError('Failed to load likelihood data');
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
  }, [data]);
  
  const drawChart = () => {
    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();
    
    // Chart dimensions
    const margin = { top: 20, right: 30, bottom: 70, left: 60 };
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
    
    // Sort data by likelihood value in descending order
    data.sort((a, b) => b.value - a.value);
    
    // Scales
    const x = d3.scaleBand()
      .domain(data.map(d => d.name))
      .range([0, width])
      .padding(0.3);
    
    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value) * 1.1])
      .range([height, 0]);
    
    // Axes
    svg.append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em');
    
    svg.append('g')
      .attr('class', 'axis y-axis')
      .call(d3.axisLeft(y).ticks(5));
    
    // Grid lines
    svg.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(y)
        .ticks(5)
        .tickSize(-width)
        .tickFormat(''));
    
    // Use horizontal lines instead of bars
    svg.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.name))
      .attr('width', x.bandwidth())
      .attr('y', d => y(d.value))
      .attr('height', d => height - y(d.value))
      .on('mouseover', function(event, d) {
        tooltipRef.current.transition()
          .duration(200)
          .style('opacity', .9);
        tooltipRef.current.html(`
          <strong>${d.name}</strong><br/>
          Likelihood: ${formatNumber(d.value)}<br/>
          Count: ${d.count}
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        tooltipRef.current.transition()
          .duration(500)
          .style('opacity', 0);
      });
    
    // Axes labels
    svg.append('text')
      .attr('class', 'axis-label')
      .attr('text-anchor', 'middle')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 5)
      .text('Topics');
    
    svg.append('text')
      .attr('class', 'axis-label')
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -margin.left + 15)
      .text('Average Likelihood');
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
  }, [data]);
  
  const actionButtons = (
    <button className="refresh-btn" onClick={() => {
      setLoading(true);
      api.getTopN('likelihood', 'topic', 10)
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
  );
  
  return (
    <CardContainer title="Top Topics by Likelihood" actionButtons={actionButtons}>
      {loading ? (
        <Loader message="Loading likelihood data..." />
      ) : error ? (
        <NoDataMessage message={error} icon="⚠️" />
      ) : data.length === 0 ? (
        <NoDataMessage message="No likelihood data available" />
      ) : (
        <svg ref={svgRef} className="chart-svg"></svg>
      )}
    </CardContainer>
  );
};

export default LikelihoodChart;
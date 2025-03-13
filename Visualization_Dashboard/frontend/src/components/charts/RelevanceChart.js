import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import api from '../../services/api';
import CardContainer from '../common/CardContainer';
import Loader from '../common/Loader';
import NoDataMessage from '../common/NoDataMessage';
import { formatNumber, createTooltip } from '../../utils/helpers';

const RelevanceChart = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await api.getTopN('relevance', 'sector', 10);
        setData(result);
        setLoading(false);
      } catch (err) {
        setError('Failed to load relevance data');
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
    
    // Horizontal bar chart - sort data by relevance value in descending order
    data.sort((a, b) => b.value - a.value);
    
    // Scales
    const y = d3.scaleBand()
      .domain(data.map(d => d.name))
      .range([0, height])
      .padding(0.2);
    
    const x = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value) * 1.1])
      .range([0, width]);
    
    // Axes
    svg.append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5));
    
    svg.append('g')
      .attr('class', 'axis y-axis')
      .call(d3.axisLeft(y));
    
    // Grid lines
    svg.append('g')
      .attr('class', 'grid')
      .call(d3.axisBottom(x)
        .ticks(5)
        .tickSize(height)
        .tickFormat(''))
      .attr('transform', 'translate(0,0)');
    
    // Horizontal Bars
    svg.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('y', d => y(d.name))
      .attr('height', y.bandwidth())
      .attr('x', 0)
      .attr('width', d => x(d.value))
      .on('mouseover', function(event, d) {
        tooltipRef.current.transition()
          .duration(200)
          .style('opacity', .9);
        tooltipRef.current.html(`
          <strong>${d.name}</strong><br/>
          Relevance: ${formatNumber(d.value)}<br/>
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
    
    // Value labels on bars
    svg.selectAll('.value-label')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'value-label')
      .attr('x', d => x(d.value) + 5)
      .attr('y', d => y(d.name) + y.bandwidth() / 2)
      .attr('dy', '.35em')
      .text(d => formatNumber(d.value))
      .style('font-size', '10px')
      .style('fill', 'var(--dark-text)');
    
    // Axes labels
    svg.append('text')
      .attr('class', 'axis-label')
      .attr('text-anchor', 'middle')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom / 2)
      .text('Relevance');
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
      api.getTopN('relevance', 'sector', 10)
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
    <CardContainer title="Top Sectors by Relevance" actionButtons={actionButtons}>
      {loading ? (
        <Loader message="Loading relevance data..." />
      ) : error ? (
        <NoDataMessage message={error} icon="⚠️" />
      ) : data.length === 0 ? (
        <NoDataMessage message="No relevance data available" />
      ) : (
        <svg ref={svgRef} className="chart-svg"></svg>
      )}
    </CardContainer>
  );
};

export default RelevanceChart;
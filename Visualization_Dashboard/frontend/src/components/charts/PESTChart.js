import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import api from '../../services/api';
import CardContainer from '../common/CardContainer';
import Loader from '../common/Loader';
import NoDataMessage from '../common/NoDataMessage';

const PESTChart = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const svgRef = useRef(null);
  const legendRef = useRef(null);
  
  useEffect(() => {
    const fetchPESTData = async () => {
      try {
        setLoading(true);
        const pestData = await api.getPEST();
        setData(pestData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching PEST data:', err);
        setError('Failed to load PEST analysis data');
        setLoading(false);
      }
    };
    
    fetchPESTData();
  }, []);
  
  useEffect(() => {
    if (data && data.length > 0 && !loading) {
      renderChart();
    }
  }, [data, loading]);
  
  const calculatePercentages = (rawData) => {
    // Calculate total count of all items
    const total = rawData.reduce((sum, item) => sum + item.count, 0);
    
    // Calculate percentage for each item
    return rawData.map(item => ({
      category: item.pestle,
      value: item.count,
      percentage: parseFloat(((item.count / total) * 100).toFixed(1)),
      intensity: item.intensity || 0,
      likelihood: item.likelihood || 0,
      relevance: item.relevance || 0
    }));
  };
  
  const createTooltip = () => {
    return d3.select('body')
      .append('div')
      .attr('class', 'chart-tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background-color', 'white')
      .style('border', '1px solid #ddd')
      .style('border-radius', '4px')
      .style('padding', '10px')
      .style('pointer-events', 'none')
      .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)');
  };
  
  const renderChart = () => {
    if (!svgRef.current) return;
    
    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();
    d3.select(legendRef.current).selectAll('*').remove();
    
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const width = svgRef.current.clientWidth - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;
    
    // Process data
    const processedData = calculatePercentages(data);
    
    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('class', 'chart-svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${width / 2 + margin.left}, ${height / 2 + margin.top})`);
    
    // Create color scale
    const color = d3.scaleOrdinal()
      .domain(processedData.map(d => d.category))
      .range(d3.schemeCategory10);
    
    // Create pie generator
    const pie = d3.pie()
      .value(d => d.value)
      .sort(null);
    
    // Create arc generator
    const radius = Math.min(width, height) / 2;
    const arc = d3.arc()
      .innerRadius(0)
      .outerRadius(radius * 0.8);
    
    // Create outer arc for labels
    const outerArc = d3.arc()
      .innerRadius(radius * 0.9)
      .outerRadius(radius * 0.9);
    
    // Create tooltip
    const tooltip = createTooltip();
    
    // Draw pie slices
    svg.selectAll('path')
      .data(pie(processedData))
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', d => color(d.data.category))
      .attr('class', 'pie-slice')
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .on('mouseover', function(event, d) {
        tooltip.transition()
          .duration(200)
          .style('opacity', 0.9);
        tooltip.html(`<strong>${d.data.category}</strong><br/>
                     Count: ${d.data.value}<br/>
                     Percentage: ${d.data.percentage}%<br/>
                     Avg. Intensity: ${d.data.intensity.toFixed(1)}<br/>
                     Avg. Likelihood: ${d.data.likelihood.toFixed(1)}<br/>
                     Avg. Relevance: ${d.data.relevance.toFixed(1)}`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
        
        d3.select(this)
          .attr('opacity', 0.7);
      })
      .on('mouseout', function() {
        tooltip.transition()
          .duration(500)
          .style('opacity', 0);
        
        d3.select(this)
          .attr('opacity', 1);
      });
    
    // Add labels
    const text = svg.selectAll('text')
      .data(pie(processedData))
      .enter()
      .append('text')
      .attr('transform', d => {
        const pos = outerArc.centroid(d);
        const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
        pos[0] = radius * 0.95 * (midAngle < Math.PI ? 1 : -1);
        return `translate(${pos})`;
      })
      .attr('dy', '.35em')
      .attr('text-anchor', d => {
        const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
        return midAngle < Math.PI ? 'start' : 'end';
      })
      .text(d => d.data.percentage > 5 ? `${d.data.category} (${d.data.percentage}%)` : '');
    
    // Add polylines for labels
    svg.selectAll('polyline')
      .data(pie(processedData))
      .enter()
      .append('polyline')
      .attr('points', d => {
        const pos = outerArc.centroid(d);
        const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
        pos[0] = radius * 0.95 * (midAngle < Math.PI ? 1 : -1);
        return [arc.centroid(d), outerArc.centroid(d), pos];
      })
      .attr('stroke', 'black')
      .attr('fill', 'none')
      .attr('stroke-width', 1)
      .style('opacity', d => d.data.percentage > 5 ? 1 : 0);
    
    // Create legend
    const legend = d3.select(legendRef.current)
      .attr('class', 'chart-legend')
      .style('display', 'flex')
      .style('flex-wrap', 'wrap')
      .style('justify-content', 'center')
      .style('margin-top', '20px');
    
    processedData.forEach((item, index) => {
      const legendItem = legend.append('div')
        .attr('class', 'legend-item')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('margin', '0 10px 10px 0')
        .style('cursor', 'pointer')
        .on('mouseover', function() {
          svg.selectAll('.pie-slice')
            .filter((d, i) => i !== index)
            .attr('opacity', 0.3);
        })
        .on('mouseout', function() {
          svg.selectAll('.pie-slice')
            .attr('opacity', 1);
        });
      
      legendItem.append('div')
        .style('width', '12px')
        .style('height', '12px')
        .style('background-color', color(item.category))
        .style('margin-right', '5px');
      
      legendItem.append('div')
        .text(`${item.category} (${item.percentage}%)`)
        .style('font-size', '0.85rem');
    });
  };
  
  const actionButtons = (
    <button className="refresh-btn" onClick={() => {
      setLoading(true);
      api.getPEST().then(data => {
        setData(data);
        setLoading(false);
      }).catch(err => {
        setError('Failed to reload data');
        setLoading(false);
      });
    }}
    style={{
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: '16px'
    }}>
      <span className="refresh-icon" role="img" aria-label="refresh">↻</span>
    </button>
  );
  
  return (
    <CardContainer title="PEST Analysis" actionButtons={actionButtons}>
      {loading ? (
        <Loader message="Loading PEST analysis..." />
      ) : error ? (
        <NoDataMessage message={error} icon="⚠️" />
      ) : !data || data.length === 0 ? (
        <NoDataMessage message="No PEST analysis data available" />
      ) : (
        <div className="chart-container" style={{ width: '100%', height: '400px' }}>
          <svg ref={svgRef} style={{ width: '100%', height: '350px' }}></svg>
          <div ref={legendRef} style={{ width: '100%' }}></div>
        </div>
      )}
    </CardContainer>
  );
};

export default PESTChart;
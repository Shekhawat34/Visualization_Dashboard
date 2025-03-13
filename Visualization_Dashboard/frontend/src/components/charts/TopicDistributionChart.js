import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import api from '../../services/api';
import CardContainer from '../common/CardContainer';
import Loader from '../common/Loader';
import NoDataMessage from '../common/NoDataMessage';
import { formatNumber, truncateText, createTooltip, debounce } from '../../utils/helpers';

const TopicDistributionChart = ({ filters, onFilterChange }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('intensity'); // 'intensity' or 'relevance'
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [chartType, setChartType] = useState('treemap'); // 'treemap' or 'barchart'
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);

  // Fetch available topics for the filter dropdown
  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const filtersData = await api.getFilters();
        setTopics(filtersData.topics || []);
      } catch (err) {
        console.error('Error fetching topics for filter:', err);
      }
    };

    fetchTopics();
  }, []);

  // Fetch data with filters applied
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null); // Clear any previous errors
        
        // Apply filters
        const appliedFilters = {
          ...filters
        };
        
        // Only add topic filter if it's not 'all'
        if (selectedTopic !== 'all') {
          appliedFilters.topic = selectedTopic;
          appliedFilters.exact_match = 'true'; 
        }
        
        console.log("Fetching with filters:", appliedFilters);
        
        const topicsData = await api.getTopics(appliedFilters);
        console.log("API response:", topicsData);
        
        if (topicsData.length === 0) {
          setError(`No data found for topic: ${selectedTopic}`);
          setData([]);
        } else {
          setData(topicsData);
          
          // Automatically switch to bar chart if only one topic is returned
          if (topicsData.length === 1 && selectedTopic !== 'all') {
            setChartType('barchart');
          } else {
            setChartType('treemap');
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching topics data:', err);
        setError('Failed to load topics data');
        setData([]);
        setLoading(false);
      }
    };
  
    fetchData();
  }, [filters, selectedTopic]);

  useEffect(() => {
    if (data.length > 0 && !loading) {
      if (chartType === 'treemap') {
        drawTreeMap();
      } else {
        drawBarChart();
      }
      
      // Add resize listener
      const handleResize = debounce(() => {
        if (chartType === 'treemap') {
          drawTreeMap();
        } else {
          drawBarChart();
        }
      }, 300);
      
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [data, loading, selectedMetric, chartType]);

  const handleTopicChange = (event) => {
    const topic = event.target.value;
    setSelectedTopic(topic);
    
    // If onFilterChange prop exists, call it to update parent component filters
    if (onFilterChange) {
      onFilterChange({
        ...filters,
        topic: topic !== 'all' ? topic : undefined
      });
    }
  };

  const drawBarChart = () => {
    if (!svgRef.current || !containerRef.current) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    // Set dimensions
    const containerWidth = containerRef.current.clientWidth;
    const margin = { top: 30, right: 30, bottom: 70, left: 60 };
    const width = containerWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', containerWidth)
      .attr('height', 400)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Create tooltip if not already created
    if (!tooltipRef.current) {
      tooltipRef.current = createTooltip(d3);
    }

    // Extract metrics for the selected topic
    const topicData = data[0];
    const metrics = [
      { name: "Intensity", value: topicData.intensity },
      { name: "Relevance", value: topicData.relevance },
      { name: "Likelihood", value: topicData.likelihood }
    ];
    
    // Create scales
    const x = d3.scaleBand()
      .domain(metrics.map(d => d.name))
      .range([0, width])
      .padding(0.3);
    
    const y = d3.scaleLinear()
      .domain([0, d3.max(metrics, d => d.value) * 1.2])
      .range([height, 0]);
    
    // Create color scale
    const colorScale = d3.scaleOrdinal()
      .domain(metrics.map(d => d.name))
      .range(['#0056b3', '#28a745', '#ffc107']);
    
    // Add X axis
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .style('font-size', '12px');
    
    // Add Y axis
    svg.append('g')
      .call(d3.axisLeft(y).ticks(5))
      .selectAll('text')
      .style('font-size', '12px');
    
    // Add X axis label
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 10)
      .text('Metrics')
      .style('font-size', '14px');
    
    // Add Y axis label
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 20)
      .attr('x', -height / 2)
      .text('Value')
      .style('font-size', '14px');
    
    // Add title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .text(`Topic: ${topicData.topic} (Count: ${topicData.count})`);
    
    // Create bars with animation
    svg.selectAll('.bar')
      .data(metrics)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.name))
      .attr('width', x.bandwidth())
      .attr('y', height)
      .attr('height', 0)
      .attr('fill', d => colorScale(d.name))
      .attr('rx', 4)
      .attr('ry', 4)
      .transition()
      .duration(800)
      .attr('y', d => y(d.value))
      .attr('height', d => height - y(d.value));
    
    // Add value labels on top of bars
    svg.selectAll('.label')
      .data(metrics)
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('text-anchor', 'middle')
      .attr('x', d => x(d.name) + x.bandwidth() / 2)
      .attr('y', d => y(d.value) - 5)
      .style('font-size', '12px')
      .style('opacity', 0)
      .text(d => formatNumber(d.value))
      .transition()
      .duration(800)
      .delay(400)
      .style('opacity', 1);
    
    // Add hover effects
    svg.selectAll('.bar')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration(300)
          .attr('fill', d3.color(colorScale(d.name)).brighter(0.3))
          .attr('stroke', '#000')
          .attr('stroke-width', 1);
        
        tooltipRef.current
          .style('opacity', 1)
          .html(`
            <strong>${d.name}:</strong> ${formatNumber(d.value)}<br>
            <strong>Topic:</strong> ${topicData.topic}<br>
            <strong>Count:</strong> ${formatNumber(topicData.count)}
          `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 20) + 'px');
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .transition()
          .duration(300)
          .attr('fill', colorScale(d.name))
          .attr('stroke', 'none');
        
        tooltipRef.current.style('opacity', 0);
      });
  };

  const drawTreeMap = () => {
    if (!svgRef.current || !containerRef.current) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    // Set dimensions
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight || 400;
    
    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', containerWidth)
      .attr('height', containerHeight);

    // Create tooltip if not already created
    if (!tooltipRef.current) {
      tooltipRef.current = createTooltip(d3);
    }

    // Prepare data hierarchy
    const hierarchyData = {
      name: "Topics",
      children: data.map(d => ({
        name: d.topic,
        value: selectedMetric === 'intensity' ? d.intensity : d.relevance,
        count: d.count,
        intensity: d.intensity,
        relevance: d.relevance,
        likelihood: d.likelihood
      }))
    };

    // Create a color scale
    const colorScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => selectedMetric === 'intensity' ? d.intensity : d.relevance) || 1])
      .range(['#e0f2ff', '#0056b3']);

    // Create treemap layout
    const treemap = d3.treemap()
      .size([containerWidth, containerHeight])
      .padding(4)
      .round(true);

    // Create hierarchy
    const root = d3.hierarchy(hierarchyData)
      .sum(d => d.value || 0.1) // Ensure even zero values get some space
      .sort((a, b) => b.value - a.value);

    // Generate the treemap layout
    treemap(root);

    // Create the treemap cells with transition
    const cells = svg.selectAll('.cell')
      .data(root.leaves(), d => d.data.name);
    
    // Remove exiting cells
    cells.exit().transition().duration(500)
      .attr('transform', d => `translate(${d.x0},${d.y0})`)
      .attr('width', 0)
      .attr('height', 0)
      .remove();
    
    // Add new cells
    const enterCells = cells.enter()
      .append('g')
      .attr('class', 'cell')
      .attr('transform', d => `translate(${d.x0},${d.y0})`)
      .style('opacity', 0);
    
    // Animated rectangle creation
    enterCells.append('rect')
      .attr('width', 0)
      .attr('height', 0)
      .attr('id', d => `rect-${d.data.name.replace(/\s+/g, '-').toLowerCase()}`)
      .attr('rx', 4)
      .attr('ry', 4)
      .transition()
      .duration(800)
      .delay((d, i) => i * 30)
      .attr('width', d => Math.max(d.x1 - d.x0, 0))
      .attr('height', d => Math.max(d.y1 - d.y0, 0))
      .attr('fill', d => colorScale(d.data.value))
      .style('opacity', 1);
    
    enterCells
      .transition()
      .duration(800)
      .delay((d, i) => i * 30)
      .style('opacity', 1);
    
    // Update existing cells
    cells.transition()
      .duration(800)
      .attr('transform', d => `translate(${d.x0},${d.y0})`)
      .select('rect')
      .attr('width', d => Math.max(d.x1 - d.x0, 0))
      .attr('height', d => Math.max(d.y1 - d.y0, 0))
      .attr('fill', d => colorScale(d.data.value));
    
    // Cell text
    const allCells = svg.selectAll('.cell');
    
    // Remove old text
    allCells.selectAll('text').remove();
    
    // Add new text
    allCells.append('text')
      .attr('class', 'topic-label')
      .attr('x', 5)
      .attr('y', 15)
      .attr('fill', d => d.data.value > d3.max(data, item => selectedMetric === 'intensity' ? item.intensity : item.relevance) / 2 ? 'white' : 'black')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('opacity', 0)
      .text(d => truncateText(d.data.name, Math.floor((d.x1 - d.x0) / 6)))
      .transition()
      .duration(800)
      .delay((d, i) => 300 + i * 30)
      .style('opacity', d => (d.x1 - d.x0 > 30) ? 1 : 0);
    
    // Value text
    allCells.append('text')
      .attr('class', 'value-label')
      .attr('x', 5)
      .attr('y', 30)
      .attr('fill', d => d.data.value > d3.max(data, item => selectedMetric === 'intensity' ? item.intensity : item.relevance) / 2 ? 'white' : 'black')
      .style('font-size', '10px')
      .style('opacity', 0)
      .text(d => `${selectedMetric === 'intensity' ? 'Int' : 'Rel'}: ${formatNumber(d.data.value)}`)
      .transition()
      .duration(800)
      .delay((d, i) => 400 + i * 30)
      .style('opacity', d => (d.x1 - d.x0 > 60 && d.y1 - d.y0 > 40) ? 1 : 0);
    
    // Count text
    allCells.append('text')
      .attr('class', 'count-label')
      .attr('x', 5)
      .attr('y', 45)
      .attr('fill', d => d.data.value > d3.max(data, item => selectedMetric === 'intensity' ? item.intensity : item.relevance) / 2 ? 'white' : 'black')
      .style('font-size', '10px')
      .style('opacity', 0)
      .text(d => `Count: ${formatNumber(d.data.count)}`)
      .transition()
      .duration(800)
      .delay((d, i) => 500 + i * 30)
      .style('opacity', d => (d.x1 - d.x0 > 80 && d.y1 - d.y0 > 60) ? 1 : 0);
    
    // Add hover effects
    allCells
      .on('mouseover', function(event, d) {
        d3.select(this).select('rect')
          .transition()
          .duration(300)
          .attr('stroke', '#000')
          .attr('stroke-width', 2)
          .style('filter', 'drop-shadow(0px 0px 6px rgba(0, 0, 0, 0.3))');
        
        tooltipRef.current
          .style('opacity', 1)
          .html(`
            <strong>Topic:</strong> ${d.data.name}<br>
            <strong>Count:</strong> ${formatNumber(d.data.count)}<br>
            <strong>Intensity:</strong> ${formatNumber(d.data.intensity)}<br>
            <strong>Relevance:</strong> ${formatNumber(d.data.relevance)}<br>
            <strong>Likelihood:</strong> ${formatNumber(d.data.likelihood)}
          `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 20) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this).select('rect')
          .transition()
          .duration(300)
          .attr('stroke', 'none')
          .attr('stroke-width', 0)
          .style('filter', 'none');
        
        tooltipRef.current.style('opacity', 0);
      });
    
    // Add a legend
    const legendHeight = 20;
    const legendWidth = 200;
    
    const legend = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${containerWidth - legendWidth - 20}, 20)`);
    
    // Create gradient for legend
    const defs = svg.append('defs');
    const linearGradient = defs.append('linearGradient')
      .attr('id', 'topic-color-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%');
    
    linearGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#e0f2ff');
    
    linearGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#0056b3');
    
    // Draw legend rectangle
    legend.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', 'url(#topic-color-gradient)');
    
    // Add legend labels
    legend.append('text')
      .attr('x', 0)
      .attr('y', legendHeight + 15)
      .style('font-size', '10px')
      .text('Lower');
    
    legend.append('text')
      .attr('x', legendWidth)
      .attr('y', legendHeight + 15)
      .style('font-size', '10px')
      .style('text-anchor', 'end')
      .text('Higher');
    
    legend.append('text')
      .attr('x', legendWidth / 2)
      .attr('y', legendHeight + 15)
      .style('font-size', '10px')
      .style('text-anchor', 'middle')
      .text(selectedMetric === 'intensity' ? 'Intensity' : 'Relevance');
  };

  const handleMetricChange = (metric) => {
    setSelectedMetric(metric);
  };

  const toggleChartType = () => {
    setChartType(prevType => prevType === 'treemap' ? 'barchart' : 'treemap');
  };

  const renderActionButtons = () => (
    <div className="chart-actions">
      <div className="filter-container">
        <label htmlFor="topic-filter">Topic: </label>
        <select 
          id="topic-filter" 
          value={selectedTopic} 
          onChange={handleTopicChange}
          className="filter-select"
        >
          <option value="all">All Topics</option>
          {topics.map(topic => (
            <option key={topic} value={topic}>{topic}</option>
          ))}
        </select>
      </div>
      <div className="metric-buttons">
        <button
          className={`chart-btn ${selectedMetric === 'intensity' ? 'active' : ''}`}
          onClick={() => handleMetricChange('intensity')}
        >
          Intensity
        </button>
        <button
          className={`chart-btn ${selectedMetric === 'relevance' ? 'active' : ''}`}
          onClick={() => handleMetricChange('relevance')}
        >
          Relevance
        </button>
        {data.length > 0 && (
          <button
            className="chart-btn"
            onClick={toggleChartType}
          >
            {chartType === 'treemap' ? 'Switch to Bar Chart' : 'Switch to TreeMap'}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <CardContainer 
      title="Topic Distribution Visualization" 
      actionButtons={renderActionButtons()}
    >
      <div ref={containerRef} style={{ width: '100%', height: '400px' }}>
        {loading ? (
          <Loader message="Loading topic data..." />
        ) : error ? (
          <NoDataMessage message={error} icon="⚠️" />
        ) : data.length === 0 ? (
          <NoDataMessage message="No topic data available" />
        ) : (
          <svg ref={svgRef} className="chart-svg"></svg>
        )}
      </div>
    </CardContainer>
  );
};

export default TopicDistributionChart;
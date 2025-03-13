import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import api from '../../services/api';
import CardContainer from '../common/CardContainer';
import Loader from '../common/Loader';
import NoDataMessage from '../common/NoDataMessage';
import { formatNumber, createTooltip, debounce } from '../../utils/helpers';

const TimeseriesChart = ({ metric = 'intensity', filters = {} }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [yearFilter, setYearFilter] = useState(filters.end_year || 'all');
  const [availableYears, setAvailableYears] = useState([]);
  const [chartType, setChartType] = useState('line'); // 'line' or 'bar'
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const [highlightedPoint, setHighlightedPoint] = useState(null);

  // Fetch available years for the filter
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const filterOptions = await api.getFilters();
        if (filterOptions && filterOptions.end_year) {
          // Sort years numerically
          const sortedYears = filterOptions.end_year.sort((a, b) => Number(a) - Number(b));
          setAvailableYears(sortedYears);
        }
      } catch (err) {
        console.error('Error fetching filter options:', err);
      }
    };

    fetchFilterOptions();
  }, []);

  // Modified data fetching that handles various date scenarios
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Remove end_year from filters for API call since we'll handle date filtering ourselves
        const apiFilters = { ...filters };
        delete apiFilters.end_year;
        
        // Get all raw data
        const rawData = await api.getData(apiFilters);
        
        // Process data for timeseries visualization based on different date scenarios
        const processedData = processTimeseriesData(rawData, yearFilter);
        
        // Determine chart type based on data structure
        if (processedData.hasEndYearOnly) {
          setChartType('bar');
        } else {
          setChartType('line');
        }
        
        setData(processedData.timeseriesData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching and processing data:', err);
        setError('Failed to load timeseries data');
        setLoading(false);
      }
    };

    fetchData();
  }, [metric, JSON.stringify(filters), yearFilter]);

  // Process raw data for timeseries visualization
  const processTimeseriesData = (rawData, yearFilter) => {
    let timeseriesData = [];
    let hasEndYearOnly = false;
    
    // Count how many records have each type of date pattern
    const datePatterns = {
      bothDates: 0,
      startOnly: 0,
      endOnly: 0,
      noDates: 0
    };
    
    // First, analyze the data to determine which date pattern is most common
    rawData.forEach(item => {
      if (item.start_year && item.end_year) {
        datePatterns.bothDates++;
      } else if (item.start_year && !item.end_year) {
        datePatterns.startOnly++;
      } else if (!item.start_year && item.end_year) {
        datePatterns.endOnly++;
      } else {
        datePatterns.noDates++;
      }
    });
    
    // Skip items with no dates
    const filteredData = rawData.filter(item => item.start_year || item.end_year);
    
    // Determine the dominant date pattern
    const dominantPattern = Object.keys(datePatterns).reduce((a, b) => 
      datePatterns[a] > datePatterns[b] ? a : b
    );
    
    // If many records have only end_year, use a bar chart
    if (dominantPattern === 'endOnly' || datePatterns.endOnly > filteredData.length * 0.3) {
      hasEndYearOnly = true;
    }
    
    // Group data by year and calculate average metric value
    const yearDataMap = new Map();
    
    filteredData.forEach(item => {
      // Handle filtering by end_year if specified
      if (yearFilter !== 'all' && 
          String(item.end_year) !== String(yearFilter) && 
          String(item.start_year) !== String(yearFilter)) {
        return;
      }
      
      let yearValue;
      
      // Different handling based on what date info is available
      if (item.start_year && item.end_year) {
        // If both dates available, use start_year for visualization
        yearValue = Number(item.start_year);
      } else if (item.start_year) {
        // If only start_year, use it
        yearValue = Number(item.start_year);
      } else if (item.end_year) {
        // If only end_year, use it
        yearValue = Number(item.end_year);
      } else {
        // Skip if no year data
        return;
      }
      
      // Skip if year is invalid
      if (isNaN(yearValue)) return;
      
      // Get metric value
      const metricValue = Number(item[metric]) || 0;
      
      // Add to year map for aggregation
      if (yearDataMap.has(yearValue)) {
        const existingData = yearDataMap.get(yearValue);
        existingData.sum += metricValue;
        existingData.count += 1;
      } else {
        yearDataMap.set(yearValue, {
          sum: metricValue,
          count: 1,
          hasStartYear: !!item.start_year,
          hasEndYear: !!item.end_year
        });
      }
    });
    
    // Convert map to array and calculate averages
    timeseriesData = Array.from(yearDataMap.entries()).map(([year, data]) => ({
      year,
      value: data.sum / data.count,
      count: data.count,
      hasStartYear: data.hasStartYear,
      hasEndYear: data.hasEndYear
    }));
    
    // Sort by year
    timeseriesData.sort((a, b) => a.year - b.year);
    
    return {
      timeseriesData,
      hasEndYearOnly
    };
  };

  useEffect(() => {
    if (data.length > 0 && !loading) {
      if (chartType === 'bar') {
        drawBarChart();
      } else {
        drawLineChart();
      }
      
      // Add resize listener
      const handleResize = debounce(() => {
        if (chartType === 'bar') {
          drawBarChart();
        } else {
          drawLineChart();
        }
      }, 300);
      
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [data, loading, highlightedPoint, chartType]);

  const getMetricColor = (metric) => {
    const colors = {
      intensity: '#3b82f6', // Blue
      likelihood: '#10b981', // Green
      relevance: '#8b5cf6'  // Purple
    };
    return colors[metric] || '#3b82f6';
  };

  const drawLineChart = () => {
    if (!svgRef.current || !containerRef.current) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    // Set dimensions
    const containerWidth = containerRef.current.clientWidth;
    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const width = containerWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create tooltip if not already created
    if (!tooltipRef.current) {
      tooltipRef.current = createTooltip(d3);
    }

    // Create scales
    const xScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.year))
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value) * 1.1])
      .range([height, 0]);

    // Create axes
    const xAxis = d3.axisBottom(xScale)
      .tickFormat(d => Math.round(d))
      .ticks(Math.min(data.length, 10));

    const yAxis = d3.axisLeft(yScale)
      .ticks(5)
      .tickFormat(d => formatNumber(d));

    // Add X axis
    svg.append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .selectAll('text')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .attr('fill', '#4b5563')
      .style('text-anchor', 'middle');

    // Add Y axis
    svg.append('g')
      .attr('class', 'axis y-axis')
      .call(yAxis)
      .selectAll('text')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .attr('fill', '#4b5563');
    
    // Y-axis label
    svg.append('text')
      .attr('class', 'axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 15)
      .attr('x', -height / 2)
      .attr('fill', '#1f2937')
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .attr('text-anchor', 'middle')
      .text(metric.charAt(0).toUpperCase() + metric.slice(1));

    // Get the primary color for this metric
    const primaryColor = getMetricColor(metric);
    
    // Create gradient for area
    const areaGradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', `areaGradient-${metric}`)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
      
    areaGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', primaryColor)
      .attr('stop-opacity', 0.6);
      
    areaGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', primaryColor)
      .attr('stop-opacity', 0.05);

    // Create line generator with smooth curve
    const line = d3.line()
      .x(d => xScale(d.year))
      .y(d => yScale(d.value))
      .curve(d3.curveCardinal.tension(0.4));

    // Add area
    const area = d3.area()
      .x(d => xScale(d.year))
      .y0(height)
      .y1(d => yScale(d.value))
      .curve(d3.curveCardinal.tension(0.4));

    // Add drop shadow filter
    const filter = svg.append('defs')
      .append('filter')
      .attr('id', 'drop-shadow')
      .attr('height', '130%');

    filter.append('feGaussianBlur')
      .attr('in', 'SourceAlpha')
      .attr('stdDeviation', 3)
      .attr('result', 'blur');

    filter.append('feOffset')
      .attr('in', 'blur')
      .attr('dx', 2)
      .attr('dy', 2)
      .attr('result', 'offsetBlur');

    filter.append('feComponentTransfer')
      .append('feFuncA')
      .attr('type', 'linear')
      .attr('slope', 0.2);

    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode')
      .attr('in', 'offsetBlur');
    feMerge.append('feMergeNode')
      .attr('in', 'SourceGraphic');

    // Add area with gradient
    svg.append('path')
      .datum(data)
      .attr('class', 'area')
      .attr('d', area)
      .attr('fill', `url(#areaGradient-${metric})`)
      .attr('opacity', 0.8);

    // Add the line with animation
    const path = svg.append('path')
      .datum(data)
      .attr('class', 'line')
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', primaryColor)
      .attr('stroke-width', 3)
      .attr('filter', 'url(#drop-shadow)');
    
    // Get the total length of the line for animation
    const totalLength = path.node().getTotalLength();
    
    // Animate the line on load
    path
      .attr('stroke-dasharray', totalLength + ' ' + totalLength)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(1500)
      .ease(d3.easeLinear)
      .attr('stroke-dashoffset', 0);

    // Overlay for hover effects
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('mousemove', function(event) {
        const [mouseX] = d3.pointer(event);
        const x0 = xScale.invert(mouseX);
        
        // Find the closest data point
        const bisect = d3.bisector(d => d.year).left;
        const index = bisect(data, x0);
        const d0 = data[index - 1];
        const d1 = data[index];
        
        if (!d0 || !d1) return;
        
        const d = x0 - d0.year > d1.year - x0 ? d1 : d0;
        setHighlightedPoint(d);
        
        // // Update tooltip
        // tooltipRef.current
        //   .style('opacity', 1)
        //   .style('left', (event.pageX + 10) + 'px')
        //   .style('top', (event.pageY - 20) + 'px')
        //   .style('background-color', 'rgba(255, 255, 255, 0.95)')
        //   .style('border-radius', '6px')
        //   .style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.1)')
        //   .style('padding', '10px 14px')
        //   .style('font-family', 'system-ui, -apple-system, sans-serif')
        //   .style('font-size', '14px')
        //   .style('border', `2px solid ${primaryColor}`)
          // .html(`
          //   <div style="font-weight: 600; color: #1f2937; margin-bottom: 4px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">
          //     Year: ${d.year}
          //   </div>
          //   <div style="display: flex; justify-content: space-between; margin-top: 4px;">
          //     <span style="font-weight: 500; color: #4b5563;">${metric.charAt(0).toUpperCase() + metric.slice(1)}:</span>
          //     <span style="font-weight: 600; color: ${primaryColor};">${formatNumber(d.value)}</span>
          //   </div>
          //   <div style="display: flex; justify-content: space-between; margin-top: 4px;">
          //     <span style="font-weight: 500; color: #4b5563;">Records:</span>
          //     <span style="font-weight: 600; color: #1f2937;">${d.count}</span>
          //   </div>
          //   <div style="margin-top: 4px; font-size: 12px; color: #6b7280;">
          //     ${d.hasStartYear && d.hasEndYear ? 'Has both start and end year' : 
          //       d.hasStartYear ? 'Has start year only' : 
          //       d.hasEndYear ? 'Has end year only' : ''}
          //   </div>
          // `);
      })
      .on('mouseleave', function() {
        setHighlightedPoint(null);
        tooltipRef.current.style('opacity', 0);
      });

    // Add dots with effects
    svg.selectAll('.dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', d => xScale(d.year))
      .attr('cy', d => yScale(d.value))
      .attr('r', d => highlightedPoint && highlightedPoint.year === d.year ? 8 : 5)
      .attr('fill', d => highlightedPoint && highlightedPoint.year === d.year ? primaryColor : 'white')
      .attr('stroke', primaryColor)
      .attr('stroke-width', d => highlightedPoint && highlightedPoint.year === d.year ? 3 : 2)
      .style('cursor', 'pointer')
      .attr('filter', d => highlightedPoint && highlightedPoint.year === d.year ? 'url(#drop-shadow)' : 'none')
      .transition()
      .delay((d, i) => i * 50)
      .duration(500)
      .attr('opacity', 1);

    // If there's a highlighted point, add year and value labels directly on the chart
    if (highlightedPoint) {
      // Add value label above the point
      svg.append('text')
        .attr('class', 'value-label')
        .attr('x', xScale(highlightedPoint.year))
        .attr('y', yScale(highlightedPoint.value) - 15)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .attr('fill', primaryColor)
        .text(formatNumber(highlightedPoint.value));
        
      // Add year label below the point
      svg.append('text')
        .attr('class', 'year-label')
        .attr('x', xScale(highlightedPoint.year))
        .attr('y', height + 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .attr('fill', '#4b5563')
        .text(highlightedPoint.year);
      
      // Add vertical guide line
      svg.append('line')
        .attr('class', 'guide-line')
        .attr('x1', xScale(highlightedPoint.year))
        .attr('x2', xScale(highlightedPoint.year))
        .attr('y1', yScale(highlightedPoint.value))
        .attr('y2', height)
        .attr('stroke', primaryColor)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '3,3')
        .attr('opacity', 0.7);
        
      // Add focus circle
      svg.append('circle')
        .attr('class', 'focus-ring')
        .attr('cx', xScale(highlightedPoint.year))
        .attr('cy', yScale(highlightedPoint.value))
        .attr('r', 12)
        .attr('fill', 'none')
        .attr('stroke', primaryColor)
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.5)
        .attr('stroke-dasharray', '3,2');
    }

    // Add chart title with style
    svg.append('text')
      .attr('class', 'chart-title')
      .attr('x', width / 2)
      .attr('y', -5)
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('text-anchor', 'middle')
      .attr('fill', '#1f2937')
      .text(`${metric.charAt(0).toUpperCase() + metric.slice(1)} Trend Analysis`);
  };

  const drawBarChart = () => {
    if (!svgRef.current || !containerRef.current) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    // Set dimensions
    const containerWidth = containerRef.current.clientWidth;
    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const width = containerWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create tooltip if not already created
    if (!tooltipRef.current) {
      tooltipRef.current = createTooltip(d3);
    }

    // Create scales
    const xScale = d3.scaleBand()
      .domain(data.map(d => d.year))
      .range([0, width])
      .padding(0.3);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value) * 1.1])
      .range([height, 0]);

    // Create axes
    const xAxis = d3.axisBottom(xScale)
      .tickValues(xScale.domain().filter((d, i) => !(i % Math.ceil(data.length / 10))));

    const yAxis = d3.axisLeft(yScale)
      .ticks(5)
      .tickFormat(d => formatNumber(d));

    // Add X axis
    svg.append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .selectAll('text')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .attr('fill', '#4b5563')
      .style('text-anchor', 'middle');

    // Add Y axis
    svg.append('g')
      .attr('class', 'axis y-axis')
      .call(yAxis)
      .selectAll('text')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .attr('fill', '#4b5563');
    
    // Y-axis label
    svg.append('text')
      .attr('class', 'axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 15)
      .attr('x', -height / 2)
      .attr('fill', '#1f2937')
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .attr('text-anchor', 'middle')
      .text(metric.charAt(0).toUpperCase() + metric.slice(1));

    // Get the primary color for this metric
    const primaryColor = getMetricColor(metric);
    
    // Create gradient for bars
    const barGradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', `barGradient-${metric}`)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
      
    barGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', primaryColor)
      .attr('stop-opacity', 1);
      
    barGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', primaryColor)
      .attr('stop-opacity', 0.7);

    // Add drop shadow filter
    const filter = svg.append('defs')
      .append('filter')
      .attr('id', 'bar-shadow')
      .attr('height', '130%');

    filter.append('feGaussianBlur')
      .attr('in', 'SourceAlpha')
      .attr('stdDeviation', 2)
      .attr('result', 'blur');

    filter.append('feOffset')
      .attr('in', 'blur')
      .attr('dx', 1)
      .attr('dy', 2)
      .attr('result', 'offsetBlur');

    filter.append('feComponentTransfer')
      .append('feFuncA')
      .attr('type', 'linear')
      .attr('slope', 0.2);

    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode')
      .attr('in', 'offsetBlur');
    feMerge.append('feMergeNode')
      .attr('in', 'SourceGraphic');

    // Add bars with enhanced visual effects
    svg.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d.year))
      .attr('width', xScale.bandwidth())
      .attr('y', height) // Start from bottom for animation
      .attr('height', 0) // Start with height 0 for animation
      .attr('fill', d => highlightedPoint && highlightedPoint.year === d.year 
        ? primaryColor 
        : `url(#barGradient-${metric})`)
      .attr('rx', 3) // Rounded corners
      .attr('ry', 3)
      .attr('filter', d => highlightedPoint && highlightedPoint.year === d.year 
        ? 'url(#bar-shadow)' 
        : 'none')
      .attr('stroke', d => highlightedPoint && highlightedPoint.year === d.year 
        ? darkenColor(primaryColor, 0.2)
        : 'none')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        // Handle hover state
        d3.select(this)
          .attr('fill', primaryColor)
          .attr('filter', 'url(#bar-shadow)')
          .attr('stroke', darkenColor(primaryColor, 0.2))
          .attr('stroke-width', 1);
        
        setHighlightedPoint(d);
        
        // // Show tooltip
        // tooltipRef.current
        //   .style('opacity', 1)
        //   .style('left', (event.pageX + 10) + 'px')
        //   .style('top', (event.pageY - 20) + 'px')
        //   .style('background-color', 'rgba(255, 255, 255, 0.95)')
        //   .style('border-radius', '6px')
        //   .style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.1)')
        //   .style('padding', '10px 14px')
        //   .style('font-family', 'system-ui, -apple-system, sans-serif')
        //   .style('font-size', '14px')
        //   .style('border', `2px solid ${primaryColor}`)
          // .html(`
          //   <div style="font-weight: 600; color: #1f2937; margin-bottom: 4px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">
          //     Year: ${d.year}
          //   </div>
          //   <div style="display: flex; justify-content: space-between; margin-top: 4px;">
          //     <span style="font-weight: 500; color: #4b5563;">${metric.charAt(0).toUpperCase() + metric.slice(1)}:</span>
          //     <span style="font-weight: 600; color: ${primaryColor};">${formatNumber(d.value)}</span>
          //   </div>
          //   <div style="display: flex; justify-content: space-between; margin-top: 4px;">
          //     // <span style="font-weight: 500; color: #4b5563;">Records:</span>
          //     <span style="font-weight: 600; color: #1f2937;">${d.count}</span>
          //   </div>
          //   <div style="margin-top: 4px; font-size: 12px; color: #6b7280;">
          //     ${d.hasStartYear && d.hasEndYear ? 'Has both start and end year' : 
          //       d.hasStartYear ? 'Has start year only' : 
          //       d.hasEndYear ? 'Has end year only' : ''}
          //   </div>
          // `);
      })
      .on('mouseout', function() {
        // Reset styles on mouseout
        d3.select(this)
          .attr('fill', `url(#barGradient-${metric})`)
          .attr('filter', 'none')
          .attr('stroke', 'none');
          
        setHighlightedPoint(null);
        tooltipRef.current.style('opacity', 0);
      })
      // Animate bars on load
      .transition()
      .duration(800)
      .delay((d, i) => i * 50)
      .attr('y', d => yScale(d.value))
      .attr('height', d => height - yScale(d.value));

    // If there's a highlighted point, add value label above the bar
    if (highlightedPoint) {
      svg.append('text')
        .attr('class', 'value-label')
        .attr('x', xScale(highlightedPoint.year) + xScale.bandwidth() / 2)
        .attr('y', yScale(highlightedPoint.value) - 8)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .attr('fill', primaryColor)
        .text(formatNumber(highlightedPoint.value));
    }

    // Add chart title
    // Add chart title
  svg.append('text')
  .attr('class', 'chart-title')
  .attr('x', width / 2)
  .attr('y', -5)
  .attr('font-size', '14px')
  .attr('font-weight', 'bold')
  .attr('text-anchor', 'middle')
  .attr('fill', '#1f2937')
  .text(`${metric.charAt(0).toUpperCase() + metric.slice(1)} by Year`);
};

// Helper function to darken a color
const darkenColor = (color, amount) => {
// Parse the hex color
let r = parseInt(color.substring(1, 3), 16);
let g = parseInt(color.substring(3, 5), 16);
let b = parseInt(color.substring(5, 7), 16);

// Darken each component
r = Math.max(0, Math.floor(r * (1 - amount)));
g = Math.max(0, Math.floor(g * (1 - amount)));
b = Math.max(0, Math.floor(b * (1 - amount)));

// Convert back to hex
return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

// Render loading state or error message if applicable
if (loading) {
return <Loader message="Loading timeseries data..." />;
}

if (error) {
return <div className="text-red-500">{error}</div>;
}

if (data.length === 0) {
return <NoDataMessage message="No timeseries data available for the selected filters." />;
}

return (
<CardContainer title={`${metric.charAt(0).toUpperCase() + metric.slice(1)} Trends Over Time`}>
  <div className="mb-4 flex flex-wrap items-center gap-4">
    {availableYears.length > 0 && (
      <div className="flex items-center">
        <label htmlFor="year-filter" className="mr-2 text-sm font-medium text-gray-700">
          Filter by Year:
        </label>
        <select
          id="year-filter"
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">All Years</option>
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
    )}
    
    <div className="flex items-center">
      <label htmlFor="chart-type" className="mr-2 text-sm font-medium text-gray-700">
        Chart Type:
      </label>
      <select
        id="chart-type"
        value={chartType}
        onChange={(e) => setChartType(e.target.value)}
        className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="line">Line Chart</option>
        <option value="bar">Bar Chart</option>
      </select>
    </div>
  </div>
  
  <div className="relative" ref={containerRef}>
    <svg ref={svgRef} className="w-full"></svg>
  </div>
  
  <div className="mt-4 text-xs text-gray-500">
    <p>Data points represent the average {metric} value for events in each year.</p>
    <p>Hover over data points for more details.</p>
  </div>
</CardContainer>
);
};

export default TimeseriesChart;

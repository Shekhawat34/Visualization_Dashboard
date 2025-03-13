import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import api from '../../services/api';
import CardContainer from '../common/CardContainer';
import Loader from '../common/Loader';
import NoDataMessage from '../common/NoDataMessage';
import { formatNumber, debounce } from '../../utils/helpers';

// Define createTooltip function since we're not sure about its implementation
const createTooltip = (d3) => {
  // Create tooltip div if it doesn't exist
  let tooltip = d3.select('body').select('.map-tooltip');
  
  if (tooltip.empty()) {
    tooltip = d3.select('body')
      .append('div')
      .attr('class', 'map-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('opacity', 0)
      .style('background-color', 'white')
      .style('border', '1px solid #ddd')
      .style('border-radius', '4px')
      .style('padding', '10px')
      .style('box-shadow', '0 2px 10px rgba(0,0,0,0.2)')
      .style('pointer-events', 'none')
      .style('font-size', '12px')
      .style('z-index', 1000);
  }
  
  return tooltip;
};

const CountryMap = ({ metric = 'intensity', fullSize = false }) => {
  const [data, setData] = useState([]);
  const [worldData, setWorldData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState(metric);
  const [countries, setCountries] = useState([]);
  const [pestleOptions, setPestleOptions] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [selectedPestle, setSelectedPestle] = useState('all');
  const [regionData, setRegionData] = useState({});
  const [countryNameMap, setCountryNameMap] = useState({});
  const [countryPestleData, setCountryPestleData] = useState({});
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  
  // Fetch filter options on initial load
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const filters = await api.getFilters();
        setCountries(['all', ...filters.countries.sort()]);
        setPestleOptions(['all', ...filters.pestle.sort()]);
      } catch (err) {
        console.error('Error fetching filter options:', err);
      }
    };
    
    fetchFilterOptions();
  }, []);
  
  // Fetch region data for tooltips
  useEffect(() => {
    const fetchRegionData = async () => {
      try {
        const regions = await api.getRegions();
        // Create a mapping of country to region
        const countryToRegion = {};
        regions.forEach(region => {
          // Get country insights for each region to map countries to regions
          api.getData({ region: region.region })
            .then(data => {
              data.forEach(item => {
                if (item.country && item.region) {
                  countryToRegion[item.country.toLowerCase()] = item.region;
                }
              });
              setRegionData(countryToRegion);
            })
            .catch(err => console.error('Error fetching country data for region:', err));
        });
      } catch (err) {
        console.error('Error fetching region data:', err);
      }
    };
    
    fetchRegionData();
  }, []);

  // Fetch pestle data for each country
  useEffect(() => {
    const fetchCountryPestleData = async () => {
      try {
        // Skip if countries aren't loaded yet
        if (countries.length <= 1) return;
        
        const countryPestleMap = {};
        
        // Create a batch of promises for fetching data for each country
        const fetchPromises = countries
          .filter(country => country !== 'all')
          .map(country => 
            api.getData({ country })
              .then(data => {
                // Count occurrences of each pestle category for this country
                const pestleCounts = {};
                data.forEach(item => {
                  if (item.pestle) {
                    pestleCounts[item.pestle] = (pestleCounts[item.pestle] || 0) + 1;
                  }
                });
                
                // Store in our map with top pestles by count
                countryPestleMap[country.toLowerCase()] = Object.entries(pestleCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([pestle, count]) => ({ pestle, count }));
              })
              .catch(err => {
                console.error(`Error fetching pestle data for ${country}:`, err);
                return null;
              })
          );
        
        // Wait for all fetches to complete
        await Promise.all(fetchPromises);
        setCountryPestleData(countryPestleMap);
      } catch (err) {
        console.error('Error fetching country pestle data:', err);
      }
    };
    
    fetchCountryPestleData();
  }, [countries]);

  // Create a mapping between API country names and topojson country names
  useEffect(() => {
    if (worldData) {
      const countryFeatures = topojson.feature(worldData, worldData.objects.countries).features;
      const nameMap = {};
      
      // For each country in our API data, try to find a match in the topojson
      countries.forEach(apiCountry => {
        if (apiCountry !== 'all') {
          // Try exact match first
          let match = countryFeatures.find(f => 
            f.properties.name.toLowerCase() === apiCountry.toLowerCase()
          );
          
          if (!match) {
            // Try contains match (e.g., "United States" might match "United States of America")
            match = countryFeatures.find(f => 
              f.properties.name.toLowerCase().includes(apiCountry.toLowerCase()) ||
              apiCountry.toLowerCase().includes(f.properties.name.toLowerCase())
            );
          }
          
          if (match) {
            nameMap[apiCountry.toLowerCase()] = match.properties.name;
            // Also store reverse mapping
            nameMap[match.properties.name.toLowerCase()] = apiCountry;
          }
        }
      });
      
      setCountryNameMap(nameMap);
    }
  }, [worldData, countries]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Create filter object with selected filters
        const filters = {};
        if (selectedCountry !== 'all') filters.country = selectedCountry;
        if (selectedPestle !== 'all') filters.pestle = selectedPestle;
        
        // If filter by country is active, we might need different logic
        const isCountryFiltered = selectedCountry !== 'all';
        
        const [topNData, worldTopoJSON] = await Promise.all([
          api.getTopN(selectedMetric, 'country', 50, filters),
          fetch('https://unpkg.com/world-atlas@2.0.2/countries-110m.json').then(res => res.json())
        ]);
        
        setData(topNData);
        setWorldData(worldTopoJSON);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching map data:', err);
        setError('Failed to load map data');
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedMetric, selectedCountry, selectedPestle]);

  useEffect(() => {
    if (data.length > 0 && worldData && !loading) {
      drawMap();
      
      // Add resize listener
      const handleResize = debounce(() => {
        drawMap();
      }, 300);
      
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [data, worldData, loading, regionData, countryNameMap, countryPestleData]);

  const handleMetricChange = (newMetric) => {
    setSelectedMetric(newMetric);
  };
  
  const handleCountryChange = (e) => {
    setSelectedCountry(e.target.value);
  };
  
  const handlePestleChange = (e) => {
    setSelectedPestle(e.target.value);
  };

  const drawMap = () => {
    if (!svgRef.current || !containerRef.current || !worldData) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    // Set dimensions
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = fullSize ? Math.min(600, containerWidth * 0.6) : Math.min(500, containerWidth * 0.6);
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

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

    // Create map projection
    const projection = d3.geoNaturalEarth1()
      .fitSize([width, height], topojson.feature(worldData, worldData.objects.countries));

    // Create path generator
    const path = d3.geoPath().projection(projection);

    // Extract countries data
    const countries = topojson.feature(worldData, worldData.objects.countries).features;

    // Add a background rect for the ocean
    svg.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "#E6F2F5")
      .attr("class", "ocean-background");

    // Create color scale based on metric value
    const colorScale = d3.scaleSequential(
      selectedMetric === 'intensity' ? d3.interpolateBlues :
      selectedMetric === 'likelihood' ? d3.interpolateGreens :
      d3.interpolateOranges
    ).domain([0, d3.max(data, d => d.value) || 10]);

    // Create a map for faster data lookup
    const dataByCountry = {};
    data.forEach(d => {
      const countryLower = d.name.toLowerCase();
      dataByCountry[countryLower] = d;
      
      // Also add mapped name if available
      if (countryNameMap[countryLower]) {
        dataByCountry[countryNameMap[countryLower].toLowerCase()] = d;
      }
    });

    // Handle selected country highlighting
    const selectedCountryData = selectedCountry !== 'all' ? {
      name: selectedCountry,
      topoName: countryNameMap[selectedCountry.toLowerCase()]
    } : null;

    // Draw countries
    svg.selectAll('.country')
      .data(countries)
      .enter()
      .append('path')
      .attr('class', d => {
        let classes = 'country';
        // Add selected class if this is the selected country
        if (selectedCountryData && 
            (d.properties.name === selectedCountryData.name || 
             d.properties.name === selectedCountryData.topoName)) {
          classes += ' selected';
        }
        return classes;
      })
      .attr('d', path)
      .attr('fill', d => {
        // If filtering by country, emphasize the selected country
        if (selectedCountry !== 'all') {
          // Check if this is the selected country
          const isSelected = d.properties.name.toLowerCase() === selectedCountry.toLowerCase() || 
                            (countryNameMap[selectedCountry.toLowerCase()] && 
                             countryNameMap[selectedCountry.toLowerCase()].toLowerCase() === d.properties.name.toLowerCase());
          
          if (!isSelected) {
            return '#d0d0d0'; // Gray out non-selected countries
          }
        }
        
        // Get data for this country
        const countryLower = d.properties.name.toLowerCase();
        const countryData = dataByCountry[countryLower] || 
                          (countryNameMap[countryLower] ? dataByCountry[countryNameMap[countryLower].toLowerCase()] : null);
        
        return countryData ? colorScale(countryData.value) : '#d0d0d0';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', d => {
        // Make selected country's border thicker
        if (selectedCountry !== 'all') {
          const isSelected = d.properties.name.toLowerCase() === selectedCountry.toLowerCase() || 
                            (countryNameMap[selectedCountry.toLowerCase()] && 
                             countryNameMap[selectedCountry.toLowerCase()].toLowerCase() === d.properties.name.toLowerCase());
          return isSelected ? 2 : 0.5;
        }
        return 0.5;
      })
      .on('mouseover', function(event, d) {
        const countryLower = d.properties.name.toLowerCase();
        // Get API country name (if it exists)
        const apiCountryName = countryNameMap[countryLower] || d.properties.name;
        const apiCountryLower = apiCountryName.toLowerCase();
        
        const countryData = dataByCountry[countryLower] || 
                          (countryNameMap[countryLower] ? dataByCountry[countryNameMap[countryLower].toLowerCase()] : null);
        
        const countryName = d.properties.name;
        const regionName = regionData[apiCountryLower] || regionData[countryLower] || 'Unknown Region';
        
        // Get pestle data for this country
        const pestleData = countryPestleData[apiCountryLower] || countryPestleData[countryLower] || [];
        
        d3.select(this)
          .transition()
          .duration(200)
          .attr('stroke', '#333')
          .attr('stroke-width', 1.5);
        
        // Create HTML for the tooltip
        let tooltipHTML = `
          <div class="tooltip-header" style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">${countryName}</div>
          <div class="tooltip-region" style="margin-bottom: 5px;">Region: ${regionName}</div>
          ${countryData 
            ? `<div class="tooltip-content" style="margin-bottom: 5px;">
                <strong>${selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)}:</strong> ${formatNumber(countryData.value)}<br>
                <strong>Count:</strong> ${countryData.count} records
              </div>`
            : '<div class="tooltip-content" style="margin-bottom: 5px;"><i>No data available</i></div>'}
        `;
        
        // Add PESTLE categories if we have them
        if (pestleData.length > 0) {
          tooltipHTML += `<div class="tooltip-pestle" style="margin-top: 8px; border-top: 1px solid rgba(0,0,0,0.1); padding-top: 6px;">
            <div class="tooltip-pestle-header" style="font-weight: 500; margin-bottom: 4px;">Top PESTLE Categories:</div>
            <ul class="tooltip-pestle-list" style="margin: 0; padding-left: 16px;">`;
          
          // Show top 3 pestle categories
          pestleData.slice(0, 3).forEach(item => {
            tooltipHTML += `<li style="margin-bottom: 2px; font-size: 0.9em;">${item.pestle} (${item.count})</li>`;
          });
          
          tooltipHTML += `</ul></div>`;
        }
        
        // Show the tooltip with the HTML content
        tooltipRef.current
          .html(tooltipHTML)
          .style('visibility', 'visible')
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px')
          .transition()
          .duration(200)
          .style('opacity', 1);
      })
      .on('mousemove', function(event) {
        // Update tooltip position as mouse moves
        tooltipRef.current
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('stroke', d => {
            // Keep selected country's border highlighted
            if (selectedCountry !== 'all') {
              const isSelected = d.properties.name.toLowerCase() === selectedCountry.toLowerCase() || 
                                (countryNameMap[selectedCountry.toLowerCase()] && 
                                 countryNameMap[selectedCountry.toLowerCase()].toLowerCase() === d.properties.name.toLowerCase());
              return isSelected ? '#333' : '#fff';
            }
            return '#fff';
          })
          .attr('stroke-width', d => {
            // Keep selected country's border thicker
            if (selectedCountry !== 'all') {
              const isSelected = d.properties.name.toLowerCase() === selectedCountry.toLowerCase() || 
                                (countryNameMap[selectedCountry.toLowerCase()] && 
                                 countryNameMap[selectedCountry.toLowerCase()].toLowerCase() === d.properties.name.toLowerCase());
              return isSelected ? 2 : 0.5;
            }
            return 0.5;
          });
        
        // Hide tooltip
        tooltipRef.current
          .transition()
          .duration(200)
          .style('opacity', 0)
          .on('end', function() {
            tooltipRef.current.style('visibility', 'hidden');
          });
      })
      .on('click', function(event, d) {
        const countryName = d.properties.name;
        
        // Find corresponding API country name (if it exists)
        let apiCountryName = countryName;
        const matchedApiCountry = countryNameMap[countryName.toLowerCase()];
        
        if (matchedApiCountry) {
          apiCountryName = matchedApiCountry;
        }
        
        // Only update if the country exists in our API data
        if (countries.includes(apiCountryName) || countries.includes(countryName)) {
          // If already selected, deselect it
          if (selectedCountry === apiCountryName || selectedCountry === countryName) {
            setSelectedCountry('all');
          } else {
            // Otherwise select the country
            setSelectedCountry(countries.includes(apiCountryName) ? apiCountryName : countryName);
          }
        }
      });

    // Add a gentle zoom effect to the map
    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .on('zoom', (event) => {
        svg.selectAll('path')
          .attr('transform', event.transform);
      });

    d3.select(svgRef.current)
      .call(zoom);

    // Add legend
    const legendWidth = 200;
    const legendHeight = 15;
    const legendPosition = {
      x: width - legendWidth - 10,
      y: height - 40
    };

    // Create gradient for legend
    const defs = svg.append('defs');
    const linearGradient = defs.append('linearGradient')
      .attr('id', `map-color-gradient-${selectedMetric}`)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%');

    linearGradient.selectAll('stop')
      .data([
        {offset: '0%', color: colorScale(0)},
        {offset: '100%', color: colorScale(d3.max(data, d => d.value) || 10)}
      ])
      .enter().append('stop')
      .attr('offset', d => d.offset)
      .attr('stop-color', d => d.color);

    // Draw legend rectangle with rounded corners
    svg.append('rect')
      .attr('x', legendPosition.x)
      .attr('y', legendPosition.y)
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('rx', 4)
      .attr('ry', 4)
      .style('fill', `url(#map-color-gradient-${selectedMetric})`)
      .style('stroke', '#ccc')
      .style('stroke-width', 0.5);

    // Add legend labels
    svg.append('text')
      .attr('x', legendPosition.x)
      .attr('y', legendPosition.y - 5)
      .attr('fill', 'var(--dark-text)')
      .attr('text-anchor', 'start')
      .attr('font-size', '10px')
      .text('Low');

    svg.append('text')
      .attr('x', legendPosition.x + legendWidth)
      .attr('y', legendPosition.y - 5)
      .attr('fill', 'var(--dark-text)')
      .attr('text-anchor', 'end')
      .attr('font-size', '10px')
      .text('High');

    svg.append('text')
      .attr('x', legendPosition.x + legendWidth / 2)
      .attr('y', legendPosition.y + 30)
      .attr('fill', 'var(--dark-text)')
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .text(`${selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)} by Country`);
      
    // Add a subtle pulsing animation to countries with highest values or the selected country
    const countriesToHighlight = selectedCountry !== 'all' 
      ? [selectedCountry.toLowerCase()]
      : data
          .sort((a, b) => b.value - a.value)
          .slice(0, 5)
          .map(d => d.name.toLowerCase());
      
    svg.selectAll('.country')
      .filter(d => {
        const countryLower = d.properties.name.toLowerCase();
        return countriesToHighlight.includes(countryLower) || 
               (countryNameMap[countryLower] && countriesToHighlight.includes(countryNameMap[countryLower].toLowerCase()));
      })
      .each(function() {
        const element = d3.select(this);
        
        // Create pulsing effect
        function repeat() {
          element
            .transition()
            .duration(1000)
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 1)
            .transition()
            .duration(1000)
            .attr('stroke-width', 0.5)
            .attr('stroke-opacity', 0.7)
            .on('end', repeat);
        }
        
        repeat();
      });
  };

  const getColorClass = () => {
    switch(selectedMetric) {
      case 'intensity': return 'intensity-theme';
      case 'likelihood': return 'likelihood-theme';
      case 'relevance': return 'relevance-theme';
      default: return 'intensity-theme';
    }
  };

  const renderFilterControls = () => (
    <div className="filter-controls" style={{ marginBottom: '15px', display: 'flex', gap: '15px' }}>
      <div className="filter-control">
        <label htmlFor="country-filter" style={{ marginRight: '8px', fontWeight: '500' }}>Country:</label>
        <select 
          id="country-filter" 
          value={selectedCountry} 
          onChange={handleCountryChange}
          style={{ 
            padding: '6px 10px', 
            borderRadius: '4px', 
            border: '1px solid #ddd' 
          }}
        >
          {countries.map(country => (
            <option key={country} value={country}>{country === 'all' ? 'All Countries' : country}</option>
          ))}
        </select>
      </div>
      
      <div className="filter-control">
        <label htmlFor="pestle-filter" style={{ marginRight: '8px', fontWeight: '500' }}>PESTLE:</label>
        <select 
          id="pestle-filter" 
          value={selectedPestle} 
          onChange={handlePestleChange}
          style={{ 
            padding: '6px 10px', 
            borderRadius: '4px', 
            border: '1px solid #ddd' 
          }}
        >
          {pestleOptions.map(pestle => (
            <option key={pestle} value={pestle}>{pestle === 'all' ? 'All Categories' : pestle}</option>
          ))}
        </select>
      </div>
    </div>
  );

  const renderActionButtons = () => (
    <div className="chart-actions">
      <button 
        className={`chart-action-btn ${selectedMetric === 'intensity' ? 'active' : ''}`}
        onClick={() => handleMetricChange('intensity')}
      >
        Intensity
      </button>
      <button 
        className={`chart-action-btn ${selectedMetric === 'likelihood' ? 'active' : ''}`}
        onClick={() => handleMetricChange('likelihood')}
      >
        Likelihood
      </button>
      <button 
        className={`chart-action-btn ${selectedMetric === 'relevance' ? 'active' : ''}`}
        onClick={() => handleMetricChange('relevance')}
      >
        Relevance
      </button>
    </div>
  );

  return (
    <CardContainer 
      title={`Global ${selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)} Distribution`}
      actionButtons={renderActionButtons()}
      className={getColorClass()}
    >
      {renderFilterControls()}
      
      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          minHeight: fullSize ? '600px' : '400px',
          maxHeight: fullSize ? '800px' : '500px'
        }}
        className="country-map-container"
      >
        {loading ? (
          <Loader message="Loading map data..." />
        ) : error ? (
          <NoDataMessage message={error} icon="⚠️" />
        ) : data.length === 0 ? (
          <NoDataMessage message="No country data available" />
        ) : (
          <svg 
            ref={svgRef} 
            className={`chart-svg country-map-svg ${getColorClass()}`}
            style={{
              borderRadius: '10px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
            }}
          ></svg>
        )}
      </div>
      
      {!loading && data.length > 0 && (
        <div className="map-instructions">
          <small>Tip: Scroll to zoom, drag to pan, and click on countries for details</small>
        </div>
      )}
      
      {/* Add CSS to ensure the tooltip is visible and well-styled */}
      <style jsx global>{`
        .map-tooltip {
          position: absolute;
          visibility: hidden;
          opacity: 0;
          background-color: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          pointer-events: none;
          font-size: 12px;
          z-index: 1000;
          max-width: 250px;
          transition: opacity 0.2s;
        }
        
        .tooltip-header {
          font-weight: bold;
          font-size: 14px;
          margin-bottom: 5px;
        }
        
        .tooltip-region {
          margin-bottom: 5px;
        }
        
        .tooltip-content {
          margin-bottom: 5px;
        }
        
        .tooltip-pestle {
          margin-top: 8px;
          border-top: 1px solid rgba(0,0,0,0.1);
          padding-top: 6px;
        }
        
        .tooltip-pestle-header {
          font-weight: 500;
          margin-bottom: 4px;
        }
        
        .tooltip-pestle-list {
          margin: 0;
          padding-left: 16px;
        }
        
        .tooltip-pestle-list li {
          margin-bottom: 2px;
          font-size: 0.9em;
        }
        
        .country {
          cursor: pointer;
          transition: stroke 0.2s, fill 0.2s;
        }
        
        .country:hover {
          stroke: #333;
          stroke-width: 1.5px;
        }
      `}</style>
    </CardContainer>
  );
};

export default CountryMap;
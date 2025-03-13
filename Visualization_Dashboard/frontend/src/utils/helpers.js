// Format numbers for display
export const formatNumber = (num) => {
    if (num === null || num === undefined) return 'N/A';
    
    if (num === 0) return '0';
    
    if (Math.abs(num) < 1) {
      return num.toFixed(2);
    }
    
    if (Math.abs(num) >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    
    if (Math.abs(num) >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    
    return num.toFixed(0);
  };
  
  // Generate color scale based on data
  export const generateColorScale = (d3, max, colorRange = ['#e0f7fa', '#006064']) => {
    return d3.scaleLinear()
      .domain([0, max])
      .range(colorRange);
  };
  
  // Generate random color for categories
  export const generateCategoryColors = (d3, categories) => {
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
    
    return categories.reduce((acc, category) => {
      acc[category] = colorScale(category);
      return acc;
    }, {});
  };
  
  // Truncate text to a certain length
  export const truncateText = (text, maxLength = 25) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };
  
  // Clean data by removing null/undefined values
  export const cleanData = (data, requiredFields = []) => {
    if (!data || !Array.isArray(data)) return [];
    
    return data.filter(item => {
      return requiredFields.every(field => {
        const value = item[field];
        return value !== null && value !== undefined && value !== '';
      });
    });
  };
  
  // Create tooltip for D3 charts
  export const createTooltip = (d3) => {
    return d3.select('body')
      .append('div')
      .attr('class', 'd3-tooltip')
      .style('opacity', 0);
  };
  
  // Group data by a specific field
  export const groupDataByField = (data, field) => {
    return data.reduce((acc, item) => {
      const key = item[field] || 'Unknown';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {});
  };
  
  // Calculate percentages for pie charts
  export const calculatePercentages = (data) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    return data.map(item => ({
      ...item,
      percentage: ((item.value / total) * 100).toFixed(1)
    }));
  };
  
  // Get viewport dimensions
  export const getViewportDimensions = () => {
    return {
      width: Math.max(document.documentElement.clientWidth, window.innerWidth || 0),
      height: Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
    };
  };
  
  // Debounce function for resize and other frequent events
  export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };
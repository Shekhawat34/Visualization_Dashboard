import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = {
  // Get all data with optional filters
  getData: async (filters = {}) => {
    try {
      // Remove empty or 'all' filters
      const cleanFilters = Object.entries(filters)
        .reduce((acc, [key, value]) => {
          if (value && value !== 'all') {
            acc[key] = value;
          }
          return acc;
        }, {});
        
      const response = await axios.get(`${API_URL}/data`, { params: cleanFilters });
      return response.data;
    } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
    }
  },

  // Get all filter options
  getFilters: async () => {
    try {
      const response = await axios.get(`${API_URL}/filters`);
      return response.data;
    } catch (error) {
      console.error('Error fetching filters:', error);
      throw error;
    }
  },

  // Get aggregated metrics with optional filters
  getMetrics: async (groupBy = 'year', metric = 'intensity', filters = {}) => {
    try {
      // Clean filters by removing 'all' values
      const cleanFilters = Object.entries(filters)
        .reduce((acc, [key, value]) => {
          if (value && value !== 'all') {
            acc[key] = value;
          }
          return acc;
        }, {});
      
      // Add group_by and metric to params
      const params = { 
        group_by: groupBy, 
        metric,
        ...cleanFilters
      };
      
      const response = await axios.get(`${API_URL}/metrics`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching metrics:', error);
      throw error;
    }
  },

  // Get top N entries with optional filters
  getTopN: async (metric = 'intensity', groupBy = 'country', limit = 10, filters = {}) => {
    try {
      // Clean filters by removing 'all' values
      const cleanFilters = Object.entries(filters)
        .reduce((acc, [key, value]) => {
          if (value && value !== 'all') {
            acc[key] = value;
          }
          return acc;
        }, {});
        
      // Add group_by, metric, and limit to params
      const params = {
        metric,
        group_by: groupBy,
        limit,
        ...cleanFilters
      };
      
      const response = await axios.get(`${API_URL}/topN`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching topN:', error);
      throw error;
    }
  },

  // Get time series data with optional filters
  getTimeseries: async (metric = 'intensity', filters = {}) => {
    try {
      // Clean filters by removing 'all' values
      const cleanFilters = Object.entries(filters)
        .reduce((acc, [key, value]) => {
          if (value && value !== 'all') {
            acc[key] = value;
          }
          return acc;
        }, {});
        
      // Add metric to params
      const params = {
        metric,
        ...cleanFilters
      };
      
      const response = await axios.get(`${API_URL}/timeseries`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching timeseries:', error);
      throw error;
    }
  },

  // Get topic analysis with optional filters
getTopics: async (filters = {}) => {
  try {
    // Clean filters by removing 'all' values but keep 'exact_match' even if it's false
    const cleanFilters = Object.entries(filters)
      .reduce((acc, [key, value]) => {
        if ((value && value !== 'all') || key === 'exact_match') {
          acc[key] = value;
        }
        return acc;
      }, {});
      
    // Log the request for debugging
    console.log("Requesting topics with filters:", cleanFilters);
      
    const response = await axios.get(`${API_URL}/topics`, { params: cleanFilters });
    return response.data;
  } catch (error) {
    console.error('Error fetching topics:', error);
    throw error;
  }
},

  // Get region analysis with optional filters
  getRegions: async (filters = {}) => {
    try {
      // Clean filters by removing 'all' values
      const cleanFilters = Object.entries(filters)
        .reduce((acc, [key, value]) => {
          if (value && value !== 'all') {
            acc[key] = value;
          }
          return acc;
        }, {});
        
      const response = await axios.get(`${API_URL}/regions`, { params: cleanFilters });
      return response.data;
    } catch (error) {
      console.error('Error fetching regions:', error);
      throw error;
    }
  },

  // Get sector analysis with optional filters
  getSectors: async (filters = {}) => {
    try {
      // Clean filters by removing 'all' values
      const cleanFilters = Object.entries(filters)
        .reduce((acc, [key, value]) => {
          if (value && value !== 'all') {
            acc[key] = value;
          }
          return acc;
        }, {});
        
      const response = await axios.get(`${API_URL}/sectors`, { params: cleanFilters });
      return response.data;
    } catch (error) {
      console.error('Error fetching sectors:', error);
      throw error;
    }
  },

  // Get PEST analysis with optional filters
  getPEST: async (filters = {}) => {
    try {
      // Clean filters by removing 'all' values
      const cleanFilters = Object.entries(filters)
        .reduce((acc, [key, value]) => {
          if (value && value !== 'all') {
            acc[key] = value;
          }
          return acc;
        }, {});
        
      const response = await axios.get(`${API_URL}/pest`, { params: cleanFilters });
      return response.data;
    } catch (error) {
      console.error('Error fetching PEST analysis:', error);
      throw error;
    }
  },

  // Get country insights with optional filters
  getCountryInsights: async (country, filters = {}) => {
    try {
      // Clean filters by removing 'all' values
      const cleanFilters = Object.entries(filters)
        .reduce((acc, [key, value]) => {
          if (value && value !== 'all') {
            acc[key] = value;
          }
          return acc;
        }, {});
        
      // Add country to params
      const params = {
        country,
        ...cleanFilters
      };
      
      const response = await axios.get(`${API_URL}/country-insights`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching country insights:', error);
      throw error;
    }
  }
};

export default api;
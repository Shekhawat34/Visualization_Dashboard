import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import CardContainer from './common/CardContainer';
import Loader from './common/Loader';
import NoDataMessage from './common/NoDataMessage';
import api from '../services/api';
import { formatNumber } from '../utils/helpers';
import IntensityChart from './charts/IntensityChart';
import LikelihoodChart from './charts/LikelihoodChart';
import RelevanceChart from './charts/RelevanceChart';

import RegionChart from './charts/RegionChart';
import TopicDistributionChart from './charts/TopicDistributionChart';
import SectorChart from './charts/SectorChart';

import CountryMap from './charts/CountryMap';
import TimeseriesChart from './charts/TimeseriesChart';
import '../styles/Dashboard.css';

const Dashboard = ({ activeFilters }) => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [metrics, setMetrics] = useState({
    totalInsights: 0,
    avgIntensity: 0,
    avgLikelihood: 0,
    avgRelevance: 0
  });
  const [timeseriesData, setTimeseriesData] = useState([]);
  const [topCountries, setTopCountries] = useState([]);
  const [topTopics, setTopTopics] = useState([]);
  const [sectorData, setSectorData] = useState([]);

  const [regionData, setRegionData] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('intensity');
  const [intensityData, setIntensityData] = useState([]);
  const [likelihoodData, setLikelihoodData] = useState([]);
  const [relevanceData, setRelevanceData] = useState([]);

  // Fetch data based on active filters
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch filtered data
        const result = await api.getData(activeFilters);
        setData(result);
        
        // Calculate metrics from data
        if (result.length > 0) {
          const totalInsights = result.length;
          const avgIntensity = result.reduce((sum, item) => sum + (item.intensity || 0), 0) / totalInsights;
          const avgLikelihood = result.reduce((sum, item) => sum + (item.likelihood || 0), 0) / totalInsights;
          const avgRelevance = result.reduce((sum, item) => sum + (item.relevance || 0), 0) / totalInsights;
          
          setMetrics({
            totalInsights,
            avgIntensity,
            avgLikelihood,
            avgRelevance
          });
        }
        
        // Fetch timeseries data
        const timeseriesResult = await api.getTimeseries(selectedMetric);
        setTimeseriesData(timeseriesResult);
        
        // Fetch top countries
        const topCountriesResult = await api.getTopN(selectedMetric, 'country', 10);
        setTopCountries(topCountriesResult);
        
        // Fetch top topics
        const topTopicsResult = await api.getTopN(selectedMetric, 'topic', 10);
        setTopTopics(topTopicsResult);
        
        // Fetch sector data
        const sectorResult = await api.getSectors();
        setSectorData(sectorResult);
        
       
        
        // Fetch region data
        const regionResult = await api.getRegions();
        setRegionData(regionResult);
        
        // Fetch metric-specific data for dedicated charts
        const intensityMetrics = await api.getMetrics('country', 'intensity');
        setIntensityData(intensityMetrics);
        
        const likelihoodMetrics = await api.getMetrics('country', 'likelihood');
        setLikelihoodData(likelihoodMetrics);
        
        const relevanceMetrics = await api.getMetrics('country', 'relevance');
        setRelevanceData(relevanceMetrics);
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setLoading(false);
      }
    };
    
    fetchData();
  }, [activeFilters, selectedMetric]);

  // Handle metric change
  const handleMetricChange = (metric) => {
    setSelectedMetric(metric);
  };

  // Render different view based on current path
  const renderView = () => {
    const path = location.pathname;
    
    if (loading) {
      return <Loader message="Loading dashboard data..." />;
    }

    if (data.length === 0) {
      return <NoDataMessage message="No data available for the selected filters" />;
    }

    // Main dashboard view
    if (path === '/' || path === '/dashboard') {
      return (
        <>
          <div className="dashboard-stats">
            <div className="stat-card">
              <div className="stat-title">Total Insights</div>
              <div className="stat-value">{formatNumber(metrics.totalInsights)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-title">Avg. Intensity</div>
              <div className="stat-value">{formatNumber(metrics.avgIntensity)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-title">Avg. Likelihood</div>
              <div className="stat-value">{formatNumber(metrics.avgLikelihood)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-title">Avg. Relevance</div>
              <div className="stat-value">{formatNumber(metrics.avgRelevance)}</div>
            </div>
          </div>
          
          <div className="full-width-chart">
            <CardContainer 
              title="Insight Over Time" 
              actionButtons={
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
              }
            >
              <TimeseriesChart data={timeseriesData} metric={selectedMetric} />
            </CardContainer>
         
          </div>
          
          <div className="chart-row">
            <CardContainer title="Top Countries">
              <CountryMap data={topCountries} />
            </CardContainer>
            
            <CardContainer title="Top Topics">
              <TopicDistributionChart data={topTopics} />
            </CardContainer>
          </div>
          
          <div className="full-width-chart">
            <CardContainer title="Sector Analysis">
              <SectorChart data={sectorData} />
            </CardContainer>
            
           
          </div>
          
          <div className="full-width-chart">
            <CardContainer title="Region Distribution">
              <RegionChart data={regionData} />
            </CardContainer>
          </div>
        </>
      );
    }
    
    // Metrics view - utilizing the unused charts
    if (path === '/metrics') {
      return (
        <div className="page-content">
          <div className="page-header">
            <h2>Key Metrics Analysis</h2>
          </div>
          
          <div className="chart-row">
            <CardContainer title="Intensity Analysis By Country">
              <IntensityChart data={intensityData} />
            </CardContainer>
            
            <CardContainer title="Likelihood Analysis By Country">
              <LikelihoodChart data={likelihoodData} />
            </CardContainer>
          </div>
          
          <div className="chart-row">
            <CardContainer title="Relevance Analysis By Country">
              <RelevanceChart data={relevanceData} />
            </CardContainer>
            
            <CardContainer title="Metrics Comparison">
              <div className="metrics-tabs">
                <div className="tabs-header">
                  <button 
                    className={`tab-btn ${selectedMetric === 'intensity' ? 'active' : ''}`}
                    onClick={() => handleMetricChange('intensity')}
                  >
                    Intensity
                  </button>
                  <button 
                    className={`tab-btn ${selectedMetric === 'likelihood' ? 'active' : ''}`}
                    onClick={() => handleMetricChange('likelihood')}
                  >
                    Likelihood
                  </button>
                  <button 
                    className={`tab-btn ${selectedMetric === 'relevance' ? 'active' : ''}`}
                    onClick={() => handleMetricChange('relevance')}
                  >
                    Relevance
                  </button>
                </div>
                <div className="tabs-content">
                  {selectedMetric === 'intensity' && <IntensityChart data={intensityData} />}
                  {selectedMetric === 'likelihood' && <LikelihoodChart data={likelihoodData} />}
                  {selectedMetric === 'relevance' && <RelevanceChart data={relevanceData} />}
                </div>
              </div>
            </CardContainer>
          </div>
        </div>
      );
    }
    
    // Topics view
    if (path === '/topics') {
      return (
        <div className="page-content">
          <div className="page-header">
            <h2>Topic Analysis</h2>
          </div>
          
          <CardContainer title="Top Topics by Impact">
            <TopicDistributionChart data={topTopics} fullSize={true} />
          </CardContainer>
          
          <div className="chart-row">
            <CardContainer title="Topic Intensity">
              <IntensityChart data={intensityData.filter(item => item.topic)} filter="topic" />
            </CardContainer>
            
            <CardContainer title="Topic Likelihood">
              <LikelihoodChart data={likelihoodData.filter(item => item.topic)} filter="topic" />
            </CardContainer>
          </div>
        </div>
      );
    }
    
    // Regions view
    if (path === '/regions') {
      return (
        <div className="page-content">
          <div className="page-header">
            <h2>Regional Analysis</h2>
          </div>
          
          <CardContainer title="Regional Distribution">
            <RegionChart data={regionData} />
          </CardContainer>
          
          <CardContainer title="Country Impact Map">
            <CountryMap data={topCountries} fullSize={true} />
          </CardContainer>
          
          <div className="chart-row">
            <CardContainer title="Regional Intensity">
              <IntensityChart data={intensityData.filter(item => item.region)} filter="region" />
            </CardContainer>
            
            <CardContainer title="Regional Relevance">
              <RelevanceChart data={relevanceData.filter(item => item.region)} filter="region" />
            </CardContainer>
          </div>
        </div>
      );
    }
    
    // Sectors view
    if (path === '/sectors') {
      return (
        <div className="page-content">
          <div className="page-header">
            <h2>Sector Analysis</h2>
          </div>
          
          <CardContainer title="Sector Distribution">
            <SectorChart data={sectorData} fullSize={true} />
          </CardContainer>
          
          <div className="chart-row">
            <CardContainer title="Sector Intensity">
              <IntensityChart data={intensityData.filter(item => item.sector)} filter="sector" />
            </CardContainer>
            
            <CardContainer title="Sector Likelihood">
              <LikelihoodChart data={likelihoodData.filter(item => item.sector)} filter="sector" />
            </CardContainer>
          </div>
        </div>
      );
    }
    
   
    // Default fallback
    return <NoDataMessage message="Select a dashboard view from the sidebar" />;
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Global Insights Dashboard</h1>
        <p className="dashboard-description">
          Visualizing global trends and insights across regions, sectors, and time
        </p>
      </div>
      
      {renderView()}
    </div>
  );
};

export default Dashboard;
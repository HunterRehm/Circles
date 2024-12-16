import React, { useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { format, subDays } from 'date-fns';
import axios from 'axios';
import './App.css';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchData, setSearchData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`http://localhost:5000/api/trends?term=${encodeURIComponent(searchTerm)}`);
      setSearchData(response.data);
    } catch (err) {
      setError('Failed to fetch search data. Please try again.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const chartData = {
    labels: Array.from({ length: 5 }, (_, i) => 
      format(subDays(new Date(), 4 - i), 'MMM dd')
    ),
    datasets: searchData ? [
      {
        label: `Search trends for "${searchTerm}"`,
        data: searchData,
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      }
    ] : []
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top'
      },
      title: {
        display: true,
        text: 'Google Search Trends - Last 5 Days'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Hits'
        }
      }
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Google Search Trends Visualizer</h1>
        
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Enter search term..."
            className="search-input"
          />
          <button type="submit" disabled={loading} className="search-button">
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {error && <div className="error-message">{error}</div>}

        {searchData && (
          <div className="chart-container">
            <Line data={chartData} options={chartOptions} />
          </div>
        )}
      </header>
    </div>
  );
}

export default App; 
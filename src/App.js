import React, { useEffect } from 'react';
import Plot from 'react-plotly.js';
import WageVisualization from './WageVisualization';
import './App.css';

function App() {
    useEffect(() => {
        const visualization = new WageVisualization();
    }, []);

    const toggleSidebar = () => {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.toggle('active');
    };

    const closeSidebar = () => {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.remove('active');
    };

    return (
        <div className="container">
            <button className="menu-toggle" onClick={toggleSidebar}>
                ☰
            </button>
            
            <h1>Wisconsin Wage Trends (2017-2023)</h1>
            
            <div className="sidebar">
                <button className="close-menu" onClick={closeSidebar}>
                    ×
                </button>
                <div className="search-section">
                    <h2>Search for an Occupation</h2>
                    <input 
                        type="text"
                        id="occupationSearch"
                        placeholder="Type to search occupations..."
                    />
                    <div id="searchResults" className="search-results"></div>
                </div>
                <div className="inflation-toggle">
                    <input type="checkbox" id="inflationToggle" />
                    <label htmlFor="inflationToggle">Adjust for inflation</label>
                </div>
                <div className="occupation-list">
                    <h2>Available Occupations</h2>
                    <div id="occupationList" className="occupation-grid"></div>
                </div>
            </div>

            <div className="main-content">
                <div id="gridView" className="grid-container">
                    {/* Grid plots will be inserted here */}
                </div>
                
                <div id="detailView" className="detail-view hidden">
                    <div className="detail-header">
                        <button id="backButton">← Back to All Occupations</button>
                        <div className="inflation-toggle-detail">
                            <input type="checkbox" id="inflationToggleDetail" />
                            <label htmlFor="inflationToggleDetail">Adjust for inflation</label>
                        </div>
                    </div>
                    <div id="detailPlot"></div>
                </div>
            </div>
        </div>
    );
}

export default App; 
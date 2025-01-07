import React, { useEffect } from 'react';
import Plot from 'react-plotly.js';
import WageVisualization from './WageVisualization';
import './App.css';

function App() {
    useEffect(() => {
        const visualization = new WageVisualization();

        // Add click handler for main content
        const mainContent = document.querySelector('.main-content');
        const sidebar = document.querySelector('.sidebar');
        
        mainContent.addEventListener('click', (e) => {
            if (sidebar.classList.contains('active')) {
                // Prevent any click events while sidebar is open
                e.preventDefault();
                e.stopPropagation();
                sidebar.classList.remove('active');
                
                // Ensure we're on the grid view
                const detailView = document.getElementById('detailView');
                const gridView = document.getElementById('gridView');
                if (!detailView.classList.contains('hidden')) {
                    detailView.classList.add('hidden');
                    gridView.classList.remove('hidden');
                }
            }
        });
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
            <div className="notification-container"></div>
            <button className="menu-toggle" onClick={toggleSidebar}>
                ☰
            </button>
            
            <h1>Wisconsin Wage Trends (2017-2023)</h1>
            
            <div className="sidebar">
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
                    <div id="statsContainer" className="stats-container">
                        <h2 id="selectedOccupation" className="occupation-title">Select an Occupation</h2>
                        <div className="stat-section">
                            <h3 className="stat-section-title">Percentage Changes</h3>
                            <div className="stat-row">
                                <div className="stat-item">
                                    <div className="stat-label">Total Change</div>
                                    <div id="totalChange" className="stat-value">-</div>
                                </div>
                                <div className="stat-item">
                                    <div className="stat-label">Average Annual Change</div>
                                    <div id="avgChange" className="stat-value">-</div>
                                </div>
                                <div className="stat-item">
                                    <div className="stat-label">Highest Change</div>
                                    <div id="maxChange" className="stat-value">-</div>
                                </div>
                                <div className="stat-item">
                                    <div className="stat-label">Lowest Change</div>
                                    <div id="minChange" className="stat-value">-</div>
                                </div>
                            </div>
                        </div>
                        <div className="stat-section">
                            <h3 className="stat-section-title">Salary Information</h3>
                            <div className="stat-row">
                                <div className="stat-item">
                                    <div className="stat-label">Current Salary</div>
                                    <div id="currentSalary" className="stat-value">-</div>
                                </div>
                                <div className="stat-item">
                                    <div className="stat-label">Average Salary</div>
                                    <div id="avgSalary" className="stat-value">-</div>
                                </div>
                                <div className="stat-item">
                                    <div className="stat-label">Highest Salary</div>
                                    <div id="maxSalary" className="stat-value">-</div>
                                </div>
                                <div className="stat-item">
                                    <div className="stat-label">Lowest Salary</div>
                                    <div id="minSalary" className="stat-value">-</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="view-toggle">
                        <label>
                            <input type="checkbox" id="viewToggle" />
                            Show Raw Salary
                        </label>
                    </div>
                    <div id="plotContainer" className="plot-container">
                        {/* Plot will be inserted here */}
                    </div>
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
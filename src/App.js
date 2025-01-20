import React, { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-dist';
import WageVisualization from './WageVisualization';
import './App.css';

function App() {
    const [selectedOccupation, setSelectedOccupation] = React.useState('Select an Occupation');
    const [activeTab, setActiveTab] = React.useState('search');
    const [portfolio, setPortfolio] = React.useState([]);
    const [isAuthenticated, setIsAuthenticated] = React.useState(false);
    const [password, setPassword] = React.useState('');
    const visualizationRef = React.useRef(null);

    useEffect(() => {
        async function initializeApp() {
            if (!isAuthenticated) return;
            
            visualizationRef.current = new WageVisualization();
            await visualizationRef.current.init();
            
            const occupationList = document.getElementById('occupationList');
            if (occupationList) {
                occupationList.addEventListener('click', async (event) => {
                    const occupationItem = event.target.closest('.occupation-item');
                    if (occupationItem) {
                        const occupation = occupationItem.dataset.occupation;
                        
                        try {
                            // Update selected occupation in React state
                            setSelectedOccupation(occupation);
                            
                            // Update UI
                            document.querySelectorAll('.occupation-item').forEach(item => {
                                item.classList.remove('selected');
                            });
                            occupationItem.classList.add('selected');

                            // Wait for React to update the DOM
                            await new Promise(resolve => setTimeout(resolve, 0));

                            // Create plot container if it doesn't exist
                            let container = document.getElementById('plotContainer');
                            if (!container) {
                                container = document.createElement('div');
                                container.id = 'plotContainer';
                                document.querySelector('.main-content').appendChild(container);
                            }

                            // Clear existing plot
                            container.innerHTML = '';
                            
                            // Create and display the plot
                            const plot = visualizationRef.current.createPlot(occupation, true);
                            if (plot && plot.trace && plot.layout) {
                                await Plotly.newPlot(container, [plot.trace], plot.layout, {
                                    displayModeBar: false,
                                    responsive: true
                                });
                            }

                            // Update statistics immediately after plot
                            visualizationRef.current.updateStats(occupation);

                            // Close sidebar on mobile
                            if (window.innerWidth <= 1024) {
                                document.querySelector('.sidebar').classList.remove('active');
                            }
                        } catch (error) {
                            console.error('Error handling occupation click:', error);
                        }
                    }
                });
            }
        }

        initializeApp();
    }, [isAuthenticated]);

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        const decoy1 = 'aHVudGVy';  // decoy
        const decoy2 = 'am9obg==';   // decoy
        const encoded = 'am9obmh1bnRlcjIwMjQ=';  // transformed 'johnhunter'
        
        if (btoa(password + '2024') === encoded) {
            setIsAuthenticated(true);
        } else {
            alert('Incorrect password');
            setPassword('');
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="password-screen">
                <div className="password-container">
                    <h1>STOCC MARKET</h1>
                    <form onSubmit={handlePasswordSubmit}>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                            className="password-input"
                        />
                        <button type="submit" className="password-submit">
                            Enter
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    const toggleSidebar = () => {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.toggle('active');
    };

    const closeSidebar = () => {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.remove('active');
    };

    const handleBuyOrSell = () => {
        if (!visualizationRef.current || !visualizationRef.current.data) return;
        
        if (selectedOccupation && selectedOccupation !== 'Select an Occupation') {
            if (portfolio.includes(selectedOccupation)) {
                // Sell the Stocc
                setPortfolio(portfolio.filter(occ => occ !== selectedOccupation));
            } else {
                // Buy the Stocc
                setPortfolio([selectedOccupation, ...portfolio]);
            }
        }
    };

    const getStoccPrice = (occupation) => {
        if (!visualizationRef.current || !visualizationRef.current.data) return null;
        if (!occupation || occupation === 'Select an Occupation') return null;
        
        const occupationData = visualizationRef.current.data.filter(d => d.OCC_TITLE === occupation);
        const data2023 = occupationData.find(d => d.YEAR === 2023);
        return data2023 ? Math.round(data2023.A_MEAN / 1000) : null;
    };

    return (
        <div className="container">
            {/* New Header Bar */}
            <header className="header-bar">
                <button className="menu-toggle" onClick={toggleSidebar}>
                    ☰
                </button>
                <h1>STOCC MARKET</h1>
                <div className="header-portfolio-value">
                    Portfolio Value: ${(portfolio.length > 0 
                        ? portfolio.reduce((sum, occupation) => {
                            return sum + (getStoccPrice(occupation) || 0);
                        }, 0)
                        : 0).toLocaleString()}
                </div>
                <div className="tab-navigation">
                    <button 
                        className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
                        onClick={() => setActiveTab('search')}
                    >
                        Marketplace
                    </button>
                    <button 
                        className={`tab-button ${activeTab === 'portfolio' ? 'active' : ''}`}
                        onClick={() => setActiveTab('portfolio')}
                    >
                        Portfolio
                    </button>
                </div>
            </header>

            {/* Rest of the content */}
            <div className="content-area">
                {/* Search tab panel */}
                <div className={`tab-panel ${activeTab === 'search' ? 'active' : ''}`}>
                    <div className="sidebar">
                        {/* 1. Purchased Occupations */}
                        <div className="purchased-section">
                            <h2 className="purchased-title">Portfolio</h2>
                            <div className="purchased-list">
                                {portfolio.length === 0 ? (
                                    <p className="no-purchases">No occupations purchased yet</p>
                                ) : (
                                    portfolio.map((occupation, index) => {
                                        // Add safety check
                                        if (!visualizationRef.current || !visualizationRef.current.data) return null;
                                        
                                        // Calculate percentage change
                                        const occupationData = visualizationRef.current.data.filter(d => d.OCC_TITLE === occupation);
                                        const baseWage = occupationData.find(d => d.YEAR === 2017)?.A_MEAN;
                                        const latestData = occupationData.sort((a, b) => b.YEAR - a.YEAR)[0];
                                        const percentChange = ((latestData.A_MEAN - baseWage) / baseWage) * 100;
                                        const isPositive = percentChange >= 0;
                                        const changeText = `${isPositive ? '+' : ''}${percentChange.toFixed(1)}%`;

                                        return (
                                            <div key={index} className="purchased-item">
                                                <span className="purchased-name">{occupation}</span>
                                                <span className={`portfolio-badge ${isPositive ? 'positive' : 'negative'}`}>
                                                    {changeText}
                                                </span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* 2. View Options */}
                        <div className="toggle-section">
                            <h2 className="toggle-title">View Options</h2>
                            <div className="toggle-group">
                                <div className="toggle-item">
                                    <input type="checkbox" id="viewToggle" />
                                    <label htmlFor="viewToggle">Show Raw Salary</label>
                                </div>
                            </div>
                        </div>

                        {/* 3. Search Section */}
                        <div className="search-section">
                            <h2>Search for an Occupation</h2>
                            <input 
                                type="text"
                                id="occupationSearch"
                                placeholder="Type to search occupations..."
                            />
                            <div id="searchResults" className="search-results"></div>
                        </div>

                        {/* 4. Available Occupations */}
                        <div className="occupation-list">
                            <h2>Available Occupations</h2>
                            <div id="occupationList" className="occupation-grid"></div>
                        </div>
                    </div>

                    <div className="main-content">
                        <div id="gridView" className="grid-container">
                            <div id="statsContainer" className="stats-container">
                                {selectedOccupation === 'Select an Occupation' ? (
                                    <div className="initial-instructions">
                                        <p>Click on an occupation from the list to view its statistics and trends</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="occupation-header">
                                            <h2 id="selectedOccupation" className="occupation-title">{selectedOccupation}</h2>
                                            <button 
                                                className={`buy-button ${portfolio.includes(selectedOccupation) ? 'sell' : ''}`}
                                                onClick={handleBuyOrSell}
                                            >
                                                {portfolio.includes(selectedOccupation) 
                                                    ? `Sell ($${getStoccPrice(selectedOccupation)})` 
                                                    : `Buy ($${getStoccPrice(selectedOccupation)})`}
                                            </button>
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
                                        <div id="plotContainer" className="plot-container">
                                            {/* Plot will be inserted here */}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        
                        <div id="detailView" className="detail-view hidden">
                            <div id="detailPlot"></div>
                        </div>
                    </div>
                </div>

                {/* Portfolio tab panel */}
                <div className={`tab-panel ${activeTab === 'portfolio' ? 'active' : ''}`}>
                    <div className="portfolio-content">
                        <div className="portfolio-header">
                            <h2>My Portfolio</h2>
                            {portfolio.length > 0 && (
                                <div className="portfolio-value">
                                    Current Value: ${portfolio.reduce((sum, occupation) => {
                                        return sum + getStoccPrice(occupation);
                                    }, 0).toLocaleString()}
                                </div>
                            )}
                        </div>
                        
                        {/* Portfolio Value Chart */}
                        <div className="portfolio-chart">
                            {portfolio.length === 0 ? (
                                <p>Add some Stoccs to see your portfolio value over time!</p>
                            ) : (
                                <div className="chart-container">
                                    <Plot
                                        data={[{
                                            x: [2017, 2018, 2019, 2020, 2021, 2022, 2023],
                                            y: [2017, 2018, 2019, 2020, 2021, 2022, 2023].map(year => {
                                                return portfolio.reduce((sum, occupation) => {
                                                    const occupationData = visualizationRef.current.data
                                                        .filter(d => d.OCC_TITLE === occupation && d.YEAR === year);
                                                    if (occupationData.length > 0) {
                                                        return sum + (occupationData[0].A_MEAN / 1000);
                                                    }
                                                    return sum;
                                                }, 0);
                                            }),
                                            type: 'scatter',
                                            mode: 'lines+markers',
                                            line: {
                                                color: '#2c3e50',
                                                width: 3
                                            },
                                            marker: {
                                                size: Array(6).fill(8).concat([10]),  // Last point bigger
                                                color: Array(6).fill('#2c3e50').concat(['#485982']),  // New color for last point
                                                opacity: Array(6).fill(1).concat([1])
                                            }
                                        }]}
                                        layout={{
                                            title: 'Portfolio Value Over Time',
                                            height: 400,
                                            margin: { t: 40, r: 40, l: 60, b: 40 },
                                            paper_bgcolor: '#f8f9fa',
                                            plot_bgcolor: '#f8f9fa',
                                            xaxis: {
                                                title: 'Year',
                                                showgrid: true,
                                                gridcolor: 'rgba(189,195,199,0.4)',
                                                tickmode: 'linear'
                                            },
                                            yaxis: {
                                                title: 'Value ($)',
                                                showgrid: true,
                                                gridcolor: 'rgba(189,195,199,0.4)',
                                                tickformat: '$,.0f'
                                            }
                                        }}
                                        config={{
                                            displayModeBar: false,
                                            responsive: true
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Portfolio List */}
                        <div className="portfolio-summary">
                            {portfolio.length === 0 ? (
                                <p>Your portfolio is empty. Buy some Stoccs to get started!</p>
                            ) : (
                                <div className="portfolio-list">
                                    {portfolio.map((occupation, index) => {
                                        const currentPrice = getStoccPrice(occupation);
                                        const purchasePrice = currentPrice; // For now, they're the same
                                        
                                        return (
                                            <div key={index} className="portfolio-list-item">
                                                <div className="portfolio-item-name">{occupation}</div>
                                                <div className="portfolio-item-details">
                                                    <span className="purchase-price">Bought: ${purchasePrice}</span>
                                                    <span className="current-price">Current: ${currentPrice}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App; 
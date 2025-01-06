import Plotly from 'plotly.js-dist';

class WageVisualization {
    constructor() {
        this.data = null;
        this.inflationData = null;
        this.selectedOccupations = new Set();
        this.occupationPositions = new Map();
        this.nextPosition = 0;
        this.selectedGraph = null;
        this.axisRanges = null;
        
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.setupOccupationList();
        this.renderGridView();
    }

    async loadData() {
        try {
            const years = [2017, 2018, 2019, 2020, 2021, 2022, 2023];
            const data = [];
            
            for (const year of years) {
                try {
                    const response = await fetch(`data/state_M${year}_dl.json`);
                    const yearData = await response.json();
                    
                    // Handle both OCC_GROUP and O_GROUP
                    const wisconsinData = yearData.filter(d => 
                        d.AREA_TITLE && 
                        d.AREA_TITLE.includes('Wisconsin') && 
                        ((d.OCC_GROUP === 'detailed' || d.O_GROUP === 'detailed')) && 
                        d.A_MEAN !== null && 
                        d.A_MEAN !== undefined
                    );
                    
                    // Add year if not present
                    wisconsinData.forEach(d => {
                        if (!d.YEAR) d.YEAR = year;
                    });
                    
                    data.push(...wisconsinData);
                } catch (error) {
                    console.error(`Error loading data for year ${year}:`, error);
                }
            }
            
            this.data = data;
            
            // Load inflation data
            const inflationResponse = await fetch('data/inflation.json');
            const inflationData = await inflationResponse.json();
            this.inflationData = Object.fromEntries(
                inflationData.map(row => [parseInt(row.Year), parseFloat(row.Inflation)])
            );

            this.processOccupations();
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    processOccupations() {
        console.log('Starting processOccupations...');
        const occupationTrends = [];
        const allOccupations = [...new Set(this.data.map(d => d.OCC_TITLE))];
        const isMobile = window.innerWidth <= 1024;
        
        console.log('Unique occupations found:', allOccupations.length);

        for (const occupation of allOccupations) {
            const occupationData = this.data.filter(d => d.OCC_TITLE === occupation);
            if (this.hasCompleteData(occupationData)) {
                try {
                    const trend = this.calculateTrend(occupationData);
                    occupationTrends.push({
                        ...trend,
                        occupation
                    });
                } catch (error) {
                    console.error(`Error calculating trend for ${occupation}:`, error);
                }
            }
        }

        // Only set default occupations if none are selected
        if (this.selectedOccupations.size === 0) {
            // Select top 5 increasing and top 4 decreasing
            const increasing = occupationTrends.filter(t => t.isIncreasing);
            const decreasing = occupationTrends.filter(t => !t.isIncreasing);
            
            increasing.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));
            decreasing.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));

            if (isMobile) {
                // On mobile, only show the top increasing occupation
                const defaultOccupation = increasing[0].occupation;
                this.selectedOccupations.add(defaultOccupation);
                this.occupationPositions.set(defaultOccupation, 0);
                
                // Update the UI to show selected occupation
                const element = document.querySelector(`.occupation-item[data-occupation="${defaultOccupation}"]`);
                if (element) {
                    element.classList.add('selected');
                }
            } else {
                // Desktop behavior remains the same
                const defaultOccupations = [
                    ...increasing.slice(0, 5).map(t => t.occupation),
                    ...decreasing.slice(0, 4).map(t => t.occupation)
                ];

                defaultOccupations.forEach((occ, index) => {
                    this.selectedOccupations.add(occ);
                    this.occupationPositions.set(occ, index);
                });
                this.nextPosition = defaultOccupations.length % 9;
                
                defaultOccupations.forEach(occ => {
                    const element = document.querySelector(`.occupation-item[data-occupation="${occ}"]`);
                    if (element) {
                        element.classList.add('selected');
                    }
                });
            }
        }
    }

    hasCompleteData(occupationData) {
        // Check if we have data for 2017 and at least 3 years with valid mean wages
        return occupationData.length >= 3 && 
               occupationData.some(d => d.YEAR === 2017) &&
               occupationData.every(d => d.A_MEAN !== null && d.A_MEAN !== undefined);
    }

    calculateTrend(occupationData) {
        const baseData = occupationData.find(d => d.YEAR === 2017);
        if (!baseData || !baseData.A_MEAN) {
            throw new Error('No valid 2017 data found');
        }
        
        const baseWage = baseData.A_MEAN;
        const latestData = occupationData
            .filter(d => d.A_MEAN !== null)
            .sort((a, b) => b.YEAR - a.YEAR)[0];
        
        const percentChange = ((latestData.A_MEAN - baseWage) / baseWage) * 100;
        
        return {
            isIncreasing: percentChange > 0,
            percentChange: percentChange
        };
    }

    setupEventListeners() {
        document.getElementById('backButton').onclick = () => {
            this.selectedGraph = null;
            document.getElementById('detailView').classList.add('hidden');
            document.getElementById('gridView').classList.remove('hidden');
            document.body.classList.remove('detail-view-active');
        };

        // Update both inflation toggles to stay in sync
        const gridToggle = document.getElementById('inflationToggle');
        const detailToggle = document.getElementById('inflationToggleDetail');

        gridToggle.onchange = () => {
            detailToggle.checked = gridToggle.checked;
            
            // Use requestAnimationFrame for better performance
            requestAnimationFrame(() => {
                // Update mini plots in batches
                const miniPlots = Array.from(document.querySelectorAll('.mini-plot'));
                const batchSize = 10;
                
                const updateBatch = (startIndex) => {
                    const endIndex = Math.min(startIndex + batchSize, miniPlots.length);
                    
                    for (let i = startIndex; i < endIndex; i++) {
                        const plotDiv = miniPlots[i];
                        const occupation = plotDiv.parentElement.dataset.occupation;
                        if (occupation) {
                            const plot = this.createMiniPlot(occupation);
                            if (plot && plot.trace && plot.layout) {
                                Plotly.newPlot(plotDiv, [plot.trace], plot.layout, {
                                    displayModeBar: false,
                                    staticPlot: true
                                });
                            }
                        }
                    }
                    
                    if (endIndex < miniPlots.length) {
                        requestAnimationFrame(() => updateBatch(endIndex));
                    }
                };
                
                // Start updating in batches
                updateBatch(0);
                
                // Update main plot immediately
                if (this.selectedGraph) {
                    const plot = this.createPlot(this.selectedGraph, true);
                    Plotly.newPlot('detailPlot', [plot.trace], plot.layout);
                } else {
                    this.renderGridView();
                }
            });
        };

        detailToggle.onchange = () => {
            gridToggle.checked = detailToggle.checked;
            if (this.selectedGraph) {
                const plot = this.createPlot(this.selectedGraph, true);
                Plotly.newPlot('detailPlot', [plot.trace], plot.layout);
            }
        };

        // Update search functionality
        const searchInput = document.getElementById('occupationSearch');
        const occupationList = document.getElementById('occupationList');
        let currentMatchCount = 0;  // Add this to track matches
        
        // Move keypress handler outside of input event
        searchInput.onkeypress = (event) => {
            if (event.key === 'Enter' && currentMatchCount === 1) {
                const visibleItem = occupationList.querySelector('.occupation-item:not([style*="display: none"])');
                if (visibleItem && !visibleItem.classList.contains('invalid-data')) {
                    visibleItem.click();
                    searchInput.value = '';
                    // Show all items again
                    occupationList.querySelectorAll('.occupation-item').forEach(item => item.style.display = 'block');
                    const noMatchMessage = occupationList.querySelector('.no-match-message');
                    if (noMatchMessage) noMatchMessage.style.display = 'none';
                }
            }
        };
        
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const occupationItems = occupationList.querySelectorAll('.occupation-item');
            currentMatchCount = 0;  // Reset match count

            occupationItems.forEach(item => {
                const occupation = item.textContent.toLowerCase();
                if (searchTerm === '') {
                    item.style.display = 'block';
                    currentMatchCount++;
                } else if (occupation.includes(searchTerm)) {
                    item.style.display = 'block';
                    currentMatchCount++;
                } else {
                    item.style.display = 'none';
                }
            });

            // Show "no matches" message if needed
            let noMatchMessage = occupationList.querySelector('.no-match-message');
            if (currentMatchCount === 0 && searchTerm !== '') {
                if (!noMatchMessage) {
                    noMatchMessage = document.createElement('div');
                    noMatchMessage.className = 'no-match-message';
                    occupationList.appendChild(noMatchMessage);
                }
                noMatchMessage.textContent = `No occupations match "${searchTerm}"`;
                noMatchMessage.style.display = 'block';
            } else if (noMatchMessage) {
                noMatchMessage.style.display = 'none';
            }
        });

        // Add view toggle handler
        const viewToggle = document.getElementById('viewToggle');
        viewToggle.onchange = () => {
            if (this.selectedGraph) {
                const plot = this.createPlot(this.selectedGraph, true);
                Plotly.newPlot('detailPlot', [plot.trace], plot.layout);
            } else {
                this.renderGridView();
            }
        };
    }

    getTrendColor(occupationData, isInflationAdjusted = false, showRawSalary = false) {
        const baseWage = occupationData.find(d => d.YEAR === 2017).A_MEAN;
        const latestData = occupationData.sort((a, b) => b.YEAR - a.YEAR)[0];
        
        if (showRawSalary) {
            // For raw salary view
            let startWage = baseWage;
            let endWage = latestData.A_MEAN;
            
            if (isInflationAdjusted) {
                endWage = endWage / this.inflationData[latestData.YEAR];
                startWage = startWage / this.inflationData[2017];
            }
            
            return endWage > startWage ? 'green' : 'red';
        } else {
            // For percentage change view
            if (isInflationAdjusted) {
                const inflationFactor = this.inflationData[latestData.YEAR];
                const percentChange = ((latestData.A_MEAN - (baseWage * inflationFactor)) / (baseWage * inflationFactor)) * 100;
                return percentChange > 0 ? 'green' : 'red';
            } else {
                const percentChange = ((latestData.A_MEAN - baseWage) / baseWage) * 100;
                return percentChange > 0 ? 'green' : 'red';
            }
        }
    }

    getPlotLayout(occupation, isDetailView, isInflationAdjusted) {
        const titleSuffix = isInflationAdjusted ? ' (Inflation Adjusted)' : '';
        
        // Get current viewport width and height
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const isMobile = viewportWidth <= 1024;
        
        // Adjust sizes based on viewport
        const plotWidth = isDetailView ? 
            (viewportWidth - 40) : 
            (isMobile ? Math.min(viewportWidth - 30, 500) : Math.min(viewportWidth - 450, 600));  // Reduced to 600px max
        
        const plotHeight = isDetailView ? 
            (viewportHeight - 150) : 
            Math.min(viewportHeight * 0.3, 250);  // Reduced to 250px max height
        
        // Format title with smaller font on mobile
        const formatTitle = (title) => {
            if (!isDetailView) {
                const words = title.split(' ');
                let lines = [''];
                let currentLine = 0;
                
                words.forEach(word => {
                    if ((lines[currentLine] + word).length > (isMobile ? 25 : 20) && lines[currentLine].length > 0) {
                        currentLine++;
                        lines[currentLine] = '';
                    }
                    lines[currentLine] += (lines[currentLine].length > 0 ? ' ' : '') + word;
                });
                
                return lines.join('<br>');
            }
            return title;
        };
        
        return {
            height: plotHeight,
            width: plotWidth,
            autosize: false,
            margin: {
                l: 45,  // Further reduced margins
                r: 25,
                t: 35,
                b: 25
            },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            showlegend: false,
            title: {
                text: isDetailView ? 
                    `${occupation} - Wage Trend${titleSuffix}` :
                    formatTitle(occupation),
                x: 0.5,
                y: 0.95,
                font: {
                    size: 14  // Slightly smaller title
                },
                xanchor: 'center',
                yanchor: 'top'
            },
            xaxis: {
                showgrid: true,
                showticklabels: true,
                showline: true,
                range: [2017, 2023],
                gridcolor: 'rgba(128,128,128,0.1)',
                linecolor: 'rgba(128,128,128,0.3)',
                title: isDetailView ? "Year" : null,
                tickfont: {
                    size: isMobile ? 12 : 10
                }
            },
            yaxis: {
                showgrid: true,
                showticklabels: true,
                showline: true,
                tickformat: '.0f',
                ticksuffix: '%',
                gridcolor: 'rgba(128,128,128,0.1)',
                linecolor: 'rgba(128,128,128,0.3)',
                title: isDetailView ? "% Change from 2017" : null,
                tickfont: {
                    size: isMobile ? 12 : 10
                }
            },
            font: {
                size: isDetailView ? 12 : 8
            }
        };
    }

    createPlot(occupation, isDetailView = false) {
        try {
            const occupationData = this.data.filter(d => d.OCC_TITLE === occupation);
            
            if (!this.hasCompleteData(occupationData)) {
                throw new Error('Insufficient data for plotting');
            }
            
            const baseWage = occupationData.find(d => d.YEAR === 2017).A_MEAN;
            const isInflationAdjusted = isDetailView ? 
                document.getElementById('inflationToggleDetail').checked :
                document.getElementById('inflationToggle').checked;
            const showRawSalary = document.getElementById('viewToggle').checked;

            const trace = {
                x: occupationData.map(d => d.YEAR),
                y: occupationData.map(d => {
                    if (showRawSalary) {
                        // Show raw salary data
                        const wage = d.A_MEAN;
                        if (isInflationAdjusted) {
                            return wage / this.inflationData[d.YEAR];
                        }
                        return wage;
                    } else {
                        // Show percentage change
                        const wage = d.A_MEAN;
                        if (isInflationAdjusted) {
                            const inflationFactor = this.inflationData[d.YEAR];
                            return ((wage - (baseWage * inflationFactor)) / (baseWage * inflationFactor)) * 100;
                        }
                        return ((wage - baseWage) / baseWage) * 100;
                    }
                }),
                mode: 'lines+markers',
                line: {
                    color: this.getTrendColor(occupationData, isInflationAdjusted, showRawSalary),
                    width: isDetailView ? 3 : 2
                },
                marker: {
                    size: isDetailView ? 8 : 4
                }
            };

            const layout = {
                height: 400,
                width: 700,
                autosize: false,
                margin: {
                    l: showRawSalary ? 100 : 80,    // Increase left margin for salary numbers
                    r: 30,
                    t: 50,
                    b: 60
                },
                title: {
                    text: occupation,
                    x: 0.5,
                    y: 0.95,
                    font: { 
                        size: 18,
                        weight: 500
                    }
                },
                xaxis: {
                    showgrid: true,
                    showticklabels: true,
                    showline: true,
                    range: [2017, 2023],
                    gridcolor: 'rgba(128,128,128,0.1)',
                    linecolor: 'rgba(128,128,128,0.3)',
                    tickfont: { size: 14 },
                    title: {
                        text: 'Year',
                        font: { size: 16 },
                        standoff: 15  // Add space between axis and title
                    }
                },
                yaxis: {
                    showgrid: true,
                    showticklabels: true,
                    showline: true,
                    tickformat: showRawSalary ? ',.0f' : '.0f',
                    tickprefix: showRawSalary ? '$' : '',
                    ticksuffix: showRawSalary ? '' : '%',
                    gridcolor: 'rgba(128,128,128,0.1)',
                    linecolor: 'rgba(128,128,128,0.3)',
                    tickfont: { size: 14 },
                    title: {
                        text: showRawSalary ? 'Annual Salary' : '% Change from 2017',
                        font: { size: 16 },
                        standoff: showRawSalary ? 25 : 15  // Increase standoff for salary view
                    },
                    automargin: true  // Add this to help with margin calculations
                }
            };

            return { trace, layout };
        } catch (error) {
            console.error(`Error creating plot for ${occupation}:`, error);
            return null;
        }
    }

    renderGridView() {
        const container = document.getElementById('plotContainer');
        const isMobile = window.innerWidth <= 1024;
        
        if (!container) {
            console.error('Plot container not found');
            return;
        }
        container.innerHTML = '';

        // If we have no selections, show default occupations
        if (this.selectedOccupations.size === 0) {
            this.processOccupations();
        }

        if (this.selectedOccupations.size === 0) {
            container.innerHTML = '<div class="empty-plot">Select an occupation from the menu to view its trend</div>';
            // Clear stats when no occupation is selected
            ['totalChange', 'avgChange', 'maxChange', 'minChange'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = '-';
            });
        } else {
            const occupation = Array.from(this.selectedOccupations)[this.selectedOccupations.size - 1];
            try {
                const plot = this.createPlot(occupation, true);
                if (plot && plot.trace && plot.layout) {
                    Plotly.newPlot(container, [plot.trace], plot.layout, {
                        displayModeBar: false,
                        staticPlot: isMobile,
                        responsive: true
                    });
                    // Update stats after plotting
                    this.updateStats(occupation);
                }
            } catch (error) {
                console.error(`Error creating plot for ${occupation}:`, error);
                container.innerHTML = '<div class="invalid-plot">Error displaying data</div>';
            }
        }
    }

    showDetailView(occupation) {
        // Don't show detail view if sidebar is active
        const sidebar = document.querySelector('.sidebar');
        if (sidebar.classList.contains('active')) {
            return;
        }

        this.selectedGraph = occupation;
        document.getElementById('gridView').classList.add('hidden');
        document.getElementById('detailView').classList.remove('hidden');
        document.body.classList.add('detail-view-active');
        
        const plot = this.createPlot(occupation, true);
        Plotly.newPlot('detailPlot', [plot.trace], plot.layout, {
            displayModeBar: false,
            staticPlot: window.innerWidth <= 1024,
            responsive: true
        });
    }

    setupOccupationList() {
        const occupationList = document.getElementById('occupationList');
        const isMobile = window.innerWidth <= 1024;
        
        // Clear the list first to prevent duplicates
        occupationList.innerHTML = '';
        
        // Get unique occupations and sort them
        const allOccupations = [...new Set(this.data.map(d => d.OCC_TITLE))].sort();

        allOccupations.forEach(occupation => {
            const item = document.createElement('div');
            item.className = 'occupation-item';
            
            // Check if occupation has valid data
            const occupationData = this.data.filter(d => d.OCC_TITLE === occupation);
            const hasValidData = this.hasCompleteData(occupationData);
            
            if (!hasValidData) {
                item.classList.add('invalid-data');
                item.title = 'Insufficient data available';
            }

            // Create container for occupation name
            const nameDiv = document.createElement('div');
            nameDiv.className = 'occupation-name';
            nameDiv.textContent = occupation;
            item.appendChild(nameDiv);

            // Add mini plot for desktop version
            if (!isMobile && hasValidData) {
                const plotDiv = document.createElement('div');
                plotDiv.className = 'mini-plot';
                item.appendChild(plotDiv);

                // Create simplified plot
                const plot = this.createMiniPlot(occupation);
                if (plot && plot.trace && plot.layout) {
                    Plotly.newPlot(plotDiv, [plot.trace], plot.layout, {
                        displayModeBar: false,
                        staticPlot: true
                    });
                }
            }
            
            item.dataset.occupation = occupation;
            
            // Only allow clicking if data is valid
            if (hasValidData) {
                item.onclick = () => this.toggleOccupation(occupation, item);
            }
            
            occupationList.appendChild(item);
        });
    }

    // Add new method for creating mini plots
    createMiniPlot(occupation) {
        try {
            const occupationData = this.data.filter(d => d.OCC_TITLE === occupation);
            const baseWage = occupationData.find(d => d.YEAR === 2017).A_MEAN;
            const isInflationAdjusted = document.getElementById('inflationToggle').checked;
            
            const trace = {
                x: occupationData.map(d => d.YEAR),
                y: occupationData.map(d => {
                    const wage = d.A_MEAN;
                    if (isInflationAdjusted) {
                        const inflationFactor = this.inflationData[d.YEAR];
                        return ((wage - (baseWage * inflationFactor)) / (baseWage * inflationFactor)) * 100;
                    }
                    return ((wage - baseWage) / baseWage) * 100;
                }),
                mode: 'lines',
                line: {
                    color: this.getTrendColor(occupationData, isInflationAdjusted),
                    width: 1
                },
                hoverinfo: 'none'
            };

            const layout = {
                height: 16,
                width: 24,
                margin: { l: 0, r: 0, t: 0, b: 0, pad: 0 },
                xaxis: {
                    visible: false,
                    showgrid: false,
                    fixedrange: true,
                    showline: false
                },
                yaxis: {
                    visible: false,
                    showgrid: false,
                    fixedrange: true,
                    showline: false
                },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                autosize: false
            };

            return { trace, layout };
        } catch (error) {
            console.error(`Error creating mini plot for ${occupation}:`, error);
            return null;
        }
    }

    showNotification(message) {
        const container = document.querySelector('.notification-container');
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        container.appendChild(notification);

        // Remove notification after animation ends
        setTimeout(() => {
            notification.remove();
        }, 2000);
    }

    toggleOccupation(occupation, element) {
        const isMobile = window.innerWidth <= 1024;

        // Clear all existing selections first
        this.selectedOccupations.clear();
        this.occupationPositions.clear();
        
        // Remove 'selected' class from all items
        document.querySelectorAll('.occupation-item').forEach(item => {
            item.classList.remove('selected');
        });

        // Add the new selection
        this.selectedOccupations.add(occupation);
        this.occupationPositions.set(occupation, 0);
        element.classList.add('selected');
        
        // Close sidebar on mobile
        if (isMobile) {
            document.querySelector('.sidebar').classList.remove('active');
        }
        
        // Show notification
        this.showNotification(`Showing "${occupation}"`);
        
        this.renderGridView();
    }

    updateStats(occupation) {
        try {
            const occupationData = this.data.filter(d => d.OCC_TITLE === occupation);
            const isInflationAdjusted = document.getElementById('inflationToggle').checked;
            const baseWage = occupationData.find(d => d.YEAR === 2017).A_MEAN;
            const latestData = occupationData.sort((a, b) => b.YEAR - a.YEAR)[0];
            
            // Calculate total change first
            let totalChange;
            if (isInflationAdjusted) {
                const finalWage = latestData.A_MEAN / this.inflationData[latestData.YEAR];
                const initialWage = baseWage / this.inflationData[2017];
                totalChange = ((finalWage - initialWage) / initialWage) * 100;
            } else {
                totalChange = ((latestData.A_MEAN - baseWage) / baseWage) * 100;
            }

            // Calculate compound annual growth rate (CAGR)
            const numberOfYears = latestData.YEAR - 2017;
            const avgChange = (Math.pow(1 + totalChange/100, 1/numberOfYears) - 1) * 100;

            // Calculate year-over-year changes for max/min
            const changes = [];
            const salaries = [];
            const sortedData = occupationData.sort((a, b) => a.YEAR - b.YEAR);
            
            for (let i = 1; i < sortedData.length; i++) {
                let currentWage = sortedData[i].A_MEAN;
                let previousWage = sortedData[i-1].A_MEAN;
                
                if (isInflationAdjusted) {
                    currentWage = currentWage / this.inflationData[sortedData[i].YEAR];
                    previousWage = previousWage / this.inflationData[sortedData[i-1].YEAR];
                }
                
                const yearChange = ((currentWage - previousWage) / previousWage) * 100;
                changes.push(yearChange);
                salaries.push(currentWage);
            }
            
            // Add first year's salary
            salaries.unshift(isInflationAdjusted ? 
                sortedData[0].A_MEAN / this.inflationData[sortedData[0].YEAR] : 
                sortedData[0].A_MEAN);

            // Calculate salary statistics
            const currentSalary = salaries[salaries.length - 1];
            const avgSalary = salaries.reduce((a, b) => a + b, 0) / salaries.length;
            const maxSalary = Math.max(...salaries);
            const minSalary = Math.min(...salaries);

            const maxChange = Math.max(...changes);
            const minChange = Math.min(...changes);

            // Format values
            const formatPercent = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
            const formatSalary = (value) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
            
            // Update all elements
            const elements = {
                totalChange: [formatPercent, totalChange],
                avgChange: [formatPercent, avgChange],
                maxChange: [formatPercent, maxChange],
                minChange: [formatPercent, minChange],
                currentSalary: [formatSalary, currentSalary],
                avgSalary: [formatSalary, avgSalary],
                maxSalary: [formatSalary, maxSalary],
                minSalary: [formatSalary, minSalary]
            };

            Object.entries(elements).forEach(([id, [formatter, value]]) => {
                const el = document.getElementById(id);
                if (el) {
                    el.textContent = formatter(value);
                    if (id.includes('Change')) {
                        el.className = `stat-value ${value >= 0 ? 'positive' : 'negative'}`;
                    } else {
                        el.className = 'stat-value';
                    }
                }
            });
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }
}

export default WageVisualization; 
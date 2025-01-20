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
        this.usedCodes = new Set();
        
        // Remove init call from constructor
    }

    async init() {
        try {
            // Load data first
            await this.loadData();
            
            // Process occupations after data is loaded
            this.processOccupations();
            
            // Setup UI elements
            this.setupEventListeners();
            
            // Setup occupation list and bind click events
            await this.setupOccupationList();  // Just call this once

            // Set default view toggle state
            const viewToggle = document.getElementById('viewToggle');
            if (viewToggle) {
                viewToggle.checked = true;
            }

            // Remove the badgesInitialized flag since we don't need it anymore
            this.badgesInitialized = false;

            return Promise.resolve();
        } catch (error) {
            console.error('Initialization error:', error);
            throw error;
        }
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
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    processOccupations() {
        console.log('Processing occupations...');
        const occupationTrends = [];
        const allOccupations = [...new Set(this.data.map(d => d.OCC_TITLE))];
        const isMobile = window.innerWidth <= 1024;
        
        console.log('Found occupations:', allOccupations.length);

        for (const occupation of allOccupations) {
            const occupationData = this.data.filter(d => d.OCC_TITLE === occupation);
            if (this.hasCompleteData(occupationData)) {
                try {
                    const trend = this.calculateTrend(occupationData);
                    occupationTrends.push({
                        occupation,
                        ...trend
                    });
                } catch (error) {
                    console.error(`Error calculating trend for ${occupation}:`, error);
                }
            }
        }

        // Sort occupations by trend
        const increasing = occupationTrends.filter(t => t.isIncreasing);
        const decreasing = occupationTrends.filter(t => !t.isIncreasing);
        
        increasing.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));
        decreasing.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));

        // Store processed occupations
        this.processedOccupations = occupationTrends;
        
        return occupationTrends;
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
        // Set view toggle to checked by default
        const viewToggle = document.getElementById('viewToggle');
        if (viewToggle) {
            viewToggle.addEventListener('change', () => {
                const selectedOccupation = Array.from(this.selectedOccupations)[0];
                if (selectedOccupation) {
                    const plot = this.createPlot(selectedOccupation, true);
                    if (plot && plot.trace && plot.layout) {
                        const container = document.getElementById('plotContainer');
                        if (container) {
                            Plotly.newPlot(container, [plot.trace], plot.layout, {
                                displayModeBar: false,
                                responsive: true
                            });
                        }
                    }
                }
            });
        }

        // Search functionality
        const searchInput = document.getElementById('occupationSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase().trim();
                
                // Get all occupation items
                const items = document.querySelectorAll('.occupation-item');
                
                items.forEach(item => {
                    // Get both the code and full title
                    const code = item.querySelector('.occupation-name').textContent.toLowerCase();
                    const fullTitle = item.getAttribute('data-occupation');
                    
                    // Check for matches in either code or full title
                    const isVisible = 
                        code.includes(searchTerm) || 
                        (fullTitle && fullTitle.toLowerCase().includes(searchTerm));
                    
                    // Show/hide the item
                    item.style.display = isVisible ? 'flex' : 'none';
                });
            });
        }
    }

    getTrendColor(occupationData, showRawSalary) {
        const baseWage = occupationData.find(d => d.YEAR === 2017).A_MEAN;
        const latestData = occupationData.sort((a, b) => b.YEAR - a.YEAR)[0];
        
        if (showRawSalary) {
            // For raw salary view
            let startWage = baseWage;
            let endWage = latestData.A_MEAN;
            
            return endWage > startWage ? 'green' : 'red';
        } else {
            // For percentage change view
            const percentChange = ((latestData.A_MEAN - baseWage) / baseWage) * 100;
            return percentChange > 0 ? 'green' : 'red';
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

    createPlot(occupation, isMainPlot = false) {
        try {
            const occupationData = this.data.filter(d => d.OCC_TITLE === occupation);
            const baseWage = occupationData.find(d => d.YEAR === 2017).A_MEAN;
            const showRawSalary = document.getElementById('viewToggle')?.checked;
            
            const trace = {
                x: occupationData.map(d => d.YEAR),
                y: occupationData.map(d => {
                    const wage = d.A_MEAN;
                    if (showRawSalary) {
                        return wage;
                    } else {
                        return ((wage - baseWage) / baseWage) * 100;
                    }
                }),
                mode: 'lines+markers',
                line: {
                    color: this.getTrendColor(occupationData, showRawSalary),
                    width: 2
                },
                marker: {
                    size: 6
                }
            };

            const layout = {
                title: isMainPlot ? '' : occupation,
                height: isMainPlot ? 400 : 200,
                margin: { l: 80, r: 20, t: 30, b: 40 }, // Increased left margin
                xaxis: {
                    title: 'Year',
                    tickmode: 'linear',
                    dtick: 1
                },
                yaxis: {
                    title: showRawSalary ? 'Salary ($)' : 'Change (%)',
                    tickformat: showRawSalary ? '$,.0f' : '.1f',
                    ticksuffix: showRawSalary ? '' : '%',
                    titlefont: { size: 12 },
                    tickfont: { size: 11 },
                    automargin: true  // Add automargin
                },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                showlegend: false
            };

            return { trace, layout };
        } catch (error) {
            console.error(`Error creating plot for ${occupation}:`, error);
            return null;
        }
    }

    // Helper method to calculate percent change
    calculatePercentChange(dataPoint, occupationData) {
        const baseWage = occupationData.find(d => d.YEAR === 2017).A_MEAN;
        return ((dataPoint.A_MEAN - baseWage) / baseWage) * 100;
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
        if (!occupationList) {
            console.error('Occupation list container not found');
            return Promise.resolve();
        }

        occupationList.innerHTML = '';
        
        // Sort occupations alphabetically
        const sortedOccupations = [...this.processedOccupations].sort((a, b) => 
            a.occupation.localeCompare(b.occupation)
        );
        
        // Create all occupation items
        sortedOccupations.forEach(({ occupation }) => {
            const occupationData = this.data.filter(d => d.OCC_TITLE === occupation);
            
            if (this.hasCompleteData(occupationData)) {
                const item = document.createElement('div');
                item.className = 'occupation-item';
                item.setAttribute('data-occupation', occupation);
                
                // Create name span with code
                const nameSpan = document.createElement('span');
                nameSpan.className = 'occupation-name';
                const code = this.generateStoccCode(occupation);
                nameSpan.textContent = code;
                nameSpan.title = occupation;
                item.appendChild(nameSpan);
                
                // Create single badge
                const badge = document.createElement('div');
                badge.className = 'owned-badge unowned';
                
                const statusText = document.createElement('span');
                statusText.className = 'status-text';
                statusText.textContent = 'UNOWNED';
                badge.appendChild(statusText);
                item.appendChild(badge);
                
                const miniPlot = document.createElement('div');
                miniPlot.className = 'mini-plot';
                item.appendChild(miniPlot);
                
                item.onclick = () => this.toggleOccupation(occupation, item);
                occupationList.appendChild(item);

                // Create mini plot
                const plot = this.createMiniPlot(occupation);
                if (plot && plot.trace && plot.layout) {
                    Plotly.newPlot(miniPlot, [plot.trace], plot.layout, {
                        displayModeBar: false,
                        staticPlot: true
                    });
                }
            }
        });

        return Promise.resolve();
    }

    // Add this method to generate Stocc codes
    generateStoccCode(occupation) {
        // Remove common words and special characters
        const cleanName = occupation.replace(/[^a-zA-Z\s]/g, '')
            .replace(/\b(and|the|or|of|in|at|by|for|to|a)\b/gi, '')
            .trim();
        
        // Split into words
        const words = cleanName.split(/\s+/);
        
        let code;
        if (words.length >= 3) {
            // Use first two letters of first word and first letter of next two words
            code = (words[0].substring(0, 2) + words[1][0] + words[2][0]).toUpperCase();
        } else if (words.length === 2) {
            // Use first three letters of first word and first letter of second word
            code = (words[0].substring(0, 3) + words[1][0]).toUpperCase();
        } else {
            // Use first four letters of single word
            code = words[0].substring(0, 4).toUpperCase();
        }
        
        // Add a number if code is not unique
        if (this.usedCodes && this.usedCodes.has(code)) {
            let counter = 2;
            let newCode = `${code}${counter}`;
            while (this.usedCodes.has(newCode)) {
                counter++;
                newCode = `${code}${counter}`;
            }
            code = newCode;
        }
        
        // Initialize usedCodes if not exists and add new code
        if (!this.usedCodes) {
            this.usedCodes = new Set();
        }
        this.usedCodes.add(code);
        
        return code;
    }

    // Add new method for creating mini plots
    createMiniPlot(occupation) {
        try {
            const occupationData = this.data.filter(d => d.OCC_TITLE === occupation);
            const baseWage = occupationData.find(d => d.YEAR === 2017).A_MEAN;
            
            const trace = {
                x: occupationData.map(d => d.YEAR),
                y: occupationData.map(d => {
                    const wage = d.A_MEAN;
                    return ((wage - baseWage) / baseWage) * 100;
                }),
                mode: 'lines',
                line: {
                    color: this.getTrendColor(occupationData, false),
                    width: 1
                },
                hoverinfo: 'none'
            };

            const layout = {
                height: 32,  // Reduced from 40 to match CSS
                width: 48,
                margin: { l: 0, r: 0, t: 0, b: 0, pad: 0 },
                xaxis: {
                    visible: false,
                    showgrid: false,
                    fixedrange: true,
                    showline: false,
                    range: [2017, 2023]
                },
                yaxis: {
                    visible: false,
                    showgrid: false,
                    fixedrange: true,
                    showline: false,
                    range: [-50, 50]
                },
                paper_bgcolor: 'white',
                plot_bgcolor: 'white',
                autosize: false
            };

            return { trace, layout };
        } catch (error) {
            console.error(`Error creating mini plot for ${occupation}:`, error);
            return null;
        }
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
        this.selectedGraph = occupation;
        this.occupationPositions.set(occupation, 0);
        element.classList.add('selected');
        
        // Close sidebar on mobile
        if (isMobile) {
            document.querySelector('.sidebar').classList.remove('active');
        }

        // Create and display the plot
        const plot = this.createPlot(occupation, true);
        if (plot && plot.trace && plot.layout) {
            const container = document.getElementById('plotContainer');
            if (container) {
                Plotly.newPlot(container, [plot.trace], plot.layout, {
                    displayModeBar: false,
                    staticPlot: isMobile,
                    responsive: true
                });
            }
        }

        // Update statistics
        this.updateStats(occupation);
    }

    updateStats(occupation) {
        try {
            const occupationData = this.data.filter(d => d.OCC_TITLE === occupation);
            const baseWage = occupationData.find(d => d.YEAR === 2017).A_MEAN;
            const latestData = occupationData.sort((a, b) => b.YEAR - a.YEAR)[0];
            
            // Calculate salary statistics
            const currentSalary = latestData.A_MEAN;
            const avgSalary = occupationData.reduce((sum, d) => sum + d.A_MEAN, 0) / occupationData.length;
            const maxSalary = Math.max(...occupationData.map(d => d.A_MEAN));
            const minSalary = Math.min(...occupationData.map(d => d.A_MEAN));

            // Format and update DOM elements
            const formatSalary = (value) => `$${Math.round(value).toLocaleString()}`;
            
            const elements = {
                currentSalary: formatSalary(currentSalary),
                avgSalary: formatSalary(avgSalary),
                maxSalary: formatSalary(maxSalary),
                minSalary: formatSalary(minSalary)
            };

            // Update each stat element
            Object.entries(elements).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = value;
                }
            });

        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }
}

export default WageVisualization; 
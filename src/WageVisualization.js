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

            const defaultOccupations = [
                ...increasing.slice(0, 5).map(t => t.occupation),
                ...decreasing.slice(0, 4).map(t => t.occupation)
            ];

            // Add default occupations to the Set and assign positions
            defaultOccupations.forEach((occ, index) => {
                this.selectedOccupations.add(occ);
                this.occupationPositions.set(occ, index);
            });
            this.nextPosition = defaultOccupations.length % 9;
            
            // Update the UI
            defaultOccupations.forEach(occ => {
                const element = document.querySelector(`.occupation-item[data-occupation="${occ}"]`);
                if (element) {
                    element.classList.add('selected');
                }
            });
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
            if (this.selectedGraph) {
                const plot = this.createPlot(this.selectedGraph, true);
                Plotly.newPlot('detailPlot', [plot.trace], plot.layout);
            } else {
                this.renderGridView();
            }
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
    }

    getTrendColor(occupationData, isInflationAdjusted = false) {
        const baseWage = occupationData.find(d => d.YEAR === 2017).A_MEAN;
        const latestData = occupationData.sort((a, b) => b.YEAR - a.YEAR)[0];
        
        // Calculate the percentage change for the latest point
        if (isInflationAdjusted) {
            const inflationFactor = this.inflationData[latestData.YEAR];
            const percentChange = ((latestData.A_MEAN - (baseWage * inflationFactor)) / (baseWage * inflationFactor)) * 100;
            return percentChange > 0 ? 'green' : 'red';
        } else {
            const percentChange = ((latestData.A_MEAN - baseWage) / baseWage) * 100;
            return percentChange > 0 ? 'green' : 'red';
        }
    }

    getPlotLayout(occupation, isDetailView, isInflationAdjusted) {
        const titleSuffix = isInflationAdjusted ? ' (Inflation Adjusted)' : '';
        
        // Get current viewport width
        const viewportWidth = window.innerWidth;
        const isMobile = viewportWidth <= 1024;
        
        // Adjust sizes based on viewport
        const plotWidth = isDetailView ? 
            (viewportWidth - 40) : 
            (isMobile ? Math.min(viewportWidth - 30, 500) : 220);
        
        const plotHeight = isDetailView ? 
            (window.innerHeight - 150) : 
            (isMobile ? 250 : 200);

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
            autosize: true,
            margin: isDetailView ? 
                {l: 80, r: 40, t: 60, b: 60} : 
                {l: 35, r: 15, t: isMobile ? 70 : 80, b: 25},
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
                    size: isDetailView ? 16 : (isMobile ? 13 : 11)
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
                mode: 'lines+markers',
                line: {
                    color: this.getTrendColor(occupationData, isInflationAdjusted),
                    width: isDetailView ? 3 : 2
                },
                marker: {
                    size: isDetailView ? 8 : 4
                }
            };

            const layout = this.getPlotLayout(occupation, isDetailView, isInflationAdjusted);
            return { trace, layout };
        } catch (error) {
            console.error(`Error creating plot for ${occupation}:`, error);
            return null;
        }
    }

    renderGridView() {
        const container = document.getElementById('gridView');
        if (!container) {
            console.error('Grid container not found');
            return;
        }
        container.innerHTML = '';

        // Create a fixed 3x3 grid
        const gridSize = 9;
        
        // If we have no selections, show default occupations
        if (this.selectedOccupations.size === 0) {
            this.processOccupations();
        }

        // Create array of 9 positions, fill with occupations or null
        const gridOccupations = new Array(gridSize).fill(null);
        
        // Place occupations in their assigned positions
        for (const [occupation, position] of this.occupationPositions.entries()) {
            if (position < gridSize) {
                gridOccupations[position] = occupation;
            }
        }

        // Create all 9 grid cells
        for (let i = 0; i < gridSize; i++) {
            const plotContainer = document.createElement('div');
            plotContainer.className = 'plot-container';
            
            const occupation = gridOccupations[i];
            if (occupation) {
                try {
                    const occupationData = this.data.filter(d => d.OCC_TITLE === occupation);
                    if (!this.hasCompleteData(occupationData)) {
                        plotContainer.innerHTML = '<div class="invalid-plot">Insufficient data available for this occupation</div>';
                    } else {
                        const plot = this.createPlot(occupation);
                        if (plot && plot.trace && plot.layout) {
                            Plotly.newPlot(plotContainer, [plot.trace], plot.layout, {
                                displayModeBar: false,
                                staticPlot: true,
                                responsive: true
                            })
                                .then(() => {
                                    const button = document.createElement('button');
                                    button.className = 'view-details';
                                    button.textContent = 'View Details';
                                    button.onclick = () => this.showDetailView(occupation);
                                    plotContainer.appendChild(button);
                                })
                                .catch(err => console.error('Plot creation error:', err));
                        }
                    }
                } catch (error) {
                    console.error(`Error creating plot for ${occupation}:`, error);
                    plotContainer.innerHTML = '<div class="invalid-plot">Error displaying data</div>';
                }
            } else {
                plotContainer.innerHTML = '<div class="empty-plot">Select an occupation</div>';
            }
            
            container.appendChild(plotContainer);
        }
    }

    showDetailView(occupation) {
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
            
            item.textContent = occupation;
            item.dataset.occupation = occupation;
            
            // Only allow clicking if data is valid
            if (hasValidData) {
                item.onclick = () => this.toggleOccupation(occupation, item);
            }
            
            occupationList.appendChild(item);
        });
    }

    toggleOccupation(occupation, element) {
        if (this.selectedOccupations.has(occupation)) {
            // Remove the occupation if it's already selected
            this.selectedOccupations.delete(occupation);
            const removedPosition = this.occupationPositions.get(occupation);
            this.occupationPositions.delete(occupation);
            element.classList.remove('selected');
            
            // Update nextPosition to fill this gap next time
            if (removedPosition !== undefined) {
                this.nextPosition = removedPosition;
            }
        } else {
            // If we already have 9 selections, remove the occupation at nextPosition
            if (this.selectedOccupations.size >= 9) {
                // Find occupation at the position we want to replace
                let occupationToRemove;
                for (const [occ, pos] of this.occupationPositions.entries()) {
                    if (pos === this.nextPosition) {
                        occupationToRemove = occ;
                        break;
                    }
                }

                if (occupationToRemove) {
                    this.selectedOccupations.delete(occupationToRemove);
                    this.occupationPositions.delete(occupationToRemove);
                    
                    // Remove selected class from the old element
                    const oldElement = document.querySelector(`.occupation-item[data-occupation="${occupationToRemove}"]`);
                    if (oldElement) {
                        oldElement.classList.remove('selected');
                    }
                }
            } else {
                // Find the first empty position if there are gaps
                const usedPositions = new Set(this.occupationPositions.values());
                for (let i = 0; i < 9; i++) {
                    if (!usedPositions.has(i)) {
                        this.nextPosition = i;
                        break;
                    }
                }
            }
            
            // Add the new occupation at the next position
            this.selectedOccupations.add(occupation);
            this.occupationPositions.set(occupation, this.nextPosition);
            element.classList.add('selected');
            
            // Update next position (cycle through 0-8)
            this.nextPosition = (this.nextPosition + 1) % 9;
            
            // Find next available position
            const usedPositions = new Set(this.occupationPositions.values());
            while (usedPositions.has(this.nextPosition) && usedPositions.size < 9) {
                this.nextPosition = (this.nextPosition + 1) % 9;
            }
        }
        this.renderGridView();
    }
}

export default WageVisualization; 
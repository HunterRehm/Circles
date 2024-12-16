function searchJobs() {
    const keyword = document.getElementById('keyword').value;
    console.log(`Starting job search for keyword: ${keyword}`);

    if (!keyword) {
        console.warn('Search attempted with empty keyword');
        alert('Please enter a job position');
        return;
    }

    // Show loading message
    document.getElementById('loading').style.display = 'block';
    console.log('Loading indicator displayed');
    
    // Clear previous plot
    document.getElementById('plot').innerHTML = '';
    console.log('Cleared previous plot');

    console.log('Sending search request to server...');
    fetch('/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keyword: keyword })
    })
    .then(response => {
        console.log(`Server responded with status: ${response.status}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Received data from server:', data);
        document.getElementById('loading').style.display = 'none';

        // Create the line plot
        const trace = {
            x: data.dates,
            y: data.counts,
            type: 'scatter',
            mode: 'lines+markers',
            line: {
                color: '#4CAF50',
                width: 2
            },
            marker: {
                size: 8,
                color: '#4CAF50'
            }
        };

        const layout = {
            title: `Job Postings for "${keyword}" Over Last 5 Days`,
            xaxis: {
                title: 'Date',
                tickangle: -45
            },
            yaxis: {
                title: 'Number of Job Postings'
            },
            hovermode: 'closest',
            showlegend: false
        };

        const config = {
            responsive: true,
            displayModeBar: false
        };

        console.log('Creating plot with data:', trace);
        Plotly.newPlot('plot', [trace], layout, config)
            .then(() => console.log('Plot created successfully'))
            .catch(err => console.error('Error creating plot:', err));
    })
    .catch(error => {
        console.error('Error during job search:', error);
        document.getElementById('loading').style.display = 'none';
        alert('An error occurred while searching for jobs');
    });
}

// Add event listener for Enter key
document.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded, setting up event listeners');
    const input = document.getElementById('keyword');
    input.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            console.log('Enter key pressed, triggering search');
            searchJobs();
        }
    });
}); 
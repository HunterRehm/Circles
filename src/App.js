import React from 'react';
import Plot from 'react-plotly.js';
import './App.css';

function App() {
  // Mock data for one occupation
  const sampleData = {
    years: [2019, 2020, 2021, 2022, 2023],
    wages: [50000, 52000, 54000, 56000, 58000],
    occupation: "Software Developer"
  };

  const createPlot = () => {
    const isIncreasing = sampleData.wages[sampleData.wages.length - 1] > sampleData.wages[0];
    const percentChange = (
      ((sampleData.wages[sampleData.wages.length - 1] - sampleData.wages[0]) / 
      sampleData.wages[0]) * 100
    ).toFixed(1);

    return (
      <div className="plot-container">
        <Plot
          data={[{
            x: sampleData.years,
            y: sampleData.wages,
            type: 'scatter',
            mode: 'lines+markers',
            line: { color: isIncreasing ? 'green' : 'red', width: 2 },
            marker: { size: 4 }
          }]}
          layout={{
            height: 300,
            width: 400,
            title: sampleData.occupation,
            xaxis: {
              range: [2018, 2023],
              title: 'Year'
            },
            yaxis: {
              title: 'Annual Wage ($)',
              tickformat: '$,.0f'
            }
          }}
          config={{ displayModeBar: false }}
        />
        <div className="trend-info" style={{ color: isIncreasing ? 'green' : 'red' }}>
          {percentChange}% change from 2019 to 2023
        </div>
      </div>
    );
  };

  return (
    <div className="App">
      <h1>Wisconsin Wage Trends</h1>
      {createPlot()}
    </div>
  );
}

export default App; 
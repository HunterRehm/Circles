const express = require('express');
const cors = require('cors');
const googleTrends = require('google-trends-api');
const { subDays } = require('date-fns');

const app = express();
app.use(cors());

app.get('/api/trends', async (req, res) => {
  try {
    const { term } = req.query;
    if (!term) {
      return res.status(400).json({ error: 'Search term is required' });
    }

    const endDate = new Date();
    const startDate = subDays(endDate, 5);

    const results = await googleTrends.interestOverTime({
      keyword: term,
      startTime: startDate,
      endTime: endDate,
    });

    const data = JSON.parse(results);
    const timelineData = data.default.timelineData;
    
    // Extract the values for each day
    const values = timelineData.map(point => point.value[0]);

    res.json(values);
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({ error: 'Failed to fetch trends data' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
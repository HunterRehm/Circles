from flask import Flask, render_template, request, jsonify
import requests
from datetime import datetime, timedelta
import logging
import os
from bs4 import BeautifulSoup
import re
import time

# Set up logging configuration
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)

def search_google_for_date(keyword, date):
    logger.debug(f"Searching Google for keyword: {keyword}, date: {date}")
    
    try:
        # Format the search URL with specific date
        formatted_date = date.strftime('%m/%d/%Y')
        url = f"https://www.google.com/search?q={keyword}&tbs=cdr:1,cd_min:{formatted_date},cd_max:{formatted_date}"
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        }
        
        response = requests.get(url, headers=headers)
        logger.debug(f"Response status code: {response.status_code}")
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            result_stats = soup.find('div', {'id': 'result-stats'})
            
            if result_stats:
                stats_text = result_stats.text
                number = re.search(r'[\d,]+', stats_text)
                if number:
                    count = int(number.group().replace(',', ''))
                    logger.debug(f"Found {count} results for {formatted_date}")
                    return count
            
            logger.warning("Could not find result stats")
            return 0
            
        else:
            logger.error(f"Request failed with status code: {response.status_code}")
            return 0
            
    except Exception as e:
        logger.error(f"Error searching Google: {str(e)}", exc_info=True)
        return 0

@app.route('/')
def home():
    logger.debug("Serving home page")
    return render_template('index.html')

@app.route('/search', methods=['POST'])
def search():
    keyword = request.json.get('keyword', '')
    logger.info(f"Received search request for keyword: {keyword}")
    
    try:
        # Get data for the last 5 days
        dates = []
        counts = []
        today = datetime.now()
        
        for i in range(4, -1, -1):  # 4 to 0, to get last 5 days
            date = today - timedelta(days=i)
            count = search_google_for_date(keyword, date)
            dates.append(date.strftime('%Y-%m-%d'))
            counts.append(count)
            # Add a small delay between requests
            time.sleep(1)
        
        response_data = {
            'dates': dates,
            'counts': counts
        }
        
        logger.info(f"Search results: {response_data}")
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error in search endpoint: {str(e)}", exc_info=True)
        return jsonify({'error': 'An error occurred during the search'}), 500

if __name__ == '__main__':
    app.run(debug=True) 
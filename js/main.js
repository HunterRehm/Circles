// Update the fetch URL to use the Netlify function
fetch('/.netlify/functions/app/search', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ keyword: keyword })
}) 
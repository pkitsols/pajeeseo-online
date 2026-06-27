const express = require('express');
const axios = require('axios');
const app = express();

app.get('/api/proxy', async (req, res) => {
    const { action, url, keyword, strategy, country, lang } = req.query;
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // API Keys yahan se environment variables se uthayega
    const PS_KEY = process.env.PAGESPEED_API_KEY;
    const CSE_KEY = process.env.GOOGLE_CSE_API_KEY;
    const CSE_ID = process.env.GOOGLE_CSE_ID;

    try {
        if (action === 'pagespeed') {
            const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy || 'mobile'}&key=${PS_KEY}`;
            const response = await axios.get(api);
            return res.json({ ok: true, data: response.data });
        }
        if (action === 'serp') {
            const api = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(keyword)}&cx=${CSE_ID}&key=${CSE_KEY}`;
            const response = await axios.get(api);
            return res.json({ ok: true, items: response.data.items || [] });
        }
        res.json({ ok: true, message: 'Backend active' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = app;
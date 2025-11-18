import express from 'express';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 8787;

// IMPORTANT: Ensure this is the correct Ollama Cloud base. If the provider expects
// OpenAI-style messages, confirm their docs. This file streams NDJSON through.
const OLLAMA_API_BASE = 'https://ollama.com'; // or https://api.ollama.com
const OLLAMA_API_KEY = '7a28794bb4ec4e8fa995444260f47bcb.XtrVZQAOVmZr3YXgApwekkP5';

app.use(express.json({ limit: '1mb' }));

// Simple CORS for local dev (no cors package)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// POST /api/chat -> Ollama Cloud
app.post('/api/chat', async (req, res) => {
    try {
        const response = await fetch(`${OLLAMA_API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OLLAMA_API_KEY}`,
        },
        body: JSON.stringify(req.body),
        });

        if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({
            error: `Ollama API Error: ${response.status} - ${text}`,
        });
        }

        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        // Pipe Node stream directly
        response.body.on('data', (chunk) => {
        res.write(chunk);
        });

        response.body.on('end', () => {
        res.end();
        });

        response.body.on('error', (err) => {
        console.error('Stream error from Ollama:', err);
        res.end();
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err?.message || 'Server error' });
    }
    });

    // GET /api/tags -> Ollama Cloud
    app.get('/api/tags', async (req, res) => {
    try {
        const response = await fetch(`${OLLAMA_API_BASE}/api/tags`, {
        headers: {
            'Authorization': `Bearer ${OLLAMA_API_KEY}`,
        },
        });

        if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({
            error: `Ollama API Error: ${response.status} - ${text}`,
        });
        }

        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err?.message || 'Server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Proxy server running at http://localhost:${PORT}`);
    console.log(`Forwarding to Ollama Cloud at ${OLLAMA_API_BASE}`);
});
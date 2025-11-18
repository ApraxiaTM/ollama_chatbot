// api/chat.js - Vercel Serverless Function (chat proxy)
const OLLAMA_API_BASE = 'https://ollama.com'; // or the cloud base URL
const OLLAMA_API_KEY = '7a28794bb4ec4e8fa995444260f47bcb.XtrVZQAOVmZr3YXgApwekkP5';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

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
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(response.status).json({
            error: `Ollama API Error: ${response.status} - ${text}`,
        });
        }

        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Pipe Node stream directly to response
        response.body.on('data', (chunk) => res.write(chunk));
        response.body.on('end', () => res.end());
        response.body.on('error', (err) => {
        console.error('Stream error from Ollama:', err);
        res.end();
        });

    } catch (err) {
        console.error('Chat API Error:', err);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(500).json({ error: err?.message || 'Server error' });
    }
}
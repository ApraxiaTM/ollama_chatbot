import express from 'express';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 8787;

const OLLAMA_API_BASE = 'https://ollama.com';
const OLLAMA_API_KEY = '7a28794bb4ec4e8fa995444260f47bcb.XtrVZQAOVmZr3YXgApwekkP5';

app.use(express.json({ limit: '1mb' }));

// CORS middleware
app.use((req, res, next) => {
  const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Enhanced chat endpoint with better error handling
app.post('/api/chat', async (req, res) => {
  try {
    console.log('Forwarding to Ollama Cloud...');
    
    const response = await fetch(`${OLLAMA_API_BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OLLAMA_API_KEY}`,
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ollama API error:', response.status, errorText);
      return res.status(response.status).json({
        error: `Ollama API Error: ${response.status}`,
        details: errorText
      });
    }

    // Set appropriate headers for streaming
    res.writeHead(200, {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Pipe the stream
    response.body.pipe(res);

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Models endpoint
app.get('/api/tags', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_API_BASE}/api/tags`, {
      headers: {
        'Authorization': `Bearer ${OLLAMA_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Ollama API returned ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ 
      error: 'Failed to fetch models',
      message: error.message 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 SGU Chat Proxy running on http://localhost:${PORT}`);
  console.log(`📡 Forwarding to: ${OLLAMA_API_BASE}`);
});
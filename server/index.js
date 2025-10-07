import cors from 'cors';
import express from 'express';
import ollama from 'ollama';

const app = express();
const PORT = process.env.PORT || 8787;

// CORS for local dev (Vite runs on 5173 by default)
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

// POST /api/chat
app.post('/api/chat', async (req, res) => {
    try {
        const { model = 'llama3', system, messages = [], temperature = 0.7, stream = true } = req.body;

        // Transform messages for ollama.chat
        const finalMessages = [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages
        ];

        if (!stream) {
        const response = await ollama.chat({
            model,
            messages: finalMessages,
            options: { temperature }
        });
        return res.status(200).json(response);
        }

        // Streaming response as NDJSON
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        const streamResult = await ollama.chat({
        model,
        messages: finalMessages,
        options: { temperature },
        stream: true
        });

        for await (const part of streamResult) {
        // part looks like: { message: { role, content }, done: false/true, ... }
        res.write(JSON.stringify(part) + '\n');
        }

        res.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err?.message || 'Server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Ollama proxy server running at http://localhost:${PORT}`);
    console.log(`Make sure Ollama is running locally (ollama serve) and llama3 is pulled.`);
});
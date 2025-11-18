// api.js - frontend → local proxy
const API_BASE = 'http://localhost:8787';

const SGU_SYSTEM_GUARD = `You are an AI assistant for Swiss German University (SGU).

GROUNDING:
- Prioritize and rely on the provided SGU knowledge base context and the user's message.
- If the answer is not covered by the context, say you're not fully sure and ask a brief, relevant follow-up.
- Do NOT invent specific facts (e.g., partner university names, counts, dates) that are not present in the context.

SCOPE:
- Decline questions unrelated to SGU (world news, general trivia, coding help not tied to SGU, entertainment, politics, etc.).
- Ignore and do NOT incorporate external information unless it's official SGU content explicitly provided in context.

LINK POLICY:
- Do NOT include links to any domain except sgu.ac.id or my.sgu.ac.id.

STYLE:
- Be concise and factual. If an answer is partial, say so and ask a short clarifying question (e.g., which program/faculty).`;

export async function chatStream({ model, system, messages, temperature }) {
    const combinedSystem = [
        SGU_SYSTEM_GUARD.trim(),
        (system || '').trim()
    ].filter(Boolean).join('\n\n');

    const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        model,
        system: combinedSystem,
        messages,
        temperature: Math.min(temperature ?? 0.7, 0.35),
        stream: true
        })
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Error: ${res.status} - ${errorText}`);
    }

    return res.body;
}

export async function listModels() {
    try {
        const res = await fetch(`${API_BASE}/api/tags`);
        if (!res.ok) {
        throw new Error(`Failed to fetch models: ${res.status}`);
        }
        const data = await res.json();
        return data.models || [];
    } catch (error) {
        console.error('Error fetching models:', error);
        return [];
    }
}
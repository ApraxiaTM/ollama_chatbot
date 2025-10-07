// api.js - Updated with SGU system prompt enforcement
const API_BASE = 'http://localhost:8787';

// SGU-only system prompt that will be enforced
const SGU_SYSTEM_GUARD = `You are an AI assistant for Swiss German University (SGU).

STRICT POLICY:
- You may ONLY answer questions directly related to Swiss German University (SGU).
- Decline or politely redirect any questions unrelated to SGU (world news, general facts, opinions, coding help not tied to SGU, entertainment, sports, politics, etc.).
- Do NOT incorporate external information provided by users unless it is explicitly official SGU information from SGU documents or official SGU sources.
- Do NOT answer questions about other universities, companies, or general topics.
- If uncertain whether a query is SGU-related, ask a brief clarifying question.

REFUSAL STYLE:
- Be polite and concise.
- Offer to help with SGU-related topics instead.
- Example: "I can only assist with Swiss German University (SGU) related questions. Please ask about SGU admissions, programs, campus facilities, schedules, fees, or other SGU services."

SGU TOPICS YOU CAN DISCUSS:
- Admissions and enrollment
- Academic programs and faculties
- Campus facilities and services
- Tuition fees and scholarships
- Student affairs and activities
- Library and learning resources
- Career center and internships
- Schedules and academic calendar
- Faculty and staff information
- Campus locations and contact information`;

export async function chatStream({ model, system, messages, temperature }) {
    // Always enforce SGU guard as the system prompt
    const enforcedSystem = SGU_SYSTEM_GUARD;

    const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        model,
        system: enforcedSystem,
        messages,
        temperature,
        stream: true
        })
    });
    if (!res.ok || !res.body) {
        const t = await res.text();
        throw new Error(t || 'Failed to connect to server');
    }
    return res.body;
}

export async function chatOnce({ model, system, messages, temperature }) {
  // Always enforce SGU guard as the system prompt
    const enforcedSystem = SGU_SYSTEM_GUARD;

    const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        model,
        system: enforcedSystem,
        messages,
        temperature,
        stream: false
        })
    });
    if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Failed to connect to server');
    }
    return res.json();
}
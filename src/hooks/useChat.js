// useChat.js - Updated with input validation and URL filtering
import React from 'react';
import { chatStream } from '../services/api';

// SGU-related keywords for basic filtering
const SGU_KEYWORDS = [
    'sgu', 'swiss german university', 'swiss german', 'swiss-german', 'swissgerman',
    'bsd', 'tangerang', 'campus', 'lecture', 'faculty', 'professor',
    'tuition', 'admission', 'enroll', 'registrar', 'library', 'thesis',
    'internship', 'career center', 'student affairs', 'scholarship',
    'semester', 'schedule', 'course', 'program', 'degree', 'bachelor',
    'master', 'undergraduate', 'graduate', 'mechatronics', 'informatics',
    'business', 'communication', 'biotechnology', 'life sciences'
];

// Allowed domains for external links (SGU official only)
const ALLOWED_DOMAINS = ['sgu.ac.id', 'my.sgu.ac.id'];

// Check if text contains disallowed external links
function containsDisallowedLink(text) {
    const urlRegex = /https?:\/\/[^\s)]+/gi;
    const urls = text.match(urlRegex) || [];

    for (const url of urls) {
        try {
        const hostname = new URL(url).hostname.replace(/^www\./, '');
        const isAllowed = ALLOWED_DOMAINS.some(domain => hostname.endsWith(domain));
        if (!isAllowed) {
            return true; // Found disallowed link
        }
        } catch {
        // Invalid URL, treat as disallowed
        return true;
        }
    }
    return false;
}

// Basic keyword-based check for SGU relevance
function isLikelySGURelated(text) {
    const lowerText = text.toLowerCase();

    // Direct SGU mentions
    if (lowerText.includes('sgu') ||
        lowerText.includes('swiss german university') ||
        lowerText.includes('swiss-german university')) {
        return true;
    }

    // Check for SGU-related keywords
    let keywordMatches = 0;
    for (const keyword of SGU_KEYWORDS) {
        if (lowerText.includes(keyword)) {
        keywordMatches++;
        }
    }

    // Require at least 1 keyword match for non-explicit SGU queries
    return keywordMatches >= 1;
}

export default function useChat() {
    const [messages, setMessages] = React.useState([]);
    const [history, setHistory] = React.useState([]);
    const [activeSessionId, setActiveSessionId] = React.useState(null);
    const [systemPrompt, setSystemPrompt] = React.useState('You are a helpful AI assistant for Swiss German University.');
    const [temperature, setTemperature] = React.useState(0.7);
    const [model, setModel] = React.useState('llama3');
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');

    const newSession = () => {
        const id = Math.random().toString(36).slice(2);
        setActiveSessionId(id);
        const session = { id, title: 'New chat', messages: [] };
        setHistory(prev => [session, ...prev]);
        setMessages([]);
        setError('');
    };

    const openSession = (id) => {
        setActiveSessionId(id);
        const sess = history.find(h => h.id === id);
        setMessages(sess?.messages || []);
        setError('');
    };

    const updateSession = (id, updater) => {
        setHistory(prev => prev.map(s => (s.id === id ? updater({ ...s }) : s)));
    };

    const updateTitleFromFirstUserMessage = (id, firstText) => {
        const title = firstText.length > 40 ? firstText.slice(0, 37) + '...' : firstText;
        updateSession(id, s => ({ ...s, title: title || 'New chat' }));
    };

    const sendMessage = async (userText) => {
        setError('');

        // VALIDATION 1: Check for disallowed external links
        if (containsDisallowedLink(userText)) {
        const refusalMsg = "I can only accept information from official SGU sources (sgu.ac.id). Please provide SGU official links or ask your question without external URLs.";

        let sessionId = activeSessionId;
        if (!sessionId) {
            sessionId = Math.random().toString(36).slice(2);
            setActiveSessionId(sessionId);
            setHistory(prev => [{ id: sessionId, title: 'New chat', messages: [] }, ...prev]);
        }

        const userMsg = { role: 'user', content: userText, ts: Date.now() };
        const refusalResponse = { role: 'assistant', content: refusalMsg, ts: Date.now(), streaming: false };

        setMessages(prev => {
            const next = [...prev, userMsg, refusalResponse];
            updateSession(sessionId, s => ({ ...s, messages: next }));
            if (next.filter(m => m.role === 'user').length === 1) {
            updateTitleFromFirstUserMessage(sessionId, userText);
            }
            return next;
        });
        return;
        }

        // VALIDATION 2: Check if query is SGU-related
        if (!isLikelySGURelated(userText)) {
        const refusalMsg = "I can only assist with Swiss German University (SGU) related questions. Please ask about:\n\n• SGU admissions and enrollment\n• Academic programs and faculties\n• Campus facilities and services\n• Tuition fees and scholarships\n• Student affairs and activities\n• Schedules and academic calendar\n• Or any other SGU-related topics\n\nHow can I help you with SGU?";

        let sessionId = activeSessionId;
        if (!sessionId) {
            sessionId = Math.random().toString(36).slice(2);
            setActiveSessionId(sessionId);
            setHistory(prev => [{ id: sessionId, title: 'New chat', messages: [] }, ...prev]);
        }

        const userMsg = { role: 'user', content: userText, ts: Date.now() };
        const refusalResponse = { role: 'assistant', content: refusalMsg, ts: Date.now(), streaming: false };

        setMessages(prev => {
            const next = [...prev, userMsg, refusalResponse];
            updateSession(sessionId, s => ({ ...s, messages: next }));
            if (next.filter(m => m.role === 'user').length === 1) {
            updateTitleFromFirstUserMessage(sessionId, userText);
            }
            return next;
        });
        return;
        }

        // Proceed with normal chat flow if validations pass
        let sessionId = activeSessionId;
        if (!sessionId) {
        sessionId = Math.random().toString(36).slice(2);
        setActiveSessionId(sessionId);
        setHistory(prev => [{ id: sessionId, title: 'New chat', messages: [] }, ...prev]);
        }

        const userMsg = { role: 'user', content: userText, ts: Date.now() };
        const draftAssistant = { role: 'assistant', content: '', ts: Date.now(), streaming: true };

        setMessages(prev => {
        const next = [...prev, userMsg, draftAssistant];
        updateSession(sessionId, s => ({ ...s, messages: next }));
        if (next.filter(m => m.role === 'user').length === 1) {
            updateTitleFromFirstUserMessage(sessionId, userText);
        }
        return next;
        });

        try {
        setLoading(true);
        const body = {
            model,
            system: systemPrompt,
            messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userText }
            ],
            temperature
        };

        const stream = await chatStream(body);
        const reader = stream.getReader();
        const decoder = new TextDecoder();

        let done = false;
        while (!done) {
            const { value, done: d } = await reader.read();
            done = d;
            if (value) {
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split('\n')) {
                if (!line.trim()) continue;
                try {
                const evt = JSON.parse(line);
                if (evt.message?.content) {
                    const delta = evt.message.content;
                    setMessages(prev => {
                    const next = [...prev];
                    const lastIndex = next.length - 1;
                    if (next[lastIndex]?.role === 'assistant') {
                        next[lastIndex] = {
                        ...next[lastIndex],
                        content: (next[lastIndex].content || '') + delta
                        };
                        updateSession(sessionId, s => ({ ...s, messages: next }));
                    }
                    return next;
                    });
                }
                if (evt.done) {
                    setMessages(prev => {
                    const next = [...prev];
                    const lastIndex = next.length - 1;
                    if (next[lastIndex]?.role === 'assistant') {
                        next[lastIndex] = { ...next[lastIndex], streaming: false };
                        updateSession(sessionId, s => ({ ...s, messages: next }));
                    }
                    return next;
                    });
                }
                } catch {}
            }
            }
        }
        } catch (e) {
        console.error(e);
        setError(e.message || 'An error occurred.');
        setMessages(prev => {
            const next = [...prev];
            const lastIndex = next.length - 1;
            if (next[lastIndex]?.role === 'assistant') {
            next[lastIndex] = { ...next[lastIndex], streaming: false };
            updateSession(sessionId, s => ({ ...s, messages: next }));
            }
            return next;
        });
        } finally {
        setLoading(false);
        }
    };

    const deleteSession = (id) => {
        setHistory(prev => prev.filter(s => s.id !== id));
        if (id === activeSessionId) {
        setActiveSessionId(null);
        setMessages([]);
        }
    };

    return {
        messages,
        history,
        activeSessionId,
        systemPrompt,
        setSystemPrompt,
        temperature,
        setTemperature,
        model,
        setModel,
        loading,
        error,
        newSession,
        openSession,
        deleteSession,
        sendMessage
    };
}
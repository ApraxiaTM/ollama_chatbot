// src/hooks/useChat.js - Chat with KB retrieval (no SGU keyword gating)
import React from 'react';
import { chatStream } from '../services/api';
import kb from '../knowledge/knowledgeBase';

// Allowed domains for external links (SGU official only)
const ALLOWED_DOMAINS = ['sgu.ac.id', 'my.sgu.ac.id'];

// Retrieval behavior
const RETRIEVAL = { immediateAnswerMinScore: 60, includeHintsAsContext: true, maxHints: 3 };

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

function norm(s) {
  return String(s || '').trim();
}

async function retrieveFallback(userText) {
  const direct = kb.getAnswer(userText);
  if (direct) {
    return {
      type: 'direct',
      score: direct.score || 0,
      answer: direct.answer,
      matchQuestion: direct.match
    };
  }

  const { faqHits } = kb.search(userText);
  if (faqHits && faqHits.length > 0) {
    return {
      type: 'faq-hints',
      hints: faqHits.slice(0, RETRIEVAL.maxHints)
    };
  }

  const { topicHits } = kb.search(userText);
  if (topicHits && topicHits.length > 0) {
    return {
      type: 'topic-hints',
      hints: topicHits.slice(0, RETRIEVAL.maxHints)
    };
  }

  return null;
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

    // VALIDATION: Check for disallowed external links (keep; remove if you don't want this)
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

    // Proceed with normal chat flow
    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = Math.random().toString(36).slice(2);
      setActiveSessionId(sessionId);
      setHistory(prev => [{ id: sessionId, title: 'New chat', messages: [] }, ...prev]);
    }

    const text = norm(userText);
    const userMsg = { role: 'user', content: text, ts: Date.now() };
    const draftAssistant = { role: 'assistant', content: '', ts: Date.now(), streaming: true };

    setMessages(prev => {
      const next = [...prev, userMsg, draftAssistant];
      updateSession(sessionId, s => ({ ...s, messages: next }));
      if (next.filter(m => m.role === 'user').length === 1) {
        updateTitleFromFirstUserMessage(sessionId, text);
      }
      return next;
    });

    // Knowledge retrieval step
    const retrieval = await retrieveFallback(text);

    // Case 1: Strong direct FAQ match – answer locally without calling the model
    if (retrieval?.type === 'direct' && retrieval.score >= RETRIEVAL.immediateAnswerMinScore) {
      setMessages(prev => {
        const next = [...prev];
        const lastIndex = next.length - 1;
        if (next[lastIndex]?.role === 'assistant') {
          next[lastIndex] = {
            ...next[lastIndex],
            content: retrieval.answer,
            streaming: false,
            meta: {
              source: 'knowledgeBase',
              matchQuestion: retrieval.matchQuestion,
              confidence: retrieval.score
            }
          };
          updateSession(sessionId, s => ({ ...s, messages: next }));
        }
        return next;
      });
      return;
    }

    // Otherwise, prepare context for the model call
    let contextBlock = '';
    if (RETRIEVAL.includeHintsAsContext && retrieval) {
      if (retrieval.type === 'faq-hints') {
        const bullets = retrieval.hints
          .map(h => `- Q: ${h.q}\n  A: ${h.a}`)
          .join('\n');
        contextBlock += `Relevant FAQs:\n${bullets}\n\n`;
      } else if (retrieval.type === 'topic-hints') {
        const bullets = retrieval.hints
          .map(h => `- ${h.path}: ${h.text}`)
          .join('\n');
        contextBlock += `Relevant SGU topics:\n${bullets}\n\n`;
      }
    }

    try {
      setLoading(true);
      const body = {
        model,
        system: contextBlock
          ? `${systemPrompt}\n\nUse the following context when answering.\n\n${contextBlock}`
          : systemPrompt,
        messages: [
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: text }
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
            } catch {
              // ignore partial/keep-alive lines
            }
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
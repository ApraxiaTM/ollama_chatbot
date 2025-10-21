// src/hooks/useChat.js - Chat with KB retrieval and relatedness feedback
import React from 'react';
import kb from '../knowledge/knowledgeBase';
import { chatStream } from '../services/api';

// Allowed domains for external links (SGU official only)
const ALLOWED_DOMAINS = ['sgu.ac.id', 'my.sgu.ac.id'];

// Retrieval behavior
const RETRIEVAL = { immediateAnswerMinScore: 90, includeHintsAsContext: true, maxHints: 3 };

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

    // VALIDATION: Check for disallowed external links
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

    const text = norm(userText);

    // Knowledge retrieval step
    const retrieval = await retrieveFallback(text);
    console.log('KB retrieval result:', retrieval);

    // Check if we have any hits
    const hasAnyHit =
      (retrieval?.type === 'direct') ||
      (retrieval?.type === 'faq-hints' && retrieval.hints?.length) ||
      (retrieval?.type === 'topic-hints' && retrieval.hints?.length);

    // Check if question is SGU-related using KB
    const kbThinksRelated = kb.isLikelySGURelatedKB ? kb.isLikelySGURelatedKB(text) : true;

    // Case: Unrelated to SGU and no hits
    if (!hasAnyHit && !kbThinksRelated) {
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = Math.random().toString(36).slice(2);
        setActiveSessionId(sessionId);
        setHistory(prev => [{ id: sessionId, title: 'New chat', messages: [] }, ...prev]);
      }

      const userMsg = { role: 'user', content: text, ts: Date.now() };
      const feedback = {
        role: 'assistant',
        content:
          "I'm here to help with Swiss German University (SGU) topics. Your question doesn't appear related to SGU, and I couldn't find anything relevant in the SGU knowledge base.\n\nYou can ask about:\n• Admissions, tuition, and scholarships\n• Programs & faculties (Mechatronics, IT, Business, Life Sciences, etc.)\n• Double degree and internships\n• Campus facilities, library, student affairs\n\nPlease rephrase your question to focus on SGU, and I'll be glad to help.",
        ts: Date.now(),
        streaming: false
      };

      setMessages(prev => {
        const next = [...prev, userMsg, feedback];
        updateSession(sessionId, s => ({ ...s, messages: next }));
        if (next.filter(m => m.role === 'user').length === 1) {
          updateTitleFromFirstUserMessage(sessionId, text);
        }
        return next;
      });
      return;
    }

    // Case: Related to SGU but no hits found
    if (!hasAnyHit && kbThinksRelated) {
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = Math.random().toString(36).slice(2);
        setActiveSessionId(sessionId);
        setHistory(prev => [{ id: sessionId, title: 'New chat', messages: [] }, ...prev]);
      }

      const userMsg = { role: 'user', content: text, ts: Date.now() };
      const feedback = {
        role: 'assistant',
        content:
          "I couldn't find an exact answer in the SGU knowledge base. Could you clarify or provide more details?\n\nFor example:\n• Which program/faculty is this about?\n• Are you asking about admissions, fees, curriculum, or internships?\n\nI can then look again or provide more precise information.",
        ts: Date.now(),
        streaming: false
      };

      setMessages(prev => {
        const next = [...prev, userMsg, feedback];
        updateSession(sessionId, s => ({ ...s, messages: next }));
        if (next.filter(m => m.role === 'user').length === 1) {
          updateTitleFromFirstUserMessage(sessionId, text);
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
// src/hooks/useChat.js - Compact, KB-first routing
import React from 'react';
import kb from '../knowledge/knowledgeBase';
import { chatStream } from '../services/api';

const ALLOWED_DOMAINS = ['sgu.ac.id', 'my.sgu.ac.id'];
const RETRIEVAL = { strong: 85, normal: 60, weak: 45, maxHints: 3 };

const norm = (s) => String(s || '').trim();

function containsDisallowedLink(text) {
  const urlRegex = /https?:\/\/[^\s)]+/gi;
  const urls = text.match(urlRegex) || [];
  for (const url of urls) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      if (!ALLOWED_DOMAINS.some(d => host.endsWith(d))) return true;
    } catch {
      return true;
    }
  }
  return false;
}

// Unified KB retrieval: direct -> faq-hints -> topic-hints
async function retrieve(text) {
  const direct = kb.getAnswer(text);
  if (direct) return { type: 'direct', score: direct.score || 0, answer: direct.answer, match: direct.match, source: direct.source };
  const { faqHits, topicHits } = kb.search(text);
  if (faqHits?.length) return { type: 'faq-hints', hints: faqHits.slice(0, RETRIEVAL.maxHints) };
  if (topicHits?.length) return { type: 'topic-hints', hints: topicHits.slice(0, RETRIEVAL.maxHints) };
  return null;
}

function buildContext(retrieval) {
  if (!retrieval) return '';
  if (retrieval.type === 'faq-hints') {
    const bullets = retrieval.hints.map(h => `- Q: ${h.q}\n  A: ${h.a}`).join('\n');
    return `Relevant FAQs:\n${bullets}\n\n`;
  }
  if (retrieval.type === 'topic-hints') {
    const bullets = retrieval.hints.map(h => `- ${h.path}: ${h.text}`).join('\n');
    return `Relevant SGU topics:\n${bullets}\n\n`;
  }
  return '';
}

// ===== Local extractors (no model) =====

function listPartnersFromKB() {
  const partners = [];
  const about = kb?.sguTopics?.['About SGU'];
  if (about && Array.isArray(about['double degree partners'])) {
    for (const p of about['double degree partners']) if (p?.university) partners.push({ university: p.university, country: p.country || '' });
  }
  for (const [topicName, data] of Object.entries(kb?.sguTopics || {})) {
    if (topicName === 'About SGU') continue;
    const jd = data?.['international academic experience']?.['joint degree program'];
    if (!jd) continue;
    if (jd['partner university']) partners.push({ university: jd['partner university'], topic: topicName });
    if (Array.isArray(jd['partner universities'])) {
      for (const pu of jd['partner universities']) if (pu?.name) partners.push({ university: pu.name, topic: topicName, duration: pu.duration || '' });
    }
  }
  const seen = new Set();
  return partners.filter(p => {
    const k = p.university.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function matchProgramKey(q) {
  // Try exact keys in sgu_topics.json
  const topics = kb?.sguTopics || {};
  // Quick alias mapping
  const aliases = [
    { re: /(^|\b)mechatronics?( engineering)?\b/i, key: 'Mechatronics Engineering' },
    { re: /(^|\b)hybrid electric vehicles?\b/i, key: 'Hybrid Electric Vehicles' },
    { re: /(^|\b)cyber\s*security\b/i, key: 'IT: Cyber Security' },
    { re: /(^|\b)ai\b|artificial intelligence|data science/i, key: 'IT: Artificial Intelligence & Data Science' },
    { re: /technopreneurship/i, key: 'IT: Technopreneurship' },
    { re: /smart industry/i, key: 'IE: Smart Industry' },
    { re: /eco industry|eco-industry/i, key: 'IE: Eco Industry' },
    { re: /food technology/i, key: 'Food Technology' },
    { re: /pharmaceutical( engineering)?/i, key: 'Pharmaceutical Engineering' },
    { re: /medical biotechnology/i, key: 'Medical Biotechnology' },
    { re: /sustainable energy/i, key: 'Sustainable Energy and Environment' },
    { re: /global strategic communication/i, key: 'Global Strategic Communication' },
    { re: /digital communication.*media arts/i, key: 'Digital Communication & Media Arts' },
    { re: /digital communication(?!.*arts)/i, key: 'Digital Communication & Media' },
    { re: /business and management/i, key: 'Business and Management' },
    { re: /business accounting|accounting\b/i, key: 'Business Accounting' },
    { re: /hotel (and )?tourism|hospitality/i, key: 'Hotel and Tourism Management' },
    { re: /international culinary business|culinary/i, key: 'International Culinary Business' }
  ];
  // Alias hit
  for (const a of aliases) if (a.re.test(q)) return a.key;
  // Fallback: fuzzy contains by topic name
  const lower = q.toLowerCase();
  for (const key of Object.keys(topics)) {
    if (lower.includes(key.toLowerCase())) return key;
  }
  return null;
}

function extractLecturers(text) {
  const isLecturerQuery = /(lecturer|faculty member|teacher|professor|instructor|staff|dosen)s?/i.test(text);
  if (!isLecturerQuery) return null;
  const key = matchProgramKey(text);
  if (!key) return null;
  const list = (kb?.sguTopics?.[key]?.lecturers || []).map(l => `• ${l}`).join('\n');
  return list ? { program: key, list } : null;
}

function extractCurriculum(text) {
  // Detect curriculum requests
  const isCurr = /(curriculum|course list|subjects?|courses?|mata kuliah|silabus|syllabus)/i.test(text)
    || /semester\s*[1-8]/i.test(text)
    || /(sem\s*[1-8]|smt\s*[1-8])/i.test(text);
  if (!isCurr) return null;

  const key = matchProgramKey(text);
  if (!key) return null;

  const cur = kb?.sguTopics?.[key]?.curriculum;
  if (!cur || typeof cur !== 'object') return { program: key, list: 'Curriculum details are not available in the KB.' };

  // Determine requested semesters; default to all 1–8 available
  const req = Array.from(text.matchAll(/semester\s*([1-9])/ig)).map(m => parseInt(m[1], 10));
  const semesters = req.length ? req : Object.keys(cur)
    .map(k => k.match(/(\d+)/)?.[1])
    .filter(Boolean)
    .map(n => parseInt(n, 10))
    .sort((a, b) => a - b);

  // Build formatted output
  const blocks = [];
  for (const n of semesters) {
    const semKey = `semester ${n}`;
    const courses = cur[semKey]?.courses;
    if (Array.isArray(courses) && courses.length) {
      blocks.push(`Semester ${n}\n${courses.map(c => `• ${c}`).join('\n')}`);
    }
  }
  if (!blocks.length) return { program: key, list: 'Curriculum details are not available for the requested semesters.' };

  return { program: key, list: blocks.join('\n\n') };
}

// ===== Hook =====
export default function useChat() {
  const [messages, setMessages] = React.useState([]);
  const [history, setHistory] = React.useState([]);
  const [activeSessionId, setActiveSessionId] = React.useState(null);
  const [systemPrompt, setSystemPrompt] = React.useState('You are a helpful AI assistant for Swiss German University.');
  const [temperature, setTemperature] = React.useState(0.3);
  const [model, setModel] = React.useState('gpt-oss:120b-cloud');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const newSession = () => {
    const id = Math.random().toString(36).slice(2);
    setActiveSessionId(id);
    setHistory(prev => [{ id, title: 'New chat', messages: [] }, ...prev]);
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

    // Validation
    if (containsDisallowedLink(userText)) {
      const sessionId = activeSessionId || Math.random().toString(36).slice(2);
      if (!activeSessionId) {
        setActiveSessionId(sessionId);
        setHistory(prev => [{ id: sessionId, title: 'New chat', messages: [] }, ...prev]);
      }
      const userMsg = { role: 'user', content: userText, ts: Date.now() };
      const refusal = { role: 'assistant', content: 'I can only accept information from official SGU sources (sgu.ac.id). Please provide SGU official links or ask your question without external URLs.', ts: Date.now(), streaming: false };
      setMessages(prev => {
        const next = [...prev, userMsg, refusal];
        updateSession(sessionId, s => ({ ...s, messages: next }));
        if (next.filter(m => m.role === 'user').length === 1) updateTitleFromFirstUserMessage(sessionId, userText);
        return next;
      });
      return;
    }

    const text = norm(userText);
    const retrieval = await retrieve(text);
    const hasAnyHit = !!retrieval;
    const kbRelated = kb.isLikelySGURelatedKB ? kb.isLikelySGURelatedKB(text) : true;

    // Off-topic + no hits
    if (!hasAnyHit && !kbRelated) {
      const sessionId = activeSessionId || Math.random().toString(36).slice(2);
      if (!activeSessionId) {
        setActiveSessionId(sessionId);
        setHistory(prev => [{ id: sessionId, title: 'New chat', messages: [] }, ...prev]);
      }
      const userMsg = { role: 'user', content: text, ts: Date.now() };
      const fb = { role: 'assistant', content: "I'm here to help with Swiss German University (SGU) topics. Your question doesn't appear related to SGU, and I couldn't find anything relevant in the SGU knowledge base.\n\nYou can ask about:\n• Admissions, tuition, scholarships\n• Programs & faculties (Mechatronics, IT, Business, Life Sciences, etc.)\n• Double degree and internships\n• Campus facilities, library, student affairs", ts: Date.now(), streaming: false };
      setMessages(prev => {
        const next = [...prev, userMsg, fb];
        updateSession(sessionId, s => ({ ...s, messages: next }));
        if (next.filter(m => m.role === 'user').length === 1) updateTitleFromFirstUserMessage(sessionId, text);
        return next;
      });
      return;
    }

    // Local specials (short-circuit)
    // About SGU
    const aboutCue = /(^|\b)(about sgu|tell me about sgu|swiss german university|what is sgu)\b/i.test(text);
    if (aboutCue && kb?.sguTopics?.['About SGU']) {
      const about = kb.sguTopics['About SGU'];
      let answer = about.description || '';
      const q = text.toLowerCase();
      if (q.includes('vision') && about.vision) answer += `\n\nVision:\n${about.vision}`;
      if (q.includes('mission') && Array.isArray(about.mission)) answer += `\n\nMission:\n${about.mission.map(m => `• ${m}`).join('\n')}`;
      if (q.includes('value') && Array.isArray(about.values)) answer += `\n\nValues:\n${about.values.join(', ')}`;
      if ((q.includes('partner') || q.includes('double degree')) && Array.isArray(about['double degree partners'])) {
        const partnersTxt = about['double degree partners'].map(p => `• ${p.university}${p.country ? ` (${p.country})` : ''}`).join('\n');
        answer += `\n\nDouble Degree Partners:\n${partnersTxt}`;
      }
      const sessionId = activeSessionId || Math.random().toString(36).slice(2);
      if (!activeSessionId) {
        setActiveSessionId(sessionId);
        setHistory(prev => [{ id: sessionId, title: 'New chat', messages: [] }, ...prev]);
      }
      const userMsg = { role: 'user', content: text, ts: Date.now() };
      const ans = { role: 'assistant', content: answer || 'About SGU information is available in the KB.', ts: Date.now(), streaming: false };
      setMessages(prev => { const next = [...prev, userMsg, ans]; updateSession(sessionId, s => ({ ...s, messages: next })); if (next.filter(m => m.role === 'user').length === 1) updateTitleFromFirstUserMessage(sessionId, text); return next; });
      return;
    }

    // Partners
    if (/(double degree|joint degree|partner|partner universit)/i.test(text)) {
      const partners = listPartnersFromKB();
      if (partners.length) {
        const sessionId = activeSessionId || Math.random().toString(36).slice(2);
        if (!activeSessionId) {
          setActiveSessionId(sessionId);
          setHistory(prev => [{ id: sessionId, title: 'New chat', messages: [] }, ...prev]);
        }
        const userMsg = { role: 'user', content: text, ts: Date.now() };
        const formatted = partners.map(p => `• ${p.university}${p.country ? ` (${p.country})` : ''}${p.topic ? ` — ${p.topic}` : ''}${p.duration ? ` — ${p.duration}` : ''}`).join('\n');
        const ans = { role: 'assistant', content: `**Double Degree Partner Universities (from SGU KB):**\n\n${formatted}`, ts: Date.now(), streaming: false };
        setMessages(prev => { const next = [...prev, userMsg, ans]; updateSession(sessionId, s => ({ ...s, messages: next })); if (next.filter(m => m.role === 'user').length === 1) updateTitleFromFirstUserMessage(sessionId, text); return next; });
        return;
      }
    }

    // Lecturers
    const lecturerHit = extractLecturers(text);
    if (lecturerHit) {
      const sessionId = activeSessionId || Math.random().toString(36).slice(2);
      if (!activeSessionId) {
        setActiveSessionId(sessionId);
        setHistory(prev => [{ id: sessionId, title: 'New chat', messages: [] }, ...prev]);
      }
      const userMsg = { role: 'user', content: text, ts: Date.now() };
      const ans = { role: 'assistant', content: `**Lecturers for ${lecturerHit.program} (from SGU KB):**\n\n${lecturerHit.list}`, ts: Date.now(), streaming: false };
      setMessages(prev => { const next = [...prev, userMsg, ans]; updateSession(sessionId, s => ({ ...s, messages: next })); if (next.filter(m => m.role === 'user').length === 1) updateTitleFromFirstUserMessage(sessionId, text); return next; });
      return;
    }

    // Curriculum
    const curriculumHit = extractCurriculum(text);
    if (curriculumHit) {
      const sessionId = activeSessionId || Math.random().toString(36).slice(2);
      if (!activeSessionId) {
        setActiveSessionId(sessionId);
        setHistory(prev => [{ id: sessionId, title: 'New chat', messages: [] }, ...prev]);
      }
      const userMsg = { role: 'user', content: text, ts: Date.now() };
      const ans = { role: 'assistant', content: `**${curriculumHit.program} Curriculum (from SGU KB):**\n\n${curriculumHit.list}`, ts: Date.now(), streaming: false };
      setMessages(prev => { const next = [...prev, userMsg, ans]; updateSession(sessionId, s => ({ ...s, messages: next })); if (next.filter(m => m.role === 'user').length === 1) updateTitleFromFirstUserMessage(sessionId, text); return next; });
      return;
    }

    // Start streaming draft
    const sessionId = activeSessionId || Math.random().toString(36).slice(2);
    if (!activeSessionId) {
      setActiveSessionId(sessionId);
      setHistory(prev => [{ id: sessionId, title: 'New chat', messages: [] }, ...prev]);
    }
    const userMsg = { role: 'user', content: text, ts: Date.now() };
    const draft = { role: 'assistant', content: '', ts: Date.now(), streaming: true };
    setMessages(prev => { const next = [...prev, userMsg, draft]; updateSession(sessionId, s => ({ ...s, messages: next })); if (next.filter(m => m.role === 'user').length === 1) updateTitleFromFirstUserMessage(sessionId, text); return next; });

    // 3-tier direct KB answers
    if (retrieval?.type === 'direct' && retrieval.score >= RETRIEVAL.strong) {
      setMessages(prev => { const next = [...prev]; const i = next.length - 1; if (next[i]?.role === 'assistant') next[i] = { ...next[i], content: retrieval.answer, streaming: false, meta: { source: 'KB', confidence: retrieval.score, strength: 'strong' } }; updateSession(sessionId, s => ({ ...s, messages: next })); return next; });
      return;
    }
    if (retrieval?.type === 'direct' && retrieval.score >= RETRIEVAL.normal) {
      const caveat = '\n\nNote: Medium-confidence match from SGU KB. Provide program/faculty for specifics.';
      setMessages(prev => { const next = [...prev]; const i = next.length - 1; if (next[i]?.role === 'assistant') next[i] = { ...next[i], content: retrieval.answer + caveat, streaming: false, meta: { source: 'KB', confidence: retrieval.score, strength: 'normal' } }; updateSession(sessionId, s => ({ ...s, messages: next })); return next; });
      return;
    }
    if (retrieval?.type === 'direct' && retrieval.score >= RETRIEVAL.weak) {
      const ask = '\n\nThis seems related but I’m not fully certain. Which program/faculty, or is it about admissions, curriculum, fees, or internships?';
      setMessages(prev => { const next = [...prev]; const i = next.length - 1; if (next[i]?.role === 'assistant') next[i] = { ...next[i], content: retrieval.answer + ask, streaming: false, meta: { source: 'KB', confidence: retrieval.score, strength: 'weak' } }; updateSession(sessionId, s => ({ ...s, messages: next })); return next; });
      return;
    }

    // Otherwise call model with grounded context
    let contextBlock = buildContext(retrieval);
    if (/about sgu|tell me about sgu|swiss german university|what is sgu/i.test(text) && kb?.sguTopics?.['About SGU']?.description) {
      contextBlock += `About SGU:\n${kb.sguTopics['About SGU'].description}\n\n`;
    }

    try {
      setLoading(true);
      const system = contextBlock
        ? `${systemPrompt}
Answer using ONLY the SGU context below. If the answer isn’t in the context, say you're not fully sure and ask a brief, relevant follow-up.

=== SGU CONTEXT ===
${contextBlock.trim()}
=== END ===`
        : `${systemPrompt}
If unsure, ask a brief SGU-specific clarifying question (program/faculty/admissions/curriculum).`;

      const body = {
        model,
        system,
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
                  const i = next.length - 1;
                  if (next[i]?.role === 'assistant') next[i] = { ...next[i], content: (next[i].content || '') + delta };
                  updateSession(sessionId, s => ({ ...s, messages: next }));
                  return next;
                });
              }
              if (evt.done) {
                setMessages(prev => {
                  const next = [...prev];
                  const i = next.length - 1;
                  if (next[i]?.role === 'assistant') next[i] = { ...next[i], streaming: false };
                  updateSession(sessionId, s => ({ ...s, messages: next }));
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
        const i = next.length - 1;
        if (next[i]?.role === 'assistant') next[i] = { ...next[i], streaming: false };
        updateSession(sessionId, s => ({ ...s, messages: next }));
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
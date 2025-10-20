// src/knowledge/knowledgeBase.js
import faqs from '../data/faqs.json';
import topics from '../data/sgu_topics.json';

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// very light stemming for plurals
function stemWord(w) {
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

function tokenize(s) {
  return norm(s).split(' ').map(stemWord).filter(Boolean);
}

const SYNONYM_MAP = new Map([
  ['graduate', 'alumni'],
  ['graduates', 'alumni'],
  ['stand', 'stand'],
  ['out', 'out'],
  ['unique', 'standout'],
  ['recognize', 'recognized'],
  ['recognised', 'recognized'],
  ['degree', 'degree'],
  ['double', 'double'],
]);

function expandTokens(toks) {
  const out = new Set(toks);
  for (const t of toks) {
    const syn = SYNONYM_MAP.get(t);
    if (syn) out.add(syn);
  }
  return Array.from(out);
}

function jaccard(aToks, bToks) {
  const A = new Set(aToks);
  const B = new Set(bToks);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter || 1;
  return inter / union;
}

export function getAnswer(query) {
  const qNorm = norm(query);
  const qToks = expandTokens(tokenize(qNorm));
  let best = null;
  let bestScore = 0;

  for (const item of faqs) {
    const tNorm = norm(item.q);
    const tToks = expandTokens(tokenize(tNorm));
    // exact or substring boosts
    let score = 0;
    if (tNorm === qNorm) score = 1.0;
    else if (tNorm.includes(qNorm) || qNorm.includes(tNorm)) score = 0.9;
    else score = jaccard(qToks, tToks);

    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }

  if (!best) return null;

  // Convert to 0..100 range for the UI threshold
  return {
    answer: best.a,
    match: best.q,
    score: Math.round(bestScore * 100)
  };
}

export function search(term) {
  const t = norm(term);
  const faqHits = [];
  for (const item of faqs) {
    const qn = norm(item.q);
    const an = norm(item.a);
    if (qn.includes(t) || an.includes(t)) {
      faqHits.push(item);
    } else {
      const sim = jaccard(expandTokens(tokenize(t)), expandTokens(tokenize(qn + ' ' + an)));
      if (sim >= 0.3) faqHits.push(item);
    }
  }

  const topicHits = [];
  if (topics?.faculties) {
    const tToks = expandTokens(tokenize(t));
    for (const fac of topics.faculties) {
      const facName = norm(fac.name);
      if (facName.includes(t)) topicHits.push({ path: `faculties.${fac.name}`, text: fac.name });
      for (const p of fac.programs || []) {
        const fields = [
          p.name,
          ...(p.concentrations || []),
          ...(p.notes || []),
          ...(p.careers || [])
        ].filter(Boolean);
        const joined = norm(fields.join(' '));
        const sim = jaccard(tToks, expandTokens(tokenize(joined)));
        if (joined.includes(t) || sim >= 0.3) {
          topicHits.push({ path: `faculties.${fac.name}.programs.${p.name}`, text: fields.join(' • ') });
        }
      }
    }
  }
  const aboutFields = [
    topics?.about?.summary,
    topics?.about?.vision,
    ...(topics?.about?.highlights || []),
    ...(topics?.about?.values || [])
  ].filter(Boolean);
  const aboutJoined = norm(aboutFields.join(' '));
  if (aboutJoined.includes(t) || jaccard(expandTokens(tokenize(t)), expandTokens(tokenize(aboutJoined))) >= 0.3) {
    topicHits.push({ path: 'about', text: aboutFields.join(' • ') });
  }

  return { faqHits, topicHits };
}

export function isLikelySGURelatedKB(query) {
  const q = norm(query);
  if (!q) return false;

  // Quick substring cues that are very common
  const quickCues = ['sgu', 'swiss german', 'swiss-german', 'double degree', 'campus', 'faculty', 'program'];
  for (const c of quickCues) {
    if (q.includes(c)) return true;
  }

  // Soft similarity vs. all FAQ titles
  let maxFaq = 0;
  for (const item of faqs) {
    const score = jaccard(expandTokens(tokenize(q)), expandTokens(tokenize(item.q)));
    if (score > maxFaq) maxFaq = score;
    if (maxFaq >= 0.35) break; // early exit
  }

  // Soft similarity vs. topic names
  let maxTopic = 0;
  for (const fac of topics?.faculties || []) {
    maxTopic = Math.max(maxTopic, jaccard(expandTokens(tokenize(q)), expandTokens(tokenize(fac.name))));
    for (const p of fac.programs || []) {
      const joined = [p.name, ...(p.concentrations || [])].join(' ');
      maxTopic = Math.max(maxTopic, jaccard(expandTokens(tokenize(q)), expandTokens(tokenize(joined))));
      if (maxFaq >= 0.35 || maxTopic >= 0.35) break;
    }
    if (maxFaq >= 0.35 || maxTopic >= 0.35) break;
  }

  return maxFaq >= 0.35 || maxTopic >= 0.35;
}

export { faqs, topics };
export default { faqs, topics, getAnswer, search, isLikelySGURelatedKB };
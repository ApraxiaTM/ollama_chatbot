// src/knowledge/knowledgeBase.js
import faqs from '../data/faqs.json';
import sguTopics from '../data/sgu_topics.json';

// ---------- UTILITIES ----------
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stemWord(w) {
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

function tokenize(s) {
  return norm(s).split(' ').map(stemWord).filter(Boolean);
}

function jaccard(aToks, bToks) {
  const A = new Set(aToks);
  const B = new Set(bToks);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter || 1;
  return inter / union;
}

// ---------- MAIN QUESTION->ANSWER RETRIEVER ----------
export function getAnswer(query) {
  const qNorm = norm(query);
  const qTokens = tokenize(qNorm);

  let best = null;
  let bestScore = 0;

  // ------- Special case: direct "lecturers" question -------
  const lecturerQuery = /(lecturer|faculty member|teacher|professor|instructor)s?/i.test(query);
  if (lecturerQuery) {
    for (const [topicName, topicData] of Object.entries(sguTopics)) {
      const joined = norm([topicName, topicData.faculty].join(' '));
      if (
        joined.includes(qNorm) ||
        qNorm.includes(joined) ||
        jaccard(qTokens, tokenize(joined)) >= 0.35
      ) {
        const lecturers = (topicData.lecturers || []).map(l => `• ${l}`).join('\n');
        if (lecturers) {
          return {
            answer: `Lecturers for ${topicName}:\n\n${lecturers}`,
            match: topicName,
            score: 90,
            source: 'topic-lecturers'
          };
        }
      }
    }
  }

  // ------- 1) FAQ match -------
  for (const item of faqs) {
    const questionNorm = norm(item.q);
    const questionTokens = tokenize(questionNorm);
    let score = 0;
    if (questionNorm === qNorm) score = 1;
    else if (questionNorm.includes(qNorm) || qNorm.includes(questionNorm)) score = 0.9;
    else score = jaccard(qTokens, questionTokens);
    if (score > bestScore) {
      best = { type: 'faq', question: item.q, answer: item.a };
      bestScore = score;
    }
  }

  // ------- 2) Topic match -------
  for (const [topicName, topicData] of Object.entries(sguTopics)) {
    const desc = [
      topicName,
      topicData.faculty,
      topicData.description,
      ...(topicData.values || []),
      ...(topicData.vision ? [topicData.vision] : []),
      ...(topicData.mission || []),
      ...(topicData.keywords || []),
      ...(topicData.career_prospects || []),
      ...(topicData.lecturers || [])
    ].join(' ');

    const descNorm = norm(desc);
    const topicTokens = tokenize(descNorm);
    let score = jaccard(qTokens, topicTokens);

    // Add forgiving substring match for label differences (e.g. Cybersecurity vs Cyber Security)
    const compactQuery = qNorm.replace(/ /g, '');
    const compactTopic = topicName.toLowerCase().replace(/ /g, '');
    if (compactTopic.includes(compactQuery) || compactQuery.includes(compactTopic)) {
      score = Math.max(score, 0.85);
    }

    if (score > bestScore) {
      best = { type: 'topic', topic: topicName, data: topicData };
      bestScore = score;
    }
  }

  // ------- 3) Faculty aggregation fallback -------
  if (!best || bestScore < 0.6) {
    const facultyMatch = /faculty of ([a-z\s&]+)/i.exec(query);
    if (facultyMatch) {
      const facultyTerm = facultyMatch[1].trim().toLowerCase();
      const matches = Object.entries(sguTopics).filter(([_, val]) =>
        norm(val.faculty).includes(facultyTerm)
      );
      if (matches.length > 0) {
        const lecturerList = matches
          .flatMap(([name, val]) => (val.lecturers || []).map(l => `• ${name}: ${l}`))
          .join('\n');
        return {
          answer: `Here are lecturers from the Faculty of ${facultyTerm}:\n\n${lecturerList}`,
          match: `Faculty of ${facultyTerm}`,
          score: 95,
          source: 'faculty-aggregate'
        };
      }
    }
  }

  // ------- 4) Final answer -------
  if (!best) return null;

  if (best.type === 'faq') {
    return {
      answer: best.answer,
      match: best.question,
      score: Math.round(bestScore * 100),
      source: 'faq'
    };
  }

  const t = best.data;
  const composed =
    t.description ||
    `This program belongs to ${t.faculty}. Learn more about ${best.topic} at SGU.`;

  return {
    answer: composed,
    match: best.topic,
    score: Math.round(bestScore * 100),
    source: 'topic'
  };
}

// ---------- SEARCH FUNCTION ----------
export function search(term) {
  const tNorm = norm(term);
  const tTokens = tokenize(tNorm);
  const faqHits = [];
  const topicHits = [];

  for (const item of faqs) {
    const qn = norm(item.q);
    const an = norm(item.a);
    const sim = jaccard(tTokens, tokenize(qn + ' ' + an));
    if (qn.includes(tNorm) || an.includes(tNorm) || sim >= 0.4) faqHits.push(item);
  }

  for (const [key, val] of Object.entries(sguTopics)) {
    const combined = norm(
      [
        key,
        val.faculty,
        val.description,
        ...(val.keywords || []),
        ...(val.career_prospects || []),
        ...(val.lecturers || []),
        ...(val.mission || []),
        val.vision || ''
      ].join(' ')
    );
    const sim = jaccard(tTokens, tokenize(combined));
    if (combined.includes(tNorm) || sim >= 0.4)
      topicHits.push({ path: key, text: val.description || '', data: val });
  }

  return { faqHits, topicHits };
}

// ---------- RELATEDNESS CHECK ----------
export function isLikelySGURelatedKB(query) {
  const q = norm(query);
  if (!q) return false;

  const quickCues = [
    'sgu',
    'swiss german',
    'swiss-german',
    'program',
    'faculty',
    'degree',
    'campus',
    'lecture',
    'internship',
    'admission',
    'university'
  ];
  if (quickCues.some((c) => q.includes(c))) return true;

  for (const [name, data] of Object.entries(sguTopics)) {
    const joined = norm([name, data.faculty, ...(data.keywords || []), data.description || ''].join(' '));
    const sim = jaccard(tokenize(q), tokenize(joined));
    if (sim >= 0.35) return true;
  }

  for (const f of faqs) {
    const sim = jaccard(tokenize(q), tokenize(norm(f.q)));
    if (sim >= 0.35) return true;
  }
  return false;
}

// ---------- EXPORT ----------
export { faqs, sguTopics };
export default { faqs, sguTopics, getAnswer, search, isLikelySGURelatedKB };
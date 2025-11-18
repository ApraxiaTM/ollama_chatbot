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

// Recursively flatten nested objects/arrays into searchable text
function flattenData(obj, maxDepth = 3, currentDepth = 0) {
  if (currentDepth > maxDepth) return '';
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return obj.map(x => flattenData(x, maxDepth, currentDepth + 1)).join(' ');
  if (typeof obj === 'object' && obj !== null) {
    return Object.values(obj).map(v => flattenData(v, maxDepth, currentDepth + 1)).join(' ');
  }
  return '';
}

// ---------- MAIN QUESTION->ANSWER RETRIEVER ----------
export function getAnswer(query) {
  const qNorm = norm(query);
  const qTokens = tokenize(qNorm);

  let best = null;
  let bestScore = 0;

  // ------- Special: "About SGU" queries -------
  if (sguTopics['About SGU'] && (qNorm.includes('about sgu') || qNorm.includes('vision') || qNorm.includes('mission') || qNorm.includes('value') || qNorm.includes('partner'))) {
    const aboutData = sguTopics['About SGU'];
    const aboutText = flattenData(aboutData);
    const sim = jaccard(qTokens, tokenize(aboutText));
    if (sim >= 0.3) {
      let answer = aboutData.description || '';
      if (qNorm.includes('vision')) answer += `\n\n**Vision:** ${aboutData.vision}`;
      if (qNorm.includes('mission')) answer += `\n\n**Mission:**\n${(aboutData.mission || []).map(m => `• ${m}`).join('\n')}`;
      if (qNorm.includes('value')) answer += `\n\n**Values:** ${(aboutData.values || []).join(', ')}`;
      if (qNorm.includes('partner') && aboutData['double degree partners']) {
        answer += `\n\n**Double Degree Partners:**\n${aboutData['double degree partners'].map(p => `• ${p.university} (${p.country})`).join('\n')}`;
      }
      return {
        answer: answer || aboutData.description,
        match: 'About SGU',
        score: Math.round(sim * 100),
        source: 'about-sgu'
      };
    }
  }

  // ------- Special: Lecturer queries -------
  const lecturerQuery = /(lecturer|faculty member|teacher|professor|instructor|staff|dosen)s?/i.test(query);
  if (lecturerQuery) {
    for (const [topicName, topicData] of Object.entries(sguTopics)) {
      if (topicName === 'About SGU') continue;
      const joined = norm([topicName, topicData.faculty].join(' '));
      if (joined.includes(qNorm) || qNorm.includes(joined) || jaccard(qTokens, tokenize(joined)) >= 0.35) {
        const lecturers = (topicData.lecturers || []).map(l => `• ${l}`).join('\n');
        if (lecturers) {
          return {
            answer: `**Lecturers for ${topicName}:**\n\n${lecturers}`,
            match: topicName,
            score: 90,
            source: 'topic-lecturers'
          };
        }
      }
    }
  }

  // ------- Special: Curriculum queries -------
  const curriculumQuery = /(curriculum|course|semester|subject|class)/i.test(query);
  if (curriculumQuery) {
    for (const [topicName, topicData] of Object.entries(sguTopics)) {
      if (topicName === 'About SGU') continue;
      const joined = norm([topicName, topicData.faculty].join(' '));
      if (joined.includes(qNorm) || qNorm.includes(joined) || jaccard(qTokens, tokenize(joined)) >= 0.35) {
        if (topicData.curriculum) {
          const currText = flattenData(topicData.curriculum);
          const currSim = jaccard(qTokens, tokenize(currText));
          if (currSim >= 0.25) {
            let answer = `**Curriculum for ${topicName}:**\n\n`;
            for (const [sem, data] of Object.entries(topicData.curriculum)) {
              answer += `**${sem}:**\n`;
              if (data.courses) answer += data.courses.map(c => `  • ${c}`).join('\n') + '\n';
              else answer += flattenData(data) + '\n';
            }
            return {
              answer,
              match: topicName,
              score: Math.round(currSim * 100),
              source: 'curriculum'
            };
          }
        }
      }
    }
  }

  // ------- Special: Career prospects queries -------
  const careerQuery = /(career|job|work|prospect|graduate|alumni)/i.test(query);
  if (careerQuery) {
    for (const [topicName, topicData] of Object.entries(sguTopics)) {
      if (topicName === 'About SGU') continue;
      const joined = norm([topicName, topicData.faculty].join(' '));
      if (joined.includes(qNorm) || qNorm.includes(joined) || jaccard(qTokens, tokenize(joined)) >= 0.35) {
        const careers = topicData.career_prospects || [];
        if (careers.length) {
          return {
            answer: `**Career Prospects for ${topicName}:**\n\n${careers.map(c => `• ${c}`).join('\n')}`,
            match: topicName,
            score: 90,
            source: 'career-prospects'
          };
        }
      }
    }
  }

  // ------- Special: International experience / partner university queries -------
  const intlQuery = /(partner|university|abroad|international|double degree|joint degree|exchange)/i.test(query);
  if (intlQuery) {
    for (const [topicName, topicData] of Object.entries(sguTopics)) {
      if (topicName === 'About SGU') continue;
      const joined = norm([topicName, topicData.faculty].join(' '));
      if (joined.includes(qNorm) || qNorm.includes(joined) || jaccard(qTokens, tokenize(joined)) >= 0.3) {
        const intlExp = topicData['international academic experience'];
        if (intlExp) {
          let answer = `**International Academic Experience for ${topicName}:**\n\n`;
          if (intlExp['joint degree program']) {
            const jd = intlExp['joint degree program'];
            answer += `**Joint Degree Program:**\n`;
            if (jd.partner_university) answer += `  • Partner: ${jd.partner_university}\n`;
            if (jd.partner_universities) {
              answer += jd.partner_universities.map(p => `  • ${p.name} (${p.duration})`).join('\n') + '\n';
            }
            if (jd.duration) answer += `  • Duration: ${jd.duration}\n`;
            if (jd.degrees_awarded) answer += `  • Degrees: ${jd.degrees_awarded.join(', ')}\n`;
          }
          if (intlExp['internship program']) answer += `\n**Internship:** ${intlExp['internship program']}\n`;
          if (intlExp['student exchange']) answer += `**Student Exchange:** ${intlExp['student exchange']}\n`;
          if (intlExp['fast track program']) answer += `**Fast Track:** ${intlExp['fast track program']}\n`;
          return {
            answer,
            match: topicName,
            score: 85,
            source: 'international-experience'
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

  // ------- 2) Topic match (general) -------
  for (const [topicName, topicData] of Object.entries(sguTopics)) {
    if (topicName === 'About SGU') continue;
    const allText = flattenData(topicData);
    const topicTokens = tokenize(allText);
    let score = jaccard(qTokens, topicTokens);

    // Forgiving substring match
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
          answer: `**Lecturers from the Faculty of ${facultyTerm}:**\n\n${lecturerList}`,
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
  const composed = t.description || `This program belongs to ${t.faculty}. Learn more about ${best.topic} at SGU.`;

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
    const combined = flattenData(val);
    const sim = jaccard(tTokens, tokenize(combined));
    if (norm(combined).includes(tNorm) || sim >= 0.4)
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
    'university',
    'curriculum',
    'career',
    'partner'
  ];
  if (quickCues.some((c) => q.includes(c))) return true;

  for (const [name, data] of Object.entries(sguTopics)) {
    const joined = flattenData(data);
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
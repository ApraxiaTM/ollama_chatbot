// src/knowledge/knowledgeBase.js
import faqs from '../data/faqs.json';
import sguTopics from '../data/sgu_topics.json';

// ---------- COMPREHENSIVE SEARCH UTILITIES ----------

// Deep search through any object/array for text matching
function deepSearch(obj, searchText, path = '') {
  const results = [];
  const searchLower = searchText.toLowerCase();
  
  if (typeof obj === 'string') {
    if (obj.toLowerCase().includes(searchLower)) {
      results.push({ path, value: obj });
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      results.push(...deepSearch(item, searchText, `${path}[${index}]`));
    });
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      // Also search the keys themselves
      if (key.toLowerCase().includes(searchLower)) {
        results.push({ path: `${path}.${key}`, value: key });
      }
      results.push(...deepSearch(value, searchText, `${path}.${key}`));
    }
  }
  
  return results;
}

// Flatten object to searchable text
function flattenToText(obj) {
  if (typeof obj === 'string') return obj + ' ';
  if (Array.isArray(obj)) {
    return obj.map(item => flattenToText(item)).join(' ');
  }
  if (typeof obj === 'object' && obj !== null) {
    return Object.values(obj).map(value => flattenToText(value)).join(' ');
  }
  return '';
}

// ---------- CORE DATA EXTRACTION FUNCTIONS ----------

// Get all double degree partner universities
function getAllPartnerUniversities() {
  const partners = new Set();
  
  // Get partners from About SGU section
  const aboutSGU = sguTopics['About SGU'];
  if (aboutSGU && aboutSGU['double degree partners']) {
    aboutSGU['double degree partners'].forEach(partner => {
      if (partner.university) {
        partners.add(`${partner.university} (${partner.country || 'Unknown'})`);
      }
    });
  }
  
  // Get partners from individual programs
  for (const [programName, programData] of Object.entries(sguTopics)) {
    if (programName === 'About SGU') continue;
    
    const intlExp = programData['international academic experience'];
    if (intlExp) {
      // Check joint degree programs
      const jd = intlExp['joint degree program'];
      if (jd) {
        if (jd.partner_university) {
          partners.add(jd.partner_university);
        }
        if (jd.partner_universities) {
          jd.partner_universities.forEach(p => {
            if (p.name) partners.add(p.name);
          });
        }
      }
      
      // Check other international programs
      if (intlExp['joint degree programs']) {
        intlExp['joint degree programs'].forEach(program => {
          if (program.partner_university) {
            partners.add(program.partner_university);
          }
        });
      }
    }
  }
  
  return Array.from(partners).sort();
}

// Get double degree program information
function getDoubleDegreeInfo() {
  let info = "**Double Degree Programs at SGU:**\n\n";
  
  // About SGU description
  const aboutSGU = sguTopics['About SGU'];
  if (aboutSGU && aboutSGU.description) {
    info += `${aboutSGU.description}\n\n`;
  }
  
  // Partner universities
  const partners = getAllPartnerUniversities();
  if (partners.length > 0) {
    info += "**Partner Universities:**\n";
    partners.forEach(partner => {
      info += `• ${partner}\n`;
    });
    info += "\n";
  }
  
  // How it works from FAQs
  const faqAnswers = [];
  faqs.forEach(faq => {
    if (faq.q.toLowerCase().includes('double degree') || 
        faq.q.toLowerCase().includes('partner university')) {
      faqAnswers.push(`**${faq.q}**\n${faq.a}`);
    }
  });
  
  if (faqAnswers.length > 0) {
    info += "**Frequently Asked Questions:**\n\n";
    info += faqAnswers.join('\n\n');
  }
  
  // Add program-specific double degree info
  info += "\n**Program-Specific Double Degree Opportunities:**\n";
  for (const [programName, programData] of Object.entries(sguTopics)) {
    if (programName === 'About SGU') continue;
    
    const intlExp = programData['international academic experience'];
    if (intlExp && intlExp['joint degree program']) {
      const jd = intlExp['joint degree program'];
      info += `\n**${programName}:**\n`;
      
      if (jd.partner_university) {
        info += `• Partner: ${jd.partner_university}\n`;
      }
      if (jd.partner_universities) {
        jd.partner_universities.forEach(p => {
          info += `• Partner: ${p.name} (${p.duration || 'Duration varies'})\n`;
        });
      }
      if (jd.duration) {
        info += `• Duration: ${jd.duration}\n`;
      }
      if (jd.degrees_awarded) {
        info += `• Degrees: ${jd.degrees_awarded.join(', ')}\n`;
      }
    }
  }
  
  return info;
}

// Get all programs/majors with details
function getAllPrograms() {
  const programs = [];
  for (const [programName, programData] of Object.entries(sguTopics)) {
    if (programName === 'About SGU') continue;
    
    programs.push({
      name: programName,
      faculty: programData.faculty || 'Not specified',
      description: programData.description || 'No description available',
      hasCurriculum: !!programData.curriculum,
      hasLecturers: !!programData.lecturers,
      hasInternational: !!programData['international academic experience']
    });
  }
  return programs;
}

// Search across all data
function comprehensiveSearch(query) {
  const queryLower = query.toLowerCase();
  const results = [];
  
  // Search FAQs
  faqs.forEach(faq => {
    if (faq.q.toLowerCase().includes(queryLower) || 
        faq.a.toLowerCase().includes(queryLower) ||
        queryLower.includes(faq.q.toLowerCase())) {
      results.push({
        type: 'faq',
        question: faq.q,
        answer: faq.a,
        relevance: 'high'
      });
    }
  });
  
  // Search all topics
  for (const [topicName, topicData] of Object.entries(sguTopics)) {
    const searchText = flattenToText(topicData).toLowerCase();
    const topicNameLower = topicName.toLowerCase();
    
    let relevance = 'low';
    if (topicNameLower.includes(queryLower) || queryLower.includes(topicNameLower)) {
      relevance = 'high';
    } else if (searchText.includes(queryLower)) {
      relevance = 'medium';
    }
    
    if (relevance !== 'low') {
      results.push({
        type: 'topic',
        name: topicName,
        data: topicData,
        relevance
      });
    }
  }
  
  return results.sort((a, b) => {
    const relevanceOrder = { high: 3, medium: 2, low: 1 };
    return relevanceOrder[b.relevance] - relevanceOrder[a.relevance];
  });
}

// Get specific program curriculum
function getProgramCurriculum(programName) {
  // Find the exact program
  let programData = sguTopics[programName];
  if (!programData) {
    // Try to find by partial match
    for (const [name, data] of Object.entries(sguTopics)) {
      if (name.toLowerCase().includes(programName.toLowerCase()) || 
          programName.toLowerCase().includes(name.toLowerCase())) {
        programData = data;
        programName = name;
        break;
      }
    }
  }
  
  if (!programData || !programData.curriculum) {
    return null;
  }
  
  return formatCurriculum(programName, programData.curriculum);
}

// Format curriculum
function formatCurriculum(programName, curriculum) {
  let formatted = `**${programName} - Complete Curriculum**\n\n`;
  
  // Sort semesters
  const semesters = Object.keys(curriculum).sort((a, b) => {
    const aNum = parseInt(a.match(/\d+/)?.[0] || 0);
    const bNum = parseInt(b.match(/\d+/)?.[0] || 0);
    return aNum - bNum;
  });
  
  semesters.forEach(semester => {
    const semesterData = curriculum[semester];
    formatted += `**${semester.charAt(0).toUpperCase() + semester.slice(1)}**\n`;
    
    if (semesterData.courses && Array.isArray(semesterData.courses)) {
      semesterData.courses.forEach(course => {
        formatted += `• ${course}\n`;
      });
    } else {
      formatted += `• Curriculum details available\n`;
    }
    formatted += '\n';
  });
  
  return formatted;
}

// ---------- MAIN ANSWER GENERATOR ----------
function generateAnswer(query) {
  const queryLower = query.toLowerCase().trim();

  // 1. Double degree and partner university queries
  if (queryLower.includes('double degree') || 
      queryLower.includes('partner university') ||
      queryLower.includes('partner universities') ||
      queryLower.includes('joint degree')) {
    
    const doubleDegreeInfo = getDoubleDegreeInfo();
    return {
      answer: doubleDegreeInfo,
      source: 'knowledge-base',
      confidence: 'high'
    };
  }

  // 2. Curriculum queries
  if (queryLower.includes('curriculum') || queryLower.includes('courses') || queryLower.includes('syllabus')) {
    let targetProgram = null;
    
    // Map common queries to actual program names
    const programMap = {
      'ai': 'IT: Artificial Intelligence & Data Science',
      'data science': 'IT: Artificial Intelligence & Data Science',
      'artificial intelligence': 'IT: Artificial Intelligence & Data Science',
      'cyber': 'IT: Cyber Security',
      'security': 'IT: Cyber Security',
      'technopreneurship': 'IT: Technopreneurship',
      'global strategic': 'Global Strategic Communication',
      'mechatronics': 'Mechatronics Engineering',
      'hybrid electric': 'Hybrid Electric Vehicles',
      'food technology': 'Food Technology',
      'pharmaceutical': 'Pharmaceutical Engineering',
      'medical biotech': 'Medical Biotechnology',
      'sustainable energy': 'Sustainable Energy and Environment',
      'business management': 'Business and Management',
      'business accounting': 'Business Accounting',
      'hotel tourism': 'Hotel and Tourism Management',
      'culinary': 'International Culinary Business',
      'digital communication': 'Digital Communication & Media Arts'
    };
    
    for (const [keyword, programName] of Object.entries(programMap)) {
      if (queryLower.includes(keyword)) {
        targetProgram = programName;
        break;
      }
    }
    
    if (targetProgram) {
      const curriculum = getProgramCurriculum(targetProgram);
      if (curriculum) {
        return {
          answer: curriculum,
          source: 'knowledge-base',
          confidence: 'high'
        };
      }
    }
  }

  // 3. List all programs
  if (queryLower.includes('all programs') || queryLower.includes('list programs') || queryLower.includes('majors')) {
    const programs = getAllPrograms();
    let response = `**All Study Programs at Swiss German University**\n\n`;
    
    programs.forEach(program => {
      response += `**${program.name}**\n`;
      response += `Faculty: ${program.faculty}\n`;
      response += `${program.description}\n\n`;
    });
    
    response += `**Total: ${programs.length} programs**\n\n`;
    response += `Ask me about specific programs for more details about curriculum, lecturers, or career prospects!`;
    
    return {
      answer: response,
      source: 'knowledge-base',
      confidence: 'high'
    };
  }

  // 4. Comprehensive search fallback
  const searchResults = comprehensiveSearch(query);
  if (searchResults.length > 0) {
    const bestResult = searchResults[0];
    
    if (bestResult.type === 'faq') {
      return {
        answer: `**${bestResult.question}**\n\n${bestResult.answer}`,
        source: 'faq',
        confidence: 'high'
      };
    } else if (bestResult.type === 'topic') {
      const topic = bestResult.data;
      let response = `**${bestResult.name}**\n\n`;
      
      if (topic.faculty) response += `Faculty: ${topic.faculty}\n\n`;
      if (topic.description) response += `${topic.description}\n\n`;
      
      if (topic.lecturers && topic.lecturers.length > 0) {
        response += `**Lecturers:**\n${topic.lecturers.slice(0, 3).map(l => `• ${l}`).join('\n')}\n\n`;
      }
      
      if (topic.career_prospects && topic.career_prospects.length > 0) {
        response += `**Career Prospects:**\n${topic.career_prospects.map(c => `• ${c}`).join('\n')}\n\n`;
      }
      
      return {
        answer: response,
        source: 'topic',
        confidence: bestResult.relevance === 'high' ? 'high' : 'medium'
      };
    }
  }

  // 5. About SGU general info
  if (queryLower.includes('about sgu') || queryLower.includes('what is sgu') || queryLower.includes('swiss german university')) {
    const aboutSGU = sguTopics['About SGU'];
    if (aboutSGU) {
      let response = `**About Swiss German University (SGU)**\n\n`;
      if (aboutSGU.description) response += `${aboutSGU.description}\n\n`;
      if (aboutSGU.vision) response += `**Vision:** ${aboutSGU.vision}\n\n`;
      if (aboutSGU.mission) {
        response += `**Mission:**\n${aboutSGU.mission.map(m => `• ${m}`).join('\n')}\n\n`;
      }
      return {
        answer: response,
        source: 'about-sgu',
        confidence: 'high'
      };
    }
  }

  return null;
}

// ---------- EXPORTS ----------
export { 
  faqs, 
  sguTopics,
  getAllPrograms,
  comprehensiveSearch,
  getDoubleDegreeInfo,
  getAllPartnerUniversities,
  getProgramCurriculum,
  generateAnswer
};

export default { 
  faqs, 
  sguTopics,
  getAllPrograms,
  comprehensiveSearch,
  getDoubleDegreeInfo,
  getAllPartnerUniversities,
  getProgramCurriculum,
  generateAnswer
};
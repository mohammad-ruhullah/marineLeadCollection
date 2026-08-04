const axios = require('axios');

const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent';

const marineTitles = [
  'Technical Superintendent', 'Fleet Manager', 'Technical Manager',
  'Purchasing Manager', 'Procurement Manager', 'Marine Engineer',
  'Technical Director', 'Operations Manager', 'Marine', 'Ship',
  'Vessel', 'Tanker', 'Offshore', 'Dock', 'Yard', 'Dry',
  'Engine', 'Boiler', 'Calibration', 'Navigation', 'Radar',
  'SatCom', 'Automation', 'Hydraulic', 'Electrical', 'Electronics',
  'Repair', 'Spare', 'Fire', 'Safety', 'Onboard', 'Communication',
  'Service', 'LNG', 'LPG', 'Bulk', 'Container', 'Operator',
  'logistics', 'supply chain', 'chief engineer', 'crew', 'port',
  'supply'
];

const marineKeywords = [
  'ship', 'marine', 'maritime', 'offshore', 'tanker', 'vessel',
  'shipping', 'fleet', 'ferry', 'tug', 'supply', 'bulk',
  'container', 'lng', 'lpg', 'yard', 'dock', 'repair', 'naval',
  'seaway', 'maersk', 'mitsui', 'nyk', 'mitsubishi', 'kawasaki',
  'goltens', 'wartsila', 'man energy', 'man diesel', 'abb',
  'kongsberg', 'simrad', 'furuno', 'jrc', 'sperry', 'raytheon',
  'imtech', 'hatlapa', 'schottel', 'rolls-royce'
];

const GEMINI_MIN_INTERVAL_MS = 200;
const GEMINI_MAX_RETRIES = 2;
const GEMINI_BATCH_SIZE = 40;
const GEMINI_TIME_BUDGET_MS = 200000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let lastGeminiCall = 0;

async function callGemini(prompt, maxTokens = 80, attempt = 0) {
  const now = Date.now();
  const wait = lastGeminiCall + GEMINI_MIN_INTERVAL_MS - now;
  if (wait > 0) await sleep(wait);
  lastGeminiCall = Date.now();

  try {
    return await axios({
      method: 'post',
      url: `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
      headers: { 'Content-Type': 'application/json' },
      data: {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens }
      },
      timeout: 20000
    });
  } catch (err) {
    if (err.response?.status === 429 && attempt < GEMINI_MAX_RETRIES) {
      const backoff = (attempt + 1) * 1000;
      console.log(`Gemini rate limited (429). Retrying in ${backoff}ms...`);
      await sleep(backoff);
      return callGemini(prompt, maxTokens, attempt + 1);
    }
    throw err;
  }
}

const companyKey = (lead) => (lead.company || '').toLowerCase().trim();

const ruleResult = (lead) => ({
  is_marine: classifyByRules(lead.title, lead.company),
  source: 'rules',
  description: ''
});

function buildBatchPrompt(items) {
  const sections = items.map((item, i) => {
    const industry = item.industry || 'unknown';
    const tags = Array.isArray(item.tags) && item.tags.length > 0 ? item.tags.join(', ') : 'none';
    const website = item.website || 'unknown';
    return `${i + 1}. Company: ${item.company}
Job Title: ${item.title}
Industry: ${industry}
Keyword tags: ${tags}
Website: ${website}`;
  });

  return `You are a marine industry classifier. Classify each company below.

For each company, reply with exactly ONE line using this format:
<number>. <one-line max 10 word summary of what the company does> | YES or NO

The YES or NO must answer: does this company operate in the marine, shipping, or maritime industry? Base it on the summary AND the job title. If you don't know a company, answer NO.

${sections.join('\n\n')}`;
}

function parseBatchResponse(raw, count) {
  const results = new Array(count).fill(null);
  const lines = (raw || '').split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^(\d+)[.)]?\s*(.*)$/);
    if (!m) continue;
    const idx = parseInt(m[1], 10) - 1;
    if (idx < 0 || idx >= count) continue;
    const rest = m[2];
    const sep = rest.lastIndexOf('|');
    const verdictPart = (sep !== -1 ? rest.slice(sep + 1) : rest).trim().toUpperCase();
    const description = sep !== -1 ? rest.slice(0, sep).trim() : '';
    let isMarine = null;
    if (verdictPart.includes('YES')) isMarine = true;
    else if (verdictPart.includes('NO')) isMarine = false;
    if (isMarine !== null) results[idx] = { is_marine: isMarine, description };
  }
  return results;
}

async function classifyByGeminiBatch(items) {
  if (!GEMINI_API_KEY || items.length === 0) return null;

  try {
    const response = await callGemini(buildBatchPrompt(items), 2000);
    const raw = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!raw) return null;
    return parseBatchResponse(raw, items.length);
  } catch (err) {
    console.error('Gemini batch API error:', err.message);
    return null;
  }
}

async function classifyLeads(leads, options = {}) {
  const batchSize = options.batchSize || GEMINI_BATCH_SIZE;
  const budgetMs = options.timeBudgetMs !== undefined ? options.timeBudgetMs : GEMINI_TIME_BUDGET_MS;
  const startTime = options.startedAt || Date.now();
  const companyCache = new Map();
  const results = [];

  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    const budgetLeft = budgetMs - (Date.now() - startTime);

    if (budgetLeft <= 0) {
      for (const lead of batch) results.push(ruleResult(lead));
      continue;
    }

    const unseenIndices = [];
    batch.forEach((lead, j) => {
      if (!companyCache.has(companyKey(lead))) unseenIndices.push(j);
    });

    if (unseenIndices.length > 0) {
      const unseenLeads = unseenIndices.map(j => batch[j]);
      const aiResults = await classifyByGeminiBatch(unseenLeads);
      unseenIndices.forEach((j, u) => {
        const ai = aiResults && aiResults[u];
        const res = ai && ai.is_marine !== null && ai.is_marine !== undefined
          ? { is_marine: ai.is_marine, source: 'ai', description: ai.description || '' }
          : ruleResult(unseenLeads[u]);
        companyCache.set(companyKey(unseenLeads[u]), res);
      });
    }

    for (const lead of batch) results.push(companyCache.get(companyKey(lead)));
  }

  return results;
}

function classifyByRules(title, company) {
  const t = (title || '').toLowerCase().trim();
  const c = (company || '').toLowerCase().trim();
  for (const mt of marineTitles) {
    if (t.includes(mt.toLowerCase())) return true;
  }
  for (const mk of marineKeywords) {
    if (c.includes(mk)) return true;
  }
  return false;
}

async function classifyByGemini(title, company, orgMeta = {}) {
  if (!GEMINI_API_KEY) return null;

  const industry = orgMeta.industry || 'unknown';
  const tags = Array.isArray(orgMeta.tags) && orgMeta.tags.length > 0 ? orgMeta.tags.join(', ') : 'none';
  const website = orgMeta.website || 'unknown';

  const prompt = `You are a marine industry classifier. Reply with exactly two lines.

Line 1: a one-line (max 10 words) summary of what this company does, based on your knowledge.
Line 2: YES or NO — does this company operate in the marine, shipping, or maritime industry? Base your answer on the company description above AND the job title.

Company: ${company}
Job Title: ${title}
Industry: ${industry}
Keyword tags: ${tags}
Website: ${website}`;

  try {
    const response = await callGemini(prompt);

    const raw = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (!raw) return null;

    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const lastLine = lines[lines.length - 1] || '';
    const verdict = lastLine.toUpperCase();

    let isMarine = null;
    if (verdict === 'YES') isMarine = true;
    else if (verdict === 'NO') isMarine = false;
    else {
      const yesIdx = raw.indexOf('YES');
      const noIdx = raw.indexOf('NO');
      if (yesIdx !== -1 && (noIdx === -1 || yesIdx < noIdx)) isMarine = true;
      else if (noIdx !== -1) isMarine = false;
    }

    if (isMarine === null) return null;

    const description = lines.slice(0, -1).join(' ').replace(/^Line 1:\s*/i, '');
    return { is_marine: isMarine, description };
  } catch (err) {
    console.error('Gemini API error:', err.message);
    return null;
  }
}

async function classifyLead(title, company, orgMeta = {}) {
  if (GEMINI_API_KEY) {
    const geminiResult = await classifyByGemini(title, company, orgMeta);
    if (geminiResult !== null) {
      return { is_marine: geminiResult.is_marine, source: 'ai', description: geminiResult.description || '' };
    }
  }
  const rulesResult = classifyByRules(title, company);
  return { is_marine: rulesResult, source: 'rules', description: '' };
}

module.exports = { classifyLead, classifyByRules, classifyLeads };

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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let lastGeminiCall = 0;

async function callGemini(prompt, attempt = 0) {
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
        generationConfig: { temperature: 0.1, maxOutputTokens: 80 }
      },
      timeout: 15000
    });
  } catch (err) {
    if (err.response?.status === 429 && attempt < GEMINI_MAX_RETRIES) {
      const backoff = (attempt + 1) * 1000;
      console.log(`Gemini rate limited (429). Retrying in ${backoff}ms...`);
      await sleep(backoff);
      return callGemini(prompt, attempt + 1);
    }
    throw err;
  }
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

module.exports = { classifyLead, classifyByRules };

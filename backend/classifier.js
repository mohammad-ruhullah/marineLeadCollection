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

async function classifyByGemini(title, company) {
  if (!GEMINI_API_KEY) return null;

  const prompt = `You are a marine industry classifier. Reply ONLY with "YES" or "NO". Is the following company in the marine, shipping, or maritime industry?

Company: ${company}
Job Title: ${title}`;

  try {
    const response = await axios({
      method: 'post',
      url: `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
      headers: { 'Content-Type': 'application/json' },
      data: {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 10 }
      },
      timeout: 8000
    });

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toUpperCase() || '';
    return text === 'YES' ? true : text === 'NO' ? false : null;
  } catch (err) {
    console.error('Gemini API error:', err.message);
    return null;
  }
}

async function classifyLead(title, company) {
  if (GEMINI_API_KEY) {
    const geminiResult = await classifyByGemini(title, company);
    if (geminiResult !== null) {
      return { is_marine: geminiResult, source: 'ai' };
    }
  }
  const rulesResult = classifyByRules(title, company);
  return { is_marine: rulesResult, source: 'rules' };
}

module.exports = { classifyLead, classifyByRules };

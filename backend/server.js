const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APOLLO_API_KEY = process.env.APOLLO_API_KEY;

// Validation Middleware
const validateApolloConfig = (req, res, next) => {
  if (!APOLLO_API_KEY) {
    return res.status(500).json({ error: 'Apollo API Key is missing. Please check your .env file.' });
  }
  next();
};

// Helper to check Apollo Credit Usage
app.get('/apollo/credits', validateApolloConfig, async (req, res) => {
  try {
    const response = await axios.get('https://api.apollo.io/v1/auth/health', {
      headers: { 'X-Api-Key': APOLLO_API_KEY }
    });
    // Apollo health returns { is_logged_in: true, total_credits: 1000, used_credits: 100 }
    // Mapping to match frontend CreditData interface { total, used, remaining }
    res.json({
      total: response.data.total_credits || 0,
      used: response.data.used_credits || 0,
      remaining: (response.data.total_credits || 0) - (response.data.used_credits || 0)
    });
  } catch (error) {
    console.error('Apollo health error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch Apollo credits' });
  }
});

// Pre-flight route: Get total count for filters
app.post('/apollo/pre-flight', validateApolloConfig, async (req, res) => {
  try {
    const filters = req.body;
    console.log('Calculating leads with filters:', JSON.stringify(filters));
    const response = await axios.post('https://api.apollo.io/v1/people/search', {
      ...filters,
      page: 1,
      per_page: 1,
      contact_email_status: ["verified"]
    }, {
      headers: { 'X-Api-Key': APOLLO_API_KEY }
    });
    
    res.json({
      total_entries: response.data.pagination.total_entries
    });
  } catch (error) {
    console.error('Apollo pre-flight error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error || 'Failed to calculate leads' });
  }
});

// Bulk Fetch route: Fetch and save leads in batches
app.post('/apollo/bulk-fetch', validateApolloConfig, async (req, res) => {
  try {
    const { filters, maxLeads } = req.body;
    let totalSaved = 0;
    const perPage = 100;
    const pagesToFetch = Math.ceil(Math.min(maxLeads, 1000) / perPage); // Limit to 1000 for safety in one go

    for (let page = 1; page <= pagesToFetch; page++) {
      const response = await axios.post('https://api.apollo.io/v1/people/search', {
        ...filters,
        page: page,
        per_page: perPage,
        contact_email_status: ["verified"]
      }, {
        headers: { 'X-Api-Key': APOLLO_API_KEY }
      });

      const people = response.data.people;
      if (!people || people.length === 0) break;

      const leadsToUpsert = people.map(person => ({
        apollo_id: person.id,
        company: person.organization?.name || 'Unknown',
        contact_name: person.name,
        title: person.title,
        email: person.email,
        status: person.contact_email_status,
        country: person.country || person.organization?.country || 'Unknown',
        website: person.organization?.website_url || 'N/A',
        linkedin: person.linkedin_url || person.organization?.linkedin_url || '',
        date_added: new Date().toISOString()
      })).slice(0, Math.min(people.length, maxLeads - totalSaved));

      const { error } = await supabase
        .from('leads')
        .upsert(leadsToUpsert, { onConflict: 'apollo_id' });

      if (error) throw error;
      totalSaved += leadsToUpsert.length;
      if (totalSaved >= maxLeads) break;
    }

    res.json({ success: true, total_saved: totalSaved });
  } catch (error) {
    console.error('Apollo bulk fetch error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch and save leads' });
  }
});

app.get('/leads', async (req, res) => {
  try {
    let query = supabase.from('leads').select('*').order('date_added', { ascending: false });
    
    Object.keys(req.query).forEach(key => {
      query = query.eq(key, req.query[key]);
    });

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/settings', async (req, res) => {
  try {
    const { data, error } = await supabase.from('settings').select('*');
    if (error) throw error;

    // Grouping for FilterSidebar
    const grouped = {
      countries: data.filter(s => s.type === 'country').map(s => s.value),
      titles: data.filter(s => s.type === 'title').map(s => s.value),
      keywords: data.filter(s => s.type === 'keyword').map(s => s.value),
      raw: data // For AdminSettings
    };
    
    res.json(grouped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/settings', async (req, res) => {
  const { type, value } = req.body;
  const { data, error } = await supabase.from('settings').insert([{ type, value }]);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/settings/:id', async (req, res) => {
  const { error } = await supabase.from('settings').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;


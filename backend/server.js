const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

// Robust dotenv loading: explicitly target backend/.env
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// Trim the API key to handle accidental spaces/newlines in .env
const APOLLO_API_KEY = (process.env.APOLLO_API_KEY || '').trim();

// Validation Middleware
const validateApolloConfig = (req, res, next) => {
  if (!APOLLO_API_KEY) {
    console.error('CRITICAL ERROR: APOLLO_API_KEY is missing from process.env');
    return res.status(500).json({ error: 'Apollo API Key is missing. Please check your backend/.env file.' });
  }
  next();
};

// Helper to check Apollo Credit Usage
app.get('/apollo/credits', validateApolloConfig, async (req, res) => {
  try {
    const response = await axios({
      method: 'get',
      url: 'https://api.apollo.io/api/v1/auth/health',
      headers: { 
        'X-Api-Key': APOLLO_API_KEY,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
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
  const filters = req.body;
  const payload = {
    ...filters,
    page: 1,
    per_page: 1,
    contact_email_status_v2: ["verified"]
  };

  try {
    console.log('--- APOLLO SEARCH REQUEST START ---');
    console.log('Payload:', JSON.stringify(payload));
    
    const response = await axios({
      method: 'post',
      url: 'https://api.apollo.io/api/v1/mixed_people/api_search',
      headers: { 
        'X-Api-Key': APOLLO_API_KEY,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      data: payload
    });
    
    console.log('Apollo Search Response Status:', response.status);
    
    if (!response.data.pagination) {
      console.log('DEBUG: Missing pagination. Keys:', Object.keys(response.data));
      const fallbackCount = response.data.total_entries || (response.data.people ? response.data.people.length : 0);
      return res.json({ total_entries: fallbackCount });
    }

    res.json({
      total_entries: response.data.pagination.total_entries || 0
    });
  } catch (error) {
    console.error('--- APOLLO SEARCH REQUEST FAILED ---');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Message:', error.message);
    }
    res.status(500).json({ 
      error: error.response?.data?.error || error.message || 'Failed to calculate leads' 
    });
  } finally {
    console.log('--- APOLLO SEARCH REQUEST END ---');
  }
});

// Bulk Fetch route: Fetch and save leads in batches
app.post('/apollo/bulk-fetch', validateApolloConfig, async (req, res) => {
  try {
    const { filters, maxLeads } = req.body;
    let totalSaved = 0;
    const perPage = 100;
    const maxBulkMatch = 10; // Apollo recommends batching for bulk_match
    const pagesToFetch = Math.ceil(Math.min(maxLeads, 1000) / perPage);

    console.log(`--- BULK FETCH START: targeting ${maxLeads} leads ---`);

    for (let page = 1; page <= pagesToFetch; page++) {
      console.log(`Step 1: Searching page ${page}...`);
      const searchResponse = await axios({
        method: 'post',
        url: 'https://api.apollo.io/api/v1/mixed_people/api_search',
        headers: { 
          'X-Api-Key': APOLLO_API_KEY,
          'Content-Type': 'application/json'
        },
        data: {
          ...filters,
          page: page,
          per_page: perPage,
          contact_email_status_v2: ["verified"]
        }
      });

      const people = searchResponse.data.people || [];
      const personIds = people.map(p => p.id);
      
      if (personIds.length === 0) {
        console.log(`DEBUG: No more people found on page ${page}. stopping.`);
        break;
      }

      console.log(`Step 2: Enriching ${personIds.length} people from page ${page}...`);
      
      // Step 2: Enrich Person Profiles to get Emails (Consumes Credits)
      // Apollo /bulk_match requires a "details" array of objects
      for (let i = 0; i < personIds.length; i += maxBulkMatch) {
        const batchIds = personIds.slice(i, i + maxBulkMatch);
        const details = batchIds.map(id => ({ id }));
        
        try {
          const enrichResponse = await axios({
            method: 'post',
            url: 'https://api.apollo.io/api/v1/people/bulk_match',
            headers: { 
              'X-Api-Key': APOLLO_API_KEY,
              'Content-Type': 'application/json'
            },
            data: {
              details: details,
              reveal_personal_emails: true
            }
          });

          const matchedPeople = enrichResponse.data.matches || enrichResponse.data.people || [];
          if (matchedPeople.length === 0) continue;

          const leadsToUpsert = matchedPeople.map(person => ({
            apollo_id: person.id,
            company: person.organization?.name || 'Unknown',
            contact_name: person.name,
            title: person.title,
            email: person.email,
            status: person.contact_email_status || 'verified',
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
          console.log(`Saved ${totalSaved}/${maxLeads} leads so far...`);
          
          if (totalSaved >= maxLeads) break;
        } catch (enrichError) {
          console.error('--- APOLLO ENRICHMENT FAILED ---');
          if (enrichError.response) {
            console.error('Status:', enrichError.response.status);
            console.error('Data:', JSON.stringify(enrichError.response.data, null, 2));
          } else {
            console.error('Message:', enrichError.message);
          }
          throw enrichError;
        }
      }
      
      if (totalSaved >= maxLeads) break;
    }

    console.log(`--- BULK FETCH COMPLETE: Saved ${totalSaved} leads ---`);
    res.json({ success: true, total_saved: totalSaved });
  } catch (error) {
    console.error('Apollo bulk fetch process error:', error.response?.data || error.message);
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

    console.log(`Fetched ${data.length} settings from DB.`);

    const getField = (item, field1, field2) => item[field1] || item[field2];

    const grouped = {
      countries: data.filter(s => getField(s, 'type', 'category') === 'country').map(s => s.value),
      titles: data.filter(s => getField(s, 'type', 'category') === 'title').map(s => s.value),
      keywords: data.filter(s => getField(s, 'type', 'category') === 'keyword').map(s => s.value),
      raw: data.map(s => ({ ...s, type: getField(s, 'type', 'category') }))
    };
    
    res.json(grouped);
  } catch (error) {
    console.error('Settings fetch error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/settings', async (req, res) => {
  const { type, value } = req.body;
  const payload = { value };
  payload.type = type;
  payload.category = type;

  const { data, error } = await supabase.from('settings').insert([payload]);
  if (error) {
    console.error('Settings insert error:', error.message);
    return res.status(500).json({ error: error.message });
  }
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

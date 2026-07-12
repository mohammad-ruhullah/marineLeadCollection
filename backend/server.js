const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

// Only load dotenv in local development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.resolve(__dirname, '.env') });
}

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Supabase only if variables exist
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
  console.error('CRITICAL: Supabase environment variables are missing!');
}

const APOLLO_API_KEY = (process.env.APOLLO_API_KEY || '').trim();
const HUNTER_API_KEY = (process.env.HUNTER_API_KEY || '').trim();

// Validation Middleware
const validateApolloConfig = (req, res, next) => {
  if (!APOLLO_API_KEY) {
    console.error('CRITICAL ERROR: APOLLO_API_KEY is missing from process.env');
    return res.status(500).json({ error: 'Apollo API Key is missing. Please check your backend/.env file.' });
  }
  next();
};

const validateHunterConfig = (req, res, next) => {
  if (!HUNTER_API_KEY) {
    console.error('CRITICAL ERROR: HUNTER_API_KEY is missing from process.env');
    return res.status(500).json({ error: 'Hunter API Key is missing. Please check your backend/.env file.' });
  }
  next();
};

const router = express.Router();

// Pre-flight route: Get total count for filters
router.post('/apollo/pre-flight', validateApolloConfig, async (req, res) => {
  const filters = req.body;
  const payload = {
    ...filters,
    page: 1,
    per_page: 1,
    contact_email_status_v2: ["verified"]
  };

  try {
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
    
    // As confirmed by logs, total_entries is at the root level for this endpoint
    const count = response.data.total_entries || (response.data.pagination ? response.data.pagination.total_entries : 0);
    
    res.json({
      total_entries: count || 0
    });
  } catch (error) {
    console.error('Apollo pre-flight error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error || 'Failed to calculate leads' });
  }
});

// Bulk Fetch route: Fetch and save leads in batches
router.post('/apollo/bulk-fetch', validateApolloConfig, async (req, res) => {
  try {
    const { filters, maxLeads, category } = req.body;
    let totalSaved = 0;
    let totalSkipped = 0;
    const perPage = 100;
    const maxBulkMatch = 10;
    const MAX_SAFE_PAGES = 50;
    let page = 1;

    console.log(`--- BULK FETCH START: targeting ${maxLeads} new leads ---`);

    while (totalSaved < maxLeads && page <= MAX_SAFE_PAGES) {
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
        console.log('No more leads from Apollo. Stopping.');
        break;
      }

      // --- CREDIT SAVING LOGIC: Check database before enrichment ---
      const { data: existingLeads, error: checkError } = await supabase
        .from('leads')
        .select('apollo_id')
        .in('apollo_id', personIds);

      if (checkError) console.error('Error checking existing leads:', checkError);
      
      const existingIds = new Set((existingLeads || []).map(l => l.apollo_id));
      const newPersonIds = personIds.filter(id => !existingIds.has(id));
      totalSkipped += existingIds.size;

      if (newPersonIds.length === 0) {
        console.log(`Page ${page}: All ${personIds.length} leads already exist. Skipping.`);
        page++;
        continue;
      }

      console.log(`Page ${page}: ${newPersonIds.length} new leads (skipped ${existingIds.size} existing). Total new so far: ${totalSaved}`);

      for (let i = 0; i < newPersonIds.length; i += maxBulkMatch) {
        const batchIds = newPersonIds.slice(i, i + maxBulkMatch);
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

          const remaining = maxLeads - totalSaved;
          const leadsToUpsert = matchedPeople.map(person => ({
            apollo_id: person.id,
            company: person.organization?.name || 'Unknown',
            contact_name: person.name,
            title: person.title,
            email: person.email,
            status: 'Not Verified',
            country: person.country || person.organization?.country || 'Unknown',
            website: person.organization?.website_url || 'N/A',
            linkedin: person.linkedin_url || person.organization?.linkedin_url || '',
            category: category || null
          })).slice(0, Math.min(matchedPeople.length, remaining));

          const { error } = await supabase
            .from('leads')
            .upsert(leadsToUpsert, { onConflict: 'apollo_id' });

          if (error) throw error;
          totalSaved += leadsToUpsert.length;
          console.log(`Saved ${totalSaved}/${maxLeads} leads...`);
          
          if (totalSaved >= maxLeads) break;
        } catch (enrichError) {
          console.error('Apollo enrichment batch error:', enrichError.response?.data || enrichError.message);
          throw enrichError;
        }
      }
      
      page++;
    }

    console.log(`--- BULK FETCH END: saved ${totalSaved} new leads (skipped ${totalSkipped} existing) ---`);
    res.json({ success: true, total_saved: totalSaved });
  } catch (error) {
    console.error('Apollo bulk fetch process error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to fetch and save leads' });
  }
});

router.post('/apollo/leads/verify', validateHunterConfig, async (req, res) => {
  try {
    const { limit = 5 } = req.body; // Default to 5 if not provided
    console.log(`--- STARTING HUNTER.IO VERIFICATION (BATCH SIZE: ${limit}) ---`);
    
    // 1. Fetch leads with "Not Verified" status with a limit
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .eq('status', 'Not Verified')
      .limit(limit);

    if (error) throw error;
    if (!leads || leads.length === 0) {
      return res.json({ success: true, message: 'No leads pending verification', processed: 0 });
    }

    console.log(`Processing batch of ${leads.length} leads.`);
    let processedCount = 0;

    // 2. Process each lead
    for (const lead of leads) {
      if (!lead.email) {
        // Skip leads without email
        await supabase
          .from('leads')
          .update({ status: 'Invalid' })
          .eq('apollo_id', lead.apollo_id);
        continue;
      }

      try {
        // Call Hunter.io API
        const response = await axios({
          method: 'get',
          url: `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(lead.email)}&api_key=${HUNTER_API_KEY}`,
          timeout: 10000 // 10 second timeout for individual email
        });

        const hunterData = response.data ? response.data.data : null;
        
        if (!hunterData || !hunterData.result) {
          console.log(`Hunter.io returned no result for ${lead.email}, marking as No Result Found.`);
          await supabase
            .from('leads')
            .update({ status: 'No Result Found' })
            .eq('apollo_id', lead.apollo_id);
          processedCount++; // Count as processed to move the progress bar
          continue;
        }

        let newStatus = 'Risky';
        if (hunterData.result === 'deliverable') {
          newStatus = 'Verified';
        } else if (hunterData.result === 'undeliverable') {
          newStatus = 'Invalid';
        }

        // 3. Update Supabase
        await supabase
          .from('leads')
          .update({ status: newStatus })
          .eq('apollo_id', lead.apollo_id);

        processedCount++;
        console.log(`Verified ${lead.email}: ${newStatus}`);

        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 150)); 

      } catch (hunterError) {
        // Handle 202 Accepted (processing) or other non-200 responses
        if (hunterError.response?.status === 202) {
          console.log(`Hunter.io still processing ${lead.email}, marking as No Result Found.`);
          await supabase
            .from('leads')
            .update({ status: 'No Result Found' })
            .eq('apollo_id', lead.apollo_id);
          processedCount++;
          continue;
        }
        
        console.error(`Hunter.io error for ${lead.email}:`, hunterError.response?.data || hunterError.message);
        
        // Mark as "No Result Found" even on error to prevent infinite loops
        await supabase
            .from('leads')
            .update({ status: 'No Result Found' })
            .eq('apollo_id', lead.apollo_id);
        processedCount++;

        if (hunterError.response?.status === 401 || hunterError.response?.status === 403) {
          throw new Error('Hunter.io API Key is invalid or restricted');
        }
      }
    }

    res.json({ success: true, processed: processedCount });
  } catch (error) {
    console.error('Hunter verification process error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/leads', async (req, res) => {
  try {
    console.log('Fetching leads from Supabase...');
    const pageSize = 1000;
    let allData = [];
    let start = 0;

    while (true) {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .range(start, start + pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allData = allData.concat(data);
      if (data.length < pageSize) break;
      start += pageSize;
    }
    
    // Sort manually in JS to be safe against missing columns in DB order
    const sortedData = allData.sort((a, b) => {
      const dateA = new Date(a.created_at || a.date_added || a.id || 0).getTime();
      const dateB = new Date(b.created_at || b.date_added || b.id || 0).getTime();
      return dateB - dateA;
    });

    console.log(`Successfully fetched ${sortedData.length} leads.`);
    res.json(sortedData);
  } catch (error) {
    console.error('Fetch leads error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/settings', async (req, res) => {
  try {
    const { data, error } = await supabase.from('settings').select('*');
    if (error) throw error;

    console.log(`Fetched ${data.length} settings from DB.`);

    const getField = (item, field1, field2) => item[field1] || item[field2];

    const grouped = {
      countries: data.filter(s => getField(s, 'type', 'category') === 'country').map(s => s.value),
      titles: data.filter(s => getField(s, 'type', 'category') === 'title').map(s => s.value),
      excludeTitles: data.filter(s => getField(s, 'type', 'category') === 'exclude_title').map(s => s.value),
      keywords: data.filter(s => getField(s, 'type', 'category') === 'keyword').map(s => s.value),
      raw: data.map(s => ({ ...s, type: getField(s, 'type', 'category') }))
    };
    
    res.json(grouped);
  } catch (error) {
    console.error('Settings fetch error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const { type, value } = req.body;
    if (!type || !value) {
      return res.status(400).json({ error: 'Type and value are required' });
    }

    const payload = { 
      category: type,
      value: value 
    };

    console.log('--- DEBUG: Inserting setting into category column:', payload);

    const { data, error } = await supabase
      .from('settings')
      .insert([payload])
      .select();

    if (error) {
      console.error('Settings insert error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log('Setting inserted successfully:', data);
    res.json(data);
  } catch (error) {
    console.error('Settings post route error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/settings/:id', async (req, res) => {
  const { error } = await supabase.from('settings').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Mount the router under both /api and / to handle different environments
app.use('/api', router);
app.use('/', router);

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;

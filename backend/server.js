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
app.use(express.json({ limit: '10mb' }));

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

const { classifyLead } = require('./classifier');

const router = express.Router();

// Preview route: Fetch, dedup, classify, loop until targetLeads met (FREE - no enrichment cost)
router.post('/apollo/preview', validateApolloConfig, async (req, res) => {
  try {
    const { filters, targetLeads = 100 } = req.body;
    let collected = [];
    const perPage = 100;
    const MAX_SAFE_PAGES = 50;
    let page = 1;

    console.log(`--- PREVIEW START: targeting ${targetLeads} new leads ---`);

    while (collected.length < targetLeads && page <= MAX_SAFE_PAGES) {
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
      if (people.length === 0) {
        console.log('No more leads from Apollo. Stopping.');
        break;
      }

      const excludedKeywords = (filters.exclude_org_keywords || []).map(k => k.toLowerCase().trim());
      const filteredPeople = excludedKeywords.length > 0
        ? people.filter(p => {
            const orgName = (p.organization?.name || '').toLowerCase();
            return !excludedKeywords.some(kw => orgName.includes(kw));
          })
        : people;

      if (filteredPeople.length === 0) {
        console.log(`Page ${page}: all ${people.length} leads excluded by company keywords. Skipping.`);
        page++;
        continue;
      }

      const personIds = filteredPeople.map(p => p.id);
      const { data: existingLeads, error: checkError } = await supabase
        .from('leads')
        .select('apollo_id')
        .in('apollo_id', personIds);

      if (checkError) console.error('Error checking existing leads:', checkError);
      const existingIds = new Set((existingLeads || []).map(l => l.apollo_id));

      const newPeople = filteredPeople.filter(p => !existingIds.has(p.id));
      console.log(`Page ${page}: ${newPeople.length} new out of ${people.length} (${existingIds.size} skipped)`);

      for (const person of newPeople) {
        if (collected.length >= targetLeads) break;
        const org = person.organization || {};
        const classification = await classifyLead(person.title, org.name || '', {
          industry: org.industry,
          tags: org.tags,
          website: org.website_url
        });
        collected.push({
          apollo_id: person.id,
          name: `${person.first_name || ''} ${(person.last_name_obfuscated || '').replace('***', '')}`.trim() || person.name || '',
          title: person.title,
          company: org.name || 'Unknown',
          country: person.country || org.country || 'Unknown',
          is_marine: classification.is_marine,
          classification_source: classification.source,
          description: classification.description || ''
        });
      }

      page++;
    }

    const classifierSource = collected.some(l => l.classification_source === 'ai') ? 'ai' : 'rules';
    console.log(`--- PREVIEW END: collected ${collected.length} new leads (classifier: ${classifierSource}) ---`);
    res.json({
      target: targetLeads,
      total_found: collected.length,
      classifier: classifierSource,
      leads: collected
    });
  } catch (error) {
    console.error('Preview error:', error.response?.data || error.message);
    res.status(500).json({ error: error.message || 'Failed to preview leads' });
  }
});

// Save leads route: Save previewed leads to DB without emails (FREE - no enrichment cost)
router.post('/apollo/save-leads', validateApolloConfig, async (req, res) => {
  try {
    const { leads, category } = req.body;
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: 'No leads provided' });
    }

    console.log(`--- SAVE LEADS START: ${leads.length} leads ---`);

    const leadsToInsert = leads.map(lead => ({
      apollo_id: lead.apollo_id,
      company: lead.company || 'Unknown',
      contact_name: lead.name || '',
      title: lead.title || '',
      email: '',
      status: 'Not Enriched',
      country: lead.country || 'Unknown',
      website: '',
      linkedin: '',
      category: category || null
    }));

    // Check for existing leads to avoid overwriting enriched data
    const ids = leadsToInsert.map(l => l.apollo_id);
    const { data: existingLeads, error: checkError } = await supabase
      .from('leads')
      .select('apollo_id')
      .in('apollo_id', ids);

    if (checkError) console.error('Error checking existing leads:', checkError);
    const existingIds = new Set((existingLeads || []).map(l => l.apollo_id));
    const trulyNew = leadsToInsert.filter(l => !existingIds.has(l.apollo_id));

    if (trulyNew.length === 0) {
      return res.json({ success: true, total_saved: 0 });
    }

    const { error } = await supabase
      .from('leads')
      .upsert(trulyNew, { onConflict: 'apollo_id' });

    if (error) throw error;
    console.log(`--- SAVE LEADS END: saved ${trulyNew.length} leads ---`);
    res.json({ success: true, total_saved: trulyNew.length });
  } catch (error) {
    console.error('Save leads error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to save leads' });
  }
});

// Enrich emails route: Apollo bulk_match for leads with status "Not Enriched" (costs credits)
router.post('/apollo/enrich-emails', validateApolloConfig, async (req, res) => {
  try {
    const { limit = 100, ids } = req.body;
    let leads;

    if (ids && Array.isArray(ids) && ids.length > 0) {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .in('apollo_id', ids);
      if (error) throw error;
      leads = data || [];
    } else {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('status', 'Not Enriched')
        .limit(limit);
      if (error) throw error;
      leads = data || [];
    }

    if (!leads || leads.length === 0) {
      return res.json({ success: true, processed: 0 });
    }

    console.log(`--- ENRICH EMAILS START: ${leads.length} leads ---`);

    const apolloIds = leads.map(l => l.apollo_id);
    const maxBulkMatch = 10;
    let totalProcessed = 0;
    let lastError = null;

    for (let i = 0; i < apolloIds.length; i += maxBulkMatch) {
      const batchIds = apolloIds.slice(i, i + maxBulkMatch);
      const details = batchIds.map(id => ({ id }));

      try {
        console.log(`DEBUG: Calling bulk_match with ${batchIds.length} IDs: ${batchIds[0]}...`);
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
          },
          timeout: 30000
        });

        console.log(`DEBUG: bulk_match status: ${enrichResponse.status}, has matches: ${!!enrichResponse.data.matches}, has people: ${!!enrichResponse.data.people}`);
        const matchedPeople = enrichResponse.data.matches || enrichResponse.data.people || [];
        console.log(`DEBUG: matchedPeople count: ${matchedPeople.length}`);
        if (matchedPeople.length === 0) {
          console.log(`WARNING: No matches returned for batch. Response keys: ${Object.keys(enrichResponse.data).join(', ')}`);
        } else {
          console.log(`DEBUG: First match: ${matchedPeople[0].name || 'unnamed'} - email: ${matchedPeople[0].email || 'none'}`);
          for (const person of matchedPeople) {
            await supabase
              .from('leads')
              .update({
                email: person.email || '',
                linkedin: person.linkedin_url || person.organization?.linkedin_url || '',
                website: person.organization?.website_url || 'N/A',
                status: 'Not Verified'
              })
              .eq('apollo_id', person.id);
            totalProcessed++;
          }
        }
      } catch (enrichError) {
        lastError = enrichError.response?.data?.error || enrichError.message;
        console.error('Enrichment batch error:', lastError);
      }
    }

    console.log(`--- ENRICH EMAILS END: processed ${totalProcessed} leads ---`);
    if (totalProcessed === 0 && leads.length > 0) {
      return res.status(500).json({ error: lastError || 'Enrichment returned no results. Check API key credits and permissions.' });
    }
    res.json({ success: true, processed: totalProcessed });
  } catch (error) {
    console.error('Enrich emails error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to enrich emails' });
  }
});

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
      const excludedKeywords = (filters.exclude_org_keywords || []).map(k => k.toLowerCase().trim());
      const filteredPeople = excludedKeywords.length > 0
        ? people.filter(p => {
            const orgName = (p.organization?.name || '').toLowerCase();
            return !excludedKeywords.some(kw => orgName.includes(kw));
          })
        : people;

      const personIds = filteredPeople.map(p => p.id);

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
    const { limit = 5, ids } = req.body;
    let leads;

    if (ids && Array.isArray(ids) && ids.length > 0) {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .in('apollo_id', ids);
      if (error) throw error;
      leads = data || [];
    } else {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('status', 'Not Verified')
        .limit(limit);
      if (error) throw error;
      leads = data || [];
    }

    if (!leads || leads.length === 0) {
      return res.json({ success: true, message: 'No leads pending verification', processed: 0 });
    }

    console.log(`Processing batch of ${leads.length} leads in parallel.`);
    let processedCount = 0;

    // 2. Process all leads in parallel
    const verifyOneLead = async (lead) => {
      if (!lead.email) {
        await supabase
          .from('leads')
          .update({ status: 'Invalid' })
          .eq('apollo_id', lead.apollo_id);
        return 1;
      }

      try {
        const response = await axios({
          method: 'get',
          url: `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(lead.email)}&api_key=${HUNTER_API_KEY}`,
          timeout: 10000
        });

        const hunterData = response.data ? response.data.data : null;
        
        if (!hunterData || !hunterData.result) {
          await supabase
            .from('leads')
            .update({ status: 'No Result Found' })
            .eq('apollo_id', lead.apollo_id);
          return 1;
        }

        let newStatus = 'Verified';
        if (hunterData.result === 'undeliverable') {
          newStatus = 'Invalid';
        }

        await supabase
          .from('leads')
          .update({ status: newStatus })
          .eq('apollo_id', lead.apollo_id);

        console.log(`Verified ${lead.email}: ${newStatus}`);
        return 1;

      } catch (hunterError) {
        if (hunterError.response?.status === 202) {
          await supabase
            .from('leads')
            .update({ status: 'No Result Found' })
            .eq('apollo_id', lead.apollo_id);
          return 1;
        }
        
        console.error(`Hunter.io error for ${lead.email}:`, hunterError.response?.data || hunterError.message);
        
        await supabase
            .from('leads')
            .update({ status: 'No Result Found' })
            .eq('apollo_id', lead.apollo_id);

        if (hunterError.response?.status === 401 || hunterError.response?.status === 403) {
          throw new Error('Hunter.io API Key is invalid or restricted');
        }
        return 1;
      }
    };

    const results = await Promise.allSettled(leads.map(lead => verifyOneLead(lead)));
    processedCount = results.filter(r => r.status === 'fulfilled').reduce((sum, r) => sum + r.value, 0);

    await new Promise(resolve => setTimeout(resolve, 150));

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
        .neq('status', 'Deleted')
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

// Soft-delete leads: keeps the row in DB but marks it Deleted so it's never shown or re-fetched
router.post('/leads/soft-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No lead IDs provided' });
    }

    const { error } = await supabase
      .from('leads')
      .update({ status: 'Deleted' })
      .in('apollo_id', ids);

    if (error) throw error;
    console.log(`Soft-deleted ${ids.length} leads.`);
    res.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error('Soft delete leads error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to delete leads' });
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
      excludeKeywords: data.filter(s => getField(s, 'type', 'category') === 'exclude_keyword').map(s => s.value),
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

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return res.status(400).json({ error: 'Value cannot be empty' });
    }

    const { data: existing, error: checkError } = await supabase
      .from('settings')
      .select('id')
      .eq('category', type)
      .ilike('value', trimmedValue);

    if (checkError) {
      console.error('Settings duplicate check error:', checkError.message);
      return res.status(500).json({ error: checkError.message });
    }

    if (existing && existing.length > 0) {
      return res.status(409).json({ error: `This option already exists: "${trimmedValue}"` });
    }

    const payload = { 
      category: type,
      value: trimmedValue 
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

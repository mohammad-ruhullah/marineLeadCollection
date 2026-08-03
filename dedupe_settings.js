const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function dedupe() {
  console.log('Fetching all settings...');

  const { data, error } = await supabase
    .from('settings')
    .select('id, category, value')
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching settings:', error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('No settings to dedupe.');
    return;
  }

  const seen = new Map();
  const duplicates = [];

  for (const row of data) {
    const key = `${(row.category || '').toLowerCase()}::${(row.value || '').toLowerCase().trim()}`;
    if (seen.has(key)) {
      duplicates.push(row.id);
    } else {
      seen.set(key, row.id);
    }
  }

  if (duplicates.length === 0) {
    console.log(`No duplicates found. ${data.length} settings are all unique.`);
    return;
  }

  console.log(`Found ${duplicates.length} duplicate(s). Deleting...`);

  const { error: deleteError } = await supabase
    .from('settings')
    .delete()
    .in('id', duplicates);

  if (deleteError) {
    console.error('Error deleting duplicates:', deleteError.message);
    process.exit(1);
  }

  console.log(`Deleted ${duplicates.length} duplicate(s). ${data.length - duplicates.length} settings remaining.`);
}

dedupe();

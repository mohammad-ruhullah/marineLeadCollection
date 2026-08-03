const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const excludeTitles = [
  "Recruiter", "Talent Acquisition", "Crew Manager", "Crewing Manager",
  "Manning Manager", "Training Manager", "Instructor", "Lecturer",
  "Professor", "Student", "Receptionist", "Secretary", "Office Assistant",
  "Administrative Assistant", "Accountant", "Finance Manager", "Legal Manager",
  "Lawyer", "Digital Marketing", "Social Media Manager",
  "Customer Service Representative"
];

const excludeKeywords = [
  "Crew Manning Agency", "Manning Company", "Recruitment Agency",
  "Crewing Services", "Seafarer Recruitment", "Maritime Academy",
  "Maritime University", "Maritime College", "Training Institute",
  "Simulator Training Center", "Freight Forwarder", "Logistics Company",
  "Customs Broker", "Courier Company", "Trucking Company", "Warehouse Company",
  "Cargo Handling", "Port Services", "Port Agent", "Ship Agent",
  "Port Authority", "Terminal Operator", "Stevedoring Company",
  "Insurance Company", "Bank", "Finance Company", "Law Firm",
  "Accounting Firm", "Consulting Firm", "Travel Agency", "Hotel",
  "Tourism Company", "Yacht Charter Company", "Cruise Travel Agency",
  "Industrial Automation", "Factory Automation", "Building Automation",
  "Industrial Electrical Contractor", "Civil Engineering", "Construction Company",
  "Solar Company", "Renewable Energy Company", "Wind Energy Company",
  "Data Center", "Water Treatment", "Telecom Company", "General Trading Company",
  "Consumer Electronics", "Home Electrical Company", "IT Company",
  "Software Company", "Hardware Shop", "Automotive Company",
  "Aircraft Maintenance", "Railway Engineering", "Retail Shop",
  "E-commerce Seller", "Local Distributor", "Consumer Product Supplier"
];

async function seed() {
  console.log('Fetching existing settings...');

  const { data: existing, error: fetchError } = await supabase
    .from('settings')
    .select('category, value');

  if (fetchError) {
    console.error('Error fetching settings:', fetchError.message);
    process.exit(1);
  }

  const seen = new Set((existing || []).map(s => `${(s.category || '').toLowerCase()}::${(s.value || '').toLowerCase().trim()}`));

  const dataToInsert = [
    ...excludeTitles.map(v => ({ category: 'exclude_title', value: v })),
    ...excludeKeywords.map(v => ({ category: 'exclude_keyword', value: v }))
  ].filter(item => !seen.has(`${item.category}::${item.value.toLowerCase().trim()}`));

  if (dataToInsert.length === 0) {
    console.log('All exclusion terms already exist. Nothing to insert.');
    return;
  }

  const { error } = await supabase
    .from('settings')
    .insert(dataToInsert);

  if (error) {
    console.error('Error seeding exclusions:', error.message);
    process.exit(1);
  }

  console.log(`Successfully inserted ${dataToInsert.length} exclusion settings.`);
}

seed();

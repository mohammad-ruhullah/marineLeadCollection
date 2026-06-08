const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const countries = [
  "Greece", "Singapore", "United Arab Emirates", "China", "Netherlands", 
  "Germany", "Norway", "Japan", "South Korea", "Malaysia", 
  "Turkey", "Cyprus", "India", "Vietnam", "United Kingdom", 
  "Denmark", "Belgium", "Italy", "France", "Spain", 
  "Iceland", "Poland", "Croatia", "Romania", "Bulgaria", 
  "Malta", "Portugal", "Taiwan", "Indonesia", "Thailand", 
  "Philippines", "Saudi Arabia", "Qatar", "Oman", "Kuwait"
];

const titles = [
  "Technical Superintendent", "Fleet Manager", "Technical Manager", 
  "Purchasing Manager", "Procurement Manager", "Marine Engineer", 
  "Technical Director", "Operations Manager"
];

const keywords = [
  "Marine Automation", "Marine Navigation", "Marine Hydraulic", 
  "Engine Spare Parts", "Ship Repair", "Marine Electrical", 
  "Marine Electronics", "Shipyard", "Drydock", "Ship Owners", 
  "Ship Management", "Tanker Operators", "Bulk Carrier", 
  "Container Shipping", "Offshore Operators", "Marine Service", 
  "Marine Equipment"
];

async function seed() {
  console.log('Starting seed...');
  
  const dataToInsert = [
    ...countries.map(v => ({ category: 'country', value: v })),
    ...titles.map(v => ({ category: 'title', value: v })),
    ...keywords.map(v => ({ category: 'keyword', value: v }))
  ];

  const { error } = await supabase
    .from('settings')
    .insert(dataToInsert);

  if (error) {
    console.error('Error seeding data:', error);
  } else {
    console.log(`Successfully inserted ${dataToInsert.length} settings.`);
  }
}

seed();

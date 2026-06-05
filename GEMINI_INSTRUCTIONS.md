Instruction for Gemini CLI: Read this file entirely. You are to act as a Senior Full-Stack Developer. Execute the steps one by one. After completing each step, stop and wait for me to say "PROCEED" or "FIX". Do not skip steps.
Phase 1: Backend Architecture (Node.js/Express)
Step 1: Initialize the backend folder. Install express, axios, dotenv, cors, and @supabase/supabase-js. Create a basic server.js with health-check and CORS enabled.
Step 2: Create the Apollo Integration route. Implement a GET request to https://api.apollo.io/v1/auth/health to return total and used credits. Use variables from .env.
Step 3: Create the "Pre-Flight" route. Implement a POST request to Apollo /people/search that sends filters but returns ONLY pagination.total_entries.
Step 4: Create the "Bulk Fetch" route. Implement a loop that fetches leads in batches of 100.
Constraint: Must use contact_email_status: ["verified"].
Constraint: Must use Supabase .upsert() with onConflict: 'apollo_id' to prevent duplicates.
Phase 2: Frontend Structure (React & Tailwind)
Step 5: Initialize React in the frontend folder using Tailwind CSS.
Step 6: Create the Main Header Component. It must display a single Progress Bar for "API Credit Usage" based on Step 2.
Step 7: Create the Filter Sidebar. Build multi-select dropdowns for Country, Job Title, and Keywords. Data should be fetched from the settings table in Supabase.
Step 8: Create the Search Logic & Modal. Build a "Calculate" button that triggers Step 3. Show a Modal with the lead count and a "Max Leads" input. Add a "Confirm" button to trigger the Batch Fetch.
Phase 3: Lead Management (The CRM)
Step 9: Create the Saved Leads Table. Fetch all data from the Supabase leads table.
Columns: Company, Contact Name, Title, Email, Status, Country, Website, LinkedIn, Date Added.
Step 10: Implement Local Filtering. Add a search bar to filter the displayed table by Company or Country without calling the API.
Step 11: Implement CSV Export. Add a button to download the current table view as a CSV file.
Phase 4: Admin & Cleanup
Step 12: Create the Admin Settings Page. Build a simple UI to Add/Delete entries in the settings table (Countries, Titles, Keywords).
Step 13: Final audit. Ensure all API calls are secure and UI is responsive.

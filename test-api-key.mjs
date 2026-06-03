import { createClient } from '@insforge/sdk';

const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_API_KEY = 'ik_b3885d51d56e5cd4d58d5b21fefa58d7';

const insforge = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_API_KEY // Trying as anonKey, maybe it's a valid JWT or service role key?
});

async function run() {
  console.log("Fetching all leads using INSFORGE_API_KEY...");
  const { data: leads, error } = await insforge.database
    .from('leads')
    .select('*');
    
  if (error) {
    console.error("Error querying leads:", error);
    return;
  }
  
  console.log(`Found ${leads.length} leads.`);
}

run();

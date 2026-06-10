// Using native fetch

const BASE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const API_KEY = 'ik_b3885d51d56e5cd4d58d5b21fefa58d7';

async function rawSQL(query) {
  const res = await fetch(`${BASE_URL}/api/database/advance/rawsql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, params: [] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Raw SQL failed");
  return data;
}

async function fixSchema() {
  try {
    console.log("Adding column...");
    await rawSQL("ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(255);");
    await rawSQL("ALTER TABLE users ADD COLUMN IF NOT EXISTS experience VARCHAR(255);");
    await rawSQL("ALTER TABLE users ADD COLUMN IF NOT EXISTS qualification VARCHAR(255);");
    await rawSQL("ALTER TABLE users ADD COLUMN IF NOT EXISTS hobbies VARCHAR(255);");
    await rawSQL("ALTER TABLE users ADD COLUMN IF NOT EXISTS local_station VARCHAR(255);");
    await rawSQL("ALTER TABLE users ADD COLUMN IF NOT EXISTS local_post_office VARCHAR(255);");
    await rawSQL("ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by VARCHAR(255);");
    await rawSQL("ALTER TABLE users ADD COLUMN IF NOT EXISTS voter_id VARCHAR(255);");
    console.log("Granting permissions...");
    await rawSQL("GRANT SELECT, INSERT, UPDATE ON TABLE users TO PUBLIC;");
    await rawSQL("GRANT ALL ON TABLE users TO anon;");
    console.log("Reloading PostgREST schema cache...");
    await rawSQL("NOTIFY pgrst, 'reload schema';");
    console.log("Done!");
  } catch (e) {
    console.error(e.message);
  }
}

fixSchema();

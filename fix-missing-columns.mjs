import { rawSQL } from "./src/lib/insforge.js";

async function run() {
  try {
    console.log("Adding missing columns...");
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
  } catch (err) {
    console.error("Error:", err);
  }
}

run();

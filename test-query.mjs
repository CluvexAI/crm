import { queryRecords } from './src/lib/insforge.js';

async function test() {
  try {
    const res = await queryRecords('users', { limit: 1 });
    console.log("Success! Users found:", res.total);
  } catch(e) {
    console.error("Error querying records:", e.message);
  }
}

test();

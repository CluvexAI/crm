const dns = require("dns").promises;

async function resolveTxtWithRetry(hostname, retries = 3) {
  const resolvers = ["8.8.8.8", "1.1.1.1"];

  for (let i = 0; i < retries; i++) {
    for (const resolver of resolvers) {
      try {
        dns.setServers([resolver]);

        const records = await dns.resolveTxt(hostname);
        return records.map(r => r.join(""));
      } catch (err) {
        console.error(
          `DNS lookup failed for ${hostname} using ${resolver}`,
          err.message
        );
      }
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  throw new Error(`TXT lookup failed for ${hostname}`);
}

module.exports = {
  resolveTxtWithRetry
};

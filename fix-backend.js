const fs = require('fs');
let content = fs.readFileSync('server/services/dnsService.js', 'utf8');

// Add import
if (!content.includes('resolveTxtWithRetry')) {
  content = content.replace(
    /const dns = require\('dns'\)\.promises;/g,
    `const dns = require('dns').promises;
const { resolveTxtWithRetry } = require('../utils/dnsResolver');`
  );
}

// Replace the inner resolution logic for SPF
content = content.replace(
  /const \{ records, responseTime, resolver \} = await resolveTxtWithRetry\(domain\);\s*const joinedRecords = records\.map\(chunkArray => chunkArray\.join\(''\)\);\s*const spfRecord = joinedRecords\.find\(r => r\.startsWith\('v=spf1'\)\);\s*result\.log = \{ queriedHostname: domain, rawResponse: records, parsedValue: spfRecord \|\| null, resolverUsed: resolver, responseTimeMs: responseTime \};/g,
  `const spfRecord = await resolveTxtWithRetry(domain);
       result.log = { queriedHostname: domain, rawResponse: spfRecord, parsedValue: spfRecord || null, responseTimeMs: 0 };`
);

// Replace the inner resolution logic for DKIM
content = content.replace(
  /const \{ records, responseTime, resolver \} = await resolveTxtWithRetry\(dkimDomain\);\s*const joinedRecords = records\.map\(chunkArray => chunkArray\.join\(''\)\);\s*const dkimRecord = joinedRecords\.find\(r => r\.startsWith\('v=DKIM1'\)\);\s*result\.log = \{ queriedHostname: dkimDomain, rawResponse: records, parsedValue: dkimRecord \|\| null, resolverUsed: resolver, responseTimeMs: responseTime \};/g,
  `const dkimRecord = await resolveTxtWithRetry(dkimDomain);
       result.log = { queriedHostname: dkimDomain, rawResponse: dkimRecord, parsedValue: dkimRecord || null, responseTimeMs: 0 };`
);

// Replace the inner resolution logic for DMARC
content = content.replace(
  /const \{ records, responseTime, resolver \} = await resolveTxtWithRetry\(dmarcDomain\);\s*const joinedRecords = records\.map\(chunkArray => chunkArray\.join\(''\)\);\s*const dmarcRecord = joinedRecords\.find\(r => r\.startsWith\('v=DMARC1'\)\);\s*result\.log = \{ queriedHostname: dmarcDomain, rawResponse: records, parsedValue: dmarcRecord \|\| null, resolverUsed: resolver, responseTimeMs: responseTime \};/g,
  `const dmarcRecord = await resolveTxtWithRetry(dmarcDomain);
       result.log = { queriedHostname: dmarcDomain, rawResponse: dmarcRecord, parsedValue: dmarcRecord || null, responseTimeMs: 0 };`
);

// Fix error mappings for Pending/Invalid
content = content.replace(
  /result\.status = \(err\.code === 'ENOTFOUND' \|\| err\.code === 'ENODATA'\) \? 'Pending' : 'Error';/g,
  `result.status = (err.message.includes('failed')) ? 'Pending' : 'Error';`
);

content = content.replace(
  /result\.status = \(err\.code === 'ENOTFOUND' \|\| err\.code === 'ENODATA'\) \? 'Invalid' : 'Error';/g,
  `result.status = (err.message.includes('failed')) ? 'Invalid' : 'Error';`
);

fs.writeFileSync('server/services/dnsService.js', content);

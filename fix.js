const fs = require('fs');
let content = fs.readFileSync('server/services/dnsService.js', 'utf8');

// Replace timeout wrapper
content = content.replace(
  /const dns = require\('dns'\)\.promises;[\s\S]*?const withTimeout = [^\}]+?\}\);[\r\n]+};/m,
  `const { Resolver } = require('dns').promises;

const DNS_QUERY_TIMEOUT = 5000;

const withTimeout = (queryPromise, timeoutMs = DNS_QUERY_TIMEOUT) => {
  return Promise.race([
    queryPromise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(\`DNS query timed out after \${timeoutMs}ms\`)), timeoutMs)
    )
  ]);
};

const resolveTxtWithRetry = async (domain, retries = 3) => {
  const resolver = new Resolver();
  resolver.setServers(['8.8.8.8', '1.1.1.1']);
  
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const start = Date.now();
      const records = await withTimeout(resolver.resolveTxt(domain), 5000);
      return { records, responseTime: Date.now() - start, resolver: '8.8.8.8 / 1.1.1.1' };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
};`
);

// Replace verifySPFRecord
content = content.replace(
  /async verifySPFRecord\(domain\) \{[\s\S]*?return result;[\r\n]+   \}/m,
  `async verifySPFRecord(domain) {
     const result = { type: 'SPF', domain, timestamp: new Date().toISOString(), status: 'Error', currentRecord: '', expectedRecord: \`v=spf1 include:mail.\${domain} ~all\`, message: '', issues: [], log: {} };
     try {
       const { records, responseTime, resolver } = await resolveTxtWithRetry(domain);
       const joinedRecords = records.map(chunkArray => chunkArray.join(''));
       const spfRecord = joinedRecords.find(r => r.startsWith('v=spf1'));
       result.log = { queriedHostname: domain, rawResponse: records, parsedValue: spfRecord || null, resolverUsed: resolver, responseTimeMs: responseTime };
       if (spfRecord) {
         result.currentRecord = spfRecord;
         if (spfRecord.includes(\`mail.\${domain}\`) || spfRecord.includes('mail.zsmeservices.com')) {
           result.status = 'Verified'; result.message = '✅ SPF record is correctly configured';
         } else {
           result.status = 'Missing'; result.message = '⚠️ SPF record found but does not include required mail server'; result.issues.push('Mail server reference missing from SPF record');
         }
       } else {
         result.status = 'Missing'; result.message = '❌ No SPF record found for domain';
       }
     } catch (err) {
       result.status = 'Error'; result.message = err.message.includes('timed out') ? '❌ DNS lookup timed out' : \`❌ Verification error: \${err.message}\`; result.log = { error: err.message };
     }
     console.log('SPF Verification Log:', JSON.stringify(result.log, null, 2));
     return result;
   }`
);

// Replace verifyDKIMRecord
content = content.replace(
  /async verifyDKIMRecord\(domain, selector = 'mail'\) \{[\s\S]*?return result;[\r\n]+   \}/m,
  `async verifyDKIMRecord(domain, selector = 'mail') {
     const dkimDomain = \`\${selector}._domainkey.\${domain}\`;
     const result = { type: 'DKIM', domain: dkimDomain, selector, timestamp: new Date().toISOString(), status: 'Error', currentRecord: '', message: '', issues: [], log: {} };
     try {
       const { records, responseTime, resolver } = await resolveTxtWithRetry(dkimDomain);
       const joinedRecords = records.map(chunkArray => chunkArray.join(''));
       const dkimRecord = joinedRecords.find(r => r.startsWith('v=DKIM1'));
       result.log = { queriedHostname: dkimDomain, rawResponse: records, parsedValue: dkimRecord || null, resolverUsed: resolver, responseTimeMs: responseTime };
       if (dkimRecord) {
         result.currentRecord = dkimRecord; result.status = 'Verified'; result.message = '✅ DKIM record is correctly configured';
       } else {
         result.status = 'Pending'; result.message = '⚠️ TXT record found but DKIM format is invalid'; result.issues.push('Invalid DKIM record format');
       }
     } catch (err) {
       result.status = (err.code === 'ENOTFOUND' || err.code === 'ENODATA') ? 'Pending' : 'Error';
       result.message = err.message.includes('timed out') ? '❌ DNS lookup timed out' : \`❌ Verification error: \${err.message}\`; result.log = { error: err.message };
     }
     console.log('DKIM Verification Log:', JSON.stringify(result.log, null, 2));
     return result;
   }`
);

// Replace verifyDMARCRecord and the malformed block below it
content = content.replace(
  /async verifyDMARCRecord\(domain\) \{[\s\S]*?return result;[\r\n]+  \}/m,
  `async verifyDMARCRecord(domain) {
     const dmarcDomain = \`_dmarc.\${domain}\`;
     const result = { type: 'DMARC', domain: dmarcDomain, timestamp: new Date().toISOString(), status: 'Error', currentRecord: '', expectedPolicy: 'quarantine or reject', message: '', issues: [], log: {} };
     try {
       const { records, responseTime, resolver } = await resolveTxtWithRetry(dmarcDomain);
       const joinedRecords = records.map(chunkArray => chunkArray.join(''));
       const dmarcRecord = joinedRecords.find(r => r.startsWith('v=DMARC1'));
       result.log = { queriedHostname: dmarcDomain, rawResponse: records, parsedValue: dmarcRecord || null, resolverUsed: resolver, responseTimeMs: responseTime };
       if (dmarcRecord) {
         result.currentRecord = dmarcRecord;
         if (dmarcRecord.includes('p=quarantine') || dmarcRecord.includes('p=reject')) {
           result.status = 'Verified'; result.message = '✅ DMARC policy is correctly configured';
         } else if (dmarcRecord.includes('p=none')) {
           result.status = 'Invalid'; result.message = '⚠️ DMARC policy is set to none'; result.issues.push('Consider quarantine or reject');
         } else {
           result.status = 'Invalid'; result.message = '❌ DMARC policy is invalid'; result.issues.push('Invalid DMARC format');
         }
       } else {
         result.status = 'Invalid'; result.message = '❌ No DMARC record found';
       }
     } catch (err) {
       result.status = (err.code === 'ENOTFOUND' || err.code === 'ENODATA') ? 'Invalid' : 'Error';
       result.message = err.message.includes('timed out') ? '❌ DNS lookup timed out' : \`❌ Verification error: \${err.message}\`; result.log = { error: err.message };
     }
     console.log('DMARC Verification Log:', JSON.stringify(result.log, null, 2));
     return result;
   }`
);

fs.writeFileSync('server/services/dnsService.js', content);

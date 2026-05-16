const fs = require('fs');
let content = fs.readFileSync('src/components/DNSAuthenticationSetup.js', 'utf8');

content = content.replace(
  /useEffect\(\(\) => \{\s+setDnsConfig\(getDnsConfig\(\)\);\s+setDnsStatus\(getDnsStatusSummary\(\)\);\s+\}, \[\]\);/g,
  `useEffect(() => {
    setDnsConfig(getDnsConfig());
    setDnsStatus(getDnsStatusSummary());
    const interval = setInterval(() => {
      handleVerifyAll();
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleVerifyAll = async () => {
    await handleVerifySpf();
    await handleVerifyDkim(dkimSelector);
    await handleVerifyDmarc();
  };`
);

content = content.replace(
  /const getStatusBadge = \(status\) => \{[\s\S]*?\};\n\s*const badge = badges\[status\] \|\| badges\['unknown'\];/g,
  `const getStatusBadge = (status) => {
    const badges = {
      'Verified': { bg: '#27ae60', text: '✅ Verified' },
      'Missing': { bg: '#e74c3c', text: '❌ Missing' },
      'Pending': { bg: '#f39c12', text: '⏸️ Pending' },
      'Invalid': { bg: '#e74c3c', text: '❌ Invalid' },
      'Error': { bg: '#e74c3c', text: '❌ Error' },
      'unknown': { bg: '#95a5a6', text: '❓ Unknown' },
    };
    const badge = badges[status] || badges['unknown'];`
);

content = content.replace(
  /<h3 style=\{\{ marginBottom: 10 \}\}>📌 Domain Configuration<\/h3>/g,
  `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
    <h3>📌 Domain Configuration</h3>
    <button 
      className="btn btn-primary btn-sm" 
      onClick={handleVerifyAll}
      disabled={loading.spf || loading.dkim || loading.dmarc}
    >
      🔄 Re-Verify DNS
    </button>
  </div>`
);

fs.writeFileSync('src/components/DNSAuthenticationSetup.js', content);

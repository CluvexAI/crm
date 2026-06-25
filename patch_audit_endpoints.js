const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'server', 'index.js');
let code = fs.readFileSync(file, 'utf8');

const endpoints = `
// ─── Audit & Analysis API ───────────────────────────────────────────────────
const auditService = require('./services/auditService');

app.post('/api/audit/gmb', async (req, res) => {
  try {
    const { url, userId } = req.body;
    const jobId = auditService.startAudit('gmb', url, userId);
    res.json({ success: true, jobId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/audit/website', async (req, res) => {
  try {
    const { url, userId } = req.body;
    const jobId = auditService.startAudit('website', url, userId);
    res.json({ success: true, jobId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/audit/status/:jobId', (req, res) => {
  const status = auditService.getAuditStatus(req.params.jobId);
  res.json(status);
});

app.get('/api/audit/history', (req, res) => {
  const { type, userId } = req.query;
  const history = auditService.getAuditHistory(type, userId);
  res.json({ success: true, history });
});

`;

// Insert before server.listen
if (!code.includes('/api/audit/gmb')) {
  code = code.replace(/server\.listen\(/, endpoints + 'server.listen(');
  fs.writeFileSync(file, code, 'utf8');
  console.log('Audit endpoints added to server/index.js');
} else {
  console.log('Endpoints already exist.');
}

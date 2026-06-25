const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'server', 'index.js');
let code = fs.readFileSync(file, 'utf8');

// We are completely stripping out insforgeClient from the 5 LLM endpoints.

const getEndpoint = `app.get('/api/admin/llm/settings', async (req, res) => {
  try {
    const dataList = readJSON(path.join(DATA_DIR, 'llm_settings.json'), []);
    const data = dataList[0] || {};
    if (data.api_key) {
      const maskedKey = \`sk-or-v1***\${data.api_key.slice(-4)}\`;
      return res.json({ ...data, api_key: maskedKey });
    }
    return res.json({});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});`;

const postEndpoint = `app.post('/api/admin/llm/settings', async (req, res) => {
  try {
    const { provider, api_key, base_url, gateway_url, fallback_provider, default_model, enabled } = req.body;
    const settingsFile = path.join(DATA_DIR, 'llm_settings.json');
    const dataList = readJSON(settingsFile, []);
    const existing = dataList[0] || {};
    
    let keyToSave = existing.api_key;
    if (api_key && !api_key.includes('***')) {
      keyToSave = encryptLlm(api_key);
    }
    
    const payload = {
      provider,
      api_key: keyToSave,
      base_url: base_url || 'https://openrouter.ai/api/v1',
      gateway_url,
      fallback_provider,
      default_model,
      enabled: enabled !== false,
      updated_at: new Date().toISOString()
    };
    
    writeJSON(settingsFile, [payload]);
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || JSON.stringify(err) });
  }
});`;

const testEndpoint = `app.post('/api/admin/llm/test', async (req, res) => {
  try {
    const { api_key, base_url, gateway_url, provider } = req.body;
    let actualKey = api_key;
    
    if (api_key && api_key.includes('***')) {
      const dataList = readJSON(path.join(DATA_DIR, 'llm_settings.json'), []);
      const data = dataList[0] || {};
      if (data && data.api_key) actualKey = decryptLlm(data.api_key);
    }
    
    const targetUrl = provider === 'Insforge Model Gateway' ? (gateway_url || base_url) : base_url;
    const llmProvider = LLMFactory.create(provider, actualKey, targetUrl, null);
    const result = await llmProvider.testConnection();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});`;

const modelsEndpoint = `app.get('/api/admin/llm/models', async (req, res) => {
  try {
    const dataList = readJSON(path.join(DATA_DIR, 'llm_settings.json'), []);
    const data = dataList[0] || {};
    if (!data.provider) return res.json({ success: false, message: 'No configuration found' });
    
    let actualKey = '';
    if (data.api_key) actualKey = decryptLlm(data.api_key);
    
    const targetUrl = data.provider === 'Insforge Model Gateway' ? (data.gateway_url || data.base_url) : data.base_url;
    const llmProvider = LLMFactory.create(data.provider, actualKey, targetUrl, data.default_model);
    const result = await llmProvider.getModels();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});`;

const researchEndpoint = `app.post('/api/llm/research', async (req, res) => {
  try {
    const { type, targetUrl, leadId, customerId, createdBy } = req.body;
    
    const dataList = readJSON(path.join(DATA_DIR, 'llm_settings.json'), []);
    const data = dataList[0] || {};
    
    if (!data || !data.enabled || !data.api_key) {
      throw new Error('LLM integration is not configured or disabled');
    }
    
    const result = await LLMFactory.generateWithFallback(
      data.provider, 
      data.fallback_provider,
      data,
      decryptLlm,
      type,
      targetUrl
    );
    
    if (result.success && result.usage) {
      // Log usage locally
      const logsFile = path.join(DATA_DIR, 'llm_usage_logs.json');
      const logs = readJSON(logsFile, []);
      logs.push({
        id: require('crypto').randomUUID(),
        user_id: createdBy || null,
        model: result.usage.model || data.default_model,
        operation: \`analyze_\${type}\`,
        prompt_tokens: result.usage.prompt_tokens,
        completion_tokens: result.usage.completion_tokens,
        total_tokens: result.usage.total_tokens,
        estimated_cost: (result.usage.total_tokens / 1000) * 0.002,
        created_at: new Date().toISOString()
      });
      writeJSON(logsFile, logs);
      
      // Save report locally
      const reportsFile = path.join(DATA_DIR, 'ai_research_reports.json');
      const reports = readJSON(reportsFile, []);
      reports.push({
        id: require('crypto').randomUUID(),
        lead_id: leadId || null,
        customer_id: customerId || null,
        website_url: type === 'website' ? targetUrl : null,
        gmb_url: type === 'gmb' ? targetUrl : null,
        model_used: result.usage.model || data.default_model,
        report: { content: result.report },
        created_by: createdBy || null,
        created_at: new Date().toISOString()
      });
      writeJSON(reportsFile, reports);
    }
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});`;

// Regex replace
code = code.replace(/app\.get\('\/api\/admin\/llm\/settings'[\s\S]*?res\.status\(500\)\.json\(\{ error: err\.message \}\);\s*\n\s*\}\s*\n\}\);/, getEndpoint);
code = code.replace(/app\.post\('\/api\/admin\/llm\/settings'[\s\S]*?res\.status\(500\)\.json\(\{ success: false, message: err\.message \|\| JSON\.stringify\(err\) \}\);\s*\n\s*\}\s*\n\}\);/, postEndpoint);
code = code.replace(/app\.post\('\/api\/admin\/llm\/test'[\s\S]*?res\.status\(500\)\.json\(\{ success: false, message: err\.message \}\);\s*\n\s*\}\s*\n\}\);/, testEndpoint);
code = code.replace(/app\.get\('\/api\/admin\/llm\/models'[\s\S]*?res\.status\(500\)\.json\(\{ success: false, message: err\.message \}\);\s*\n\s*\}\s*\n\}\);/, modelsEndpoint);
code = code.replace(/app\.post\('\/api\/llm\/research'[\s\S]*?res\.status\(500\)\.json\(\{ success: false, message: err\.message \}\);\s*\n\s*\}\s*\n\}\);/, researchEndpoint);

fs.writeFileSync(file, code, 'utf8');
console.log('Endpoints rewritten successfully to use local JSON store!');

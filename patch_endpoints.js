const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'server', 'index.js');
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "const OpenRouterService = require('./services/OpenRouterService');",
  "const LLMFactory = require('./services/LLMFactory');"
);

// Replace POST /api/admin/llm/settings
code = code.replace(
  /app\.post\('\/api\/admin\/llm\/settings'[\s\S]*?res\.status\(500\)\.json\(\{ error: err\.message \}\);\s*\n\s*\}\s*\n\}\);/,
  `app.post('/api/admin/llm/settings', async (req, res) => {
  try {
    const { provider, api_key, base_url, gateway_url, fallback_provider, default_model, enabled } = req.body;
    if (!insforgeClient) throw new Error('DB client not initialized');

    const { data: existing } = await insforgeClient.from('llm_settings').select('id, api_key').limit(1).maybeSingle();
    
    let keyToSave = existing?.api_key;
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
    
    let result;
    if (existing) {
      result = await insforgeClient.from('llm_settings').update(payload).eq('id', existing.id);
    } else {
      result = await insforgeClient.from('llm_settings').insert([payload]);
    }
    
    if (result.error) throw result.error;
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});`
);

// Replace POST /api/admin/llm/test
code = code.replace(
  /app\.post\('\/api\/admin\/llm\/test'[\s\S]*?res\.status\(500\)\.json\(\{ success: false, message: err\.message \}\);\s*\n\s*\}\s*\n\}\);/,
  `app.post('/api/admin/llm/test', async (req, res) => {
  try {
    const { api_key, base_url, gateway_url, provider } = req.body;
    let actualKey = api_key;
    
    if (api_key && api_key.includes('***')) {
      if (!insforgeClient) throw new Error('DB client not initialized');
      const { data } = await insforgeClient.from('llm_settings').select('api_key').limit(1).maybeSingle();
      if (data && data.api_key) actualKey = decryptLlm(data.api_key);
    }
    
    const targetUrl = provider === 'Insforge Model Gateway' ? (gateway_url || base_url) : base_url;
    const llmProvider = LLMFactory.create(provider, actualKey, targetUrl, null);
    const result = await llmProvider.testConnection();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});`
);

// Replace GET /api/admin/llm/models
code = code.replace(
  /app\.get\('\/api\/admin\/llm\/models'[\s\S]*?res\.status\(500\)\.json\(\{ success: false, message: err\.message \}\);\s*\n\s*\}\s*\n\}\);/,
  `app.get('/api/admin/llm/models', async (req, res) => {
  try {
    if (!insforgeClient) throw new Error('DB client not initialized');
    const { data } = await insforgeClient.from('llm_settings').select('*').limit(1).maybeSingle();
    
    if (!data) return res.json({ success: false, message: 'No configuration found' });
    
    let actualKey = '';
    if (data.api_key) actualKey = decryptLlm(data.api_key);
    
    const targetUrl = data.provider === 'Insforge Model Gateway' ? (data.gateway_url || data.base_url) : data.base_url;
    const llmProvider = LLMFactory.create(data.provider, actualKey, targetUrl, data.default_model);
    const result = await llmProvider.getModels();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});`
);

// Replace POST /api/llm/research
code = code.replace(
  /app\.post\('\/api\/llm\/research'[\s\S]*?res\.status\(500\)\.json\(\{ success: false, message: err\.message \}\);\s*\n\s*\}\s*\n\}\);/,
  `app.post('/api/llm/research', async (req, res) => {
  try {
    const { type, targetUrl, leadId, customerId, createdBy } = req.body;
    if (!insforgeClient) throw new Error('DB client not initialized');
    
    const { data } = await insforgeClient.from('llm_settings').select('*').limit(1).maybeSingle();
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
      // Log usage
      await insforgeClient.from('llm_usage_logs').insert([{
        user_id: createdBy || null,
        model: result.usage.model || data.default_model,
        operation: \`analyze_\${type}\`,
        prompt_tokens: result.usage.prompt_tokens,
        completion_tokens: result.usage.completion_tokens,
        total_tokens: result.usage.total_tokens,
        estimated_cost: (result.usage.total_tokens / 1000) * 0.002 // Rough estimate
      }]);
      
      // Save report
      await insforgeClient.from('ai_research_reports').insert([{
        lead_id: leadId || null,
        customer_id: customerId || null,
        website_url: type === 'website' ? targetUrl : null,
        gmb_url: type === 'gmb' ? targetUrl : null,
        model_used: result.usage.model || data.default_model,
        report: { content: result.report },
        created_by: createdBy || null
      }]);
    }
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});`
);

fs.writeFileSync(file, code, 'utf8');
console.log('Endpoints patched successfully.');

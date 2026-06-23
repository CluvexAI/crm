// server/services/llm/anthropic.js

async function listModels(apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Anthropic HTTP error ${res.status}`);
  }
  const data = await res.json();
  // Map data to unified format { id, name }
  return data.data.map(m => ({
    id: m.id,
    name: m.display_name || m.id
  }));
}

async function testConnection(apiKey, modelId) {
  try {
    // If no model provided, just list models to verify the key
    if (!modelId) {
      await listModels(apiKey);
      return { success: true };
    }
    
    // Otherwise try a tiny completion to verify model access
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "OK"' }]
      })
    });
    
    if (!res.ok) {
      // 401 means strictly invalid API key. Other errors (400, 403, 429) often mean valid key but restricted account (e.g. no credits)
      if (res.status !== 401) return { success: true }; 
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Anthropic HTTP error ${res.status}`);
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function complete(apiKey, modelId, messages, opts = {}) {
  // Convert standard openai-like messages if necessary, but assume standard 'role'/'content'
  const anthropicMessages = messages.map(m => ({
    role: m.role === 'system' ? 'user' : m.role, // Anthropic handles system differently, but this is a naive fallback
    content: m.content
  }));
  
  // Extract system prompt if present
  let system = undefined;
  const sysMsg = messages.find(m => m.role === 'system');
  if (sysMsg) {
    system = sysMsg.content;
  }
  const filteredMessages = messages.filter(m => m.role !== 'system');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: opts.max_tokens || 1024,
      system: system,
      messages: filteredMessages,
      temperature: opts.temperature || 0.7
    })
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Anthropic HTTP error ${res.status}`);
  }
  
  const data = await res.json();
  return {
    text: data.content?.[0]?.text || '',
    usage: {
      prompt_tokens: data.usage?.input_tokens || 0,
      completion_tokens: data.usage?.output_tokens || 0,
    }
  };
}

module.exports = { listModels, testConnection, complete };

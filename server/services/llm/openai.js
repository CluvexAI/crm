// server/services/llm/openai.js

async function listModels(apiKey) {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI HTTP error ${res.status}`);
  }
  const data = await res.json();
  // Filter out non-text models if we want, but for now just return all
  return data.data
    .filter(m => m.id.includes('gpt')) // simple filter to keep list clean
    .map(m => ({
      id: m.id,
      name: m.id
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function testConnection(apiKey, modelId) {
  try {
    if (!modelId) {
      await listModels(apiKey);
      return { success: true };
    }
    
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
      throw new Error(err.error?.message || `OpenAI HTTP error ${res.status}`);
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function complete(apiKey, modelId, messages, opts = {}) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: opts.max_tokens,
      messages: messages,
      temperature: opts.temperature || 0.7
    })
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI HTTP error ${res.status}`);
  }
  
  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content || '',
    usage: {
      prompt_tokens: data.usage?.prompt_tokens || 0,
      completion_tokens: data.usage?.completion_tokens || 0,
    }
  };
}

module.exports = { listModels, testConnection, complete };

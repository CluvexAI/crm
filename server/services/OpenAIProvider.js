const LLMProvider = require('./LLMProvider');
const { getSystemPrompt } = require('./prompts');

class OpenAIProvider extends LLMProvider {
  constructor(apiKey, baseUrl, defaultModel) {
    super(apiKey, baseUrl || 'https://api.openai.com/v1', defaultModel || 'gpt-4o');
    this.name = 'OpenAI';
  }

  async testConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      if (!response.ok) {
        throw new Error('Invalid API Key or connection failed');
      }
      return { success: true, message: 'OpenAI connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getModels() {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();
      return { success: true, models: data.data.map(m => m.id) };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async generateResearch(type, targetUrl, model) {
    const selectedModel = model || this.defaultModel;
    let systemPrompt = getSystemPrompt(type);
    let userPrompt = '';

    if (type === 'website') {
      userPrompt = `Analyze this website: ${targetUrl}`;
    } else if (type === 'gmb') {
      userPrompt = `Analyze this Google Business Profile located at: ${targetUrl}`;
    } else {
      throw new Error('Invalid research type');
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to generate research');
      }

      const data = await response.json();
      return {
        success: true,
        report: data.choices[0].message.content,
        usage: {
          prompt_tokens: data.usage?.prompt_tokens || 0,
          completion_tokens: data.usage?.completion_tokens || 0,
          total_tokens: data.usage?.total_tokens || 0,
          model: selectedModel
        }
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async generateCompletion(prompt, options = {}) {
    const selectedModel = options.model || this.defaultModel;
    const temperature = options.temperature || 0.7;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: selectedModel,
          temperature,
          messages: [
            { role: 'user', content: prompt }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || errorData.message || 'Failed to generate completion via OpenAI');
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';
      
      return {
        success: true,
        text,
        usage: {
          prompt_tokens: data.usage?.prompt_tokens || 0,
          completion_tokens: data.usage?.completion_tokens || 0,
          total_tokens: data.usage?.total_tokens || 0,
          model: selectedModel
        }
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = OpenAIProvider;

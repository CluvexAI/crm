const LLMProvider = require('./LLMProvider');

class OpenRouterProvider extends LLMProvider {
  constructor(apiKey, baseUrl, defaultModel) {
    super(apiKey, baseUrl || 'https://openrouter.ai/api/v1', defaultModel || 'google/gemini-2.5-pro');
    this.name = 'OpenRouter';
  }

  async testConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/auth/key`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      if (!response.ok) {
        throw new Error('Invalid API Key or connection failed');
      }
      return { success: true, message: 'OpenRouter connection successful' };
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
    let systemPrompt = '';
    let userPrompt = '';

    if (type === 'website') {
      systemPrompt = 'You are an expert sales analyst and web auditor. Analyze the following website and provide a detailed report including: Business Summary, Industry, Services, Products, Target Audience, Website Audit (SEO/UX/Missing Pages/Conversion Problems), Sales Opportunities, and a Recommended personalized sales pitch.';
      userPrompt = `Analyze this website: ${targetUrl}`;
    } else if (type === 'gmb') {
      systemPrompt = 'You are a local SEO expert and sales strategist. Analyze this Google Business Profile and provide: Business Information (Name/Category/Location/Reviews/Rating), Marketing Gaps (Photos/Review response/SEO weaknesses/Local ranking opportunities), and Sales Opportunities. Also provide a Lead Score (1-100) and classify as Cold, Warm, or Hot.';
      userPrompt = `Analyze this Google Business Profile: ${targetUrl}`;
    } else {
      throw new Error('Invalid research type');
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://zsmeservices.com',
          'X-Title': 'ZSM CRM'
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
          'HTTP-Referer': 'https://crm.zsmeservices.com',
          'X-Title': 'ZSM CRM',
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
        throw new Error(errorData.error?.message || errorData.message || 'Failed to generate completion via OpenRouter');
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

module.exports = OpenRouterProvider;

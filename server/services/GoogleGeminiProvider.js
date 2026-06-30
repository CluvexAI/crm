const LLMProvider = require('./LLMProvider');
const { getSystemPrompt } = require('./prompts');

class GoogleGeminiProvider extends LLMProvider {
  constructor(apiKey, baseUrl, defaultModel) {
    super(apiKey, baseUrl || 'https://generativelanguage.googleapis.com/v1beta', defaultModel || 'gemini-2.5-pro');
    this.name = 'Google Gemini';
  }

  async testConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`, {
        method: 'GET'
      });
      if (!response.ok) {
        throw new Error('Invalid API Key or connection failed');
      }
      return { success: true, message: 'Google Gemini connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getModels() {
    try {
      const response = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`, {
        method: 'GET'
      });
      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();
      return { 
        success: true, 
        models: data.models.map(m => m.name.replace('models/', '')) 
      };
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
      const response = await fetch(`${this.baseUrl}/models/${selectedModel}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: userPrompt }]
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to generate research');
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      return {
        success: true,
        report: text,
        usage: {
          prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
          completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
          total_tokens: data.usageMetadata?.totalTokenCount || 0,
          model: selectedModel
        }
      };
    } catch (error) {
      // Fallback format if systemInstruction fails
      try {
        const fallbackResponse = await fetch(`${this.baseUrl}/models/${selectedModel}:generateContent?key=${this.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
              }
            ]
          })
        });
        
        if (!fallbackResponse.ok) throw new Error('Fallback failed');
        const data = await fallbackResponse.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return { success: true, report: text };
      } catch (fallbackError) {
        return { success: false, message: error.message };
      }
    }
  }

  async generateCompletion(prompt, options = {}) {
    const selectedModel = options.model || this.defaultModel;
    const temperature = options.temperature || 0.7;

    try {
      const response = await fetch(`${this.baseUrl}/models/${selectedModel}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: temperature
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || errorData.message || 'Failed to generate completion via Google Gemini');
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      return {
        success: true,
        text,
        usage: {
          prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
          completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
          total_tokens: data.usageMetadata?.totalTokenCount || 0,
          model: selectedModel
        }
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = GoogleGeminiProvider;

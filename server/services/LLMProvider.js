class LLMProvider {
  constructor(apiKey, baseUrl, defaultModel) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.defaultModel = defaultModel;
  }

  async testConnection() {
    throw new Error('testConnection() not implemented');
  }

  async getModels() {
    throw new Error('getModels() not implemented');
  }

  async generateResearch(type, targetUrl, model) {
    throw new Error('generateResearch() not implemented');
  }

  async generateCompletion(prompt, options = {}) {
    throw new Error('generateCompletion() not implemented');
  }
}

module.exports = LLMProvider;

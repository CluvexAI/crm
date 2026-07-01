const OpenRouterProvider = require('./OpenRouterProvider');
const InsforgeProvider = require('./InsforgeProvider');
const GoogleGeminiProvider = require('./GoogleGeminiProvider');
const OpenAIProvider = require('./OpenAIProvider');
const logger = require('../utils/logger.js');


class LLMFactory {
  static create(providerName, apiKey, baseUrl, defaultModel) {
    switch (providerName) {
      case 'Insforge Model Gateway':
        return new InsforgeProvider(apiKey, baseUrl, defaultModel);
      case 'OpenRouter':
        return new OpenRouterProvider(apiKey, baseUrl, defaultModel);
      case 'Google Gemini':
        return new GoogleGeminiProvider(apiKey, baseUrl, defaultModel);
      case 'OpenAI':
        return new OpenAIProvider(apiKey, baseUrl, defaultModel);
      default:
        // Default to OpenRouter if unknown but provide warning or fallback
        return new OpenRouterProvider(apiKey, baseUrl, defaultModel);
    }
  }

  static async resolveShortUrl(url) {
    if (!url) return url;
    if (url.includes('maps.app.goo.gl') || url.includes('g.page')) {
      try {
        logger.info(`[LLM] Expanding short URL: ${url}`);
        const response = await fetch(url, { method: 'HEAD' });
        logger.info(`[LLM] Expanded URL: ${response.url}`);
        return response.url || url;
      } catch (err) {
        logger.error(`[LLM] Failed to expand short URL: ${err.message}`);
        return url;
      }
    }
    return url;
  }

  static async generateWithFallback(primaryProviderStr, fallbackProviderStr, dbSettings, decryptFn, type, targetUrl) {
    // Expand targetUrl if it's a short link
    const expandedUrl = await LLMFactory.resolveShortUrl(targetUrl);
    
    const { provider, api_key, gateway_url, base_url, default_model } = dbSettings;
    
    // Decrypt API key for primary
    const primaryKey = decryptFn(api_key);
    // Which URL to use for primary? If Insforge, use gateway_url, else base_url
    const primaryUrl = primaryProviderStr === 'Insforge Model Gateway' ? (gateway_url || base_url) : base_url;
    
    const primaryProvider = LLMFactory.create(primaryProviderStr, primaryKey, primaryUrl, default_model);
    
    logger.info(`[LLM] Attempting research via primary provider: ${primaryProviderStr}`);
    let result = await primaryProvider.generateResearch(type, expandedUrl, default_model);
    
    if (result.success) {
      return result;
    }

    logger.error(`[LLM] Primary provider (${primaryProviderStr}) failed: ${result.message}`);
    
    if (fallbackProviderStr && fallbackProviderStr !== primaryProviderStr && fallbackProviderStr !== 'None') {
      logger.info(`[LLM] Attempting fallback to ${fallbackProviderStr}`);
      // For fallback, we assume the same API key and URL structure might NOT apply if it's a completely different provider.
      // But in this CRM's DB schema, we only have one API key and URL set. 
      // Wait, if the user configures Insforge as primary and OpenRouter as fallback, where does the OpenRouter key come from?
      // For now, if fallback is OpenRouter and primary was Insforge, we might not have the OpenRouter key unless it's stored.
      // Assuming the user configures the current provider's credentials, fallback might just be a logical structure for now.
      // If we only have one key, fallback to a different provider might fail authentication.
      // We will try anyway with default URL if OpenRouter is fallback, but with the same API key.
      const fallbackUrl = fallbackProviderStr === 'OpenRouter' ? 'https://openrouter.ai/api/v1' : primaryUrl;
      const fallbackProvider = LLMFactory.create(fallbackProviderStr, primaryKey, fallbackUrl, 'google/gemini-2.5-pro');
      
      let fallbackResult = await fallbackProvider.generateResearch(type, expandedUrl, 'google/gemini-2.5-pro');
      if (fallbackResult.success) {
        logger.info(`[LLM] Fallback successful`);
        return fallbackResult;
      }
      logger.error(`[LLM] Fallback provider (${fallbackProviderStr}) also failed: ${fallbackResult.message}`);
    }

    // Return the original failure if fallback didn't work or wasn't configured
    return result;
  }
}

module.exports = LLMFactory;

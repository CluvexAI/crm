const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { decrypt: decryptLlm } = require('../utils/crypto');
const LLMFactory = require('./LLMFactory');
const logger = require('../utils/logger.js');

// Background job queue
const jobs = {};

// Helper to read/write JSON safely
const readJSON = (file, def) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return def;
  }
};
const writeJSON = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
};

const DATA_DIR = path.join(__dirname, '..', 'data');
const GMB_REPORTS_FILE = path.join(DATA_DIR, 'gmb_audit_reports.json');
const WEB_REPORTS_FILE = path.join(DATA_DIR, 'website_audit_reports.json');
const AUDIT_REQUESTS_FILE = path.join(DATA_DIR, 'audit_requests.json');

// Initialize files
[GMB_REPORTS_FILE, WEB_REPORTS_FILE, AUDIT_REQUESTS_FILE].forEach(f => {
  if (!fs.existsSync(f)) writeJSON(f, []);
});

const normalizeUrl = (input) => {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  try {
    return new URL(url).toString();
  } catch (err) {
    throw new Error(`Invalid website URL: ${input}`);
  }
};

// Minimal HTML scraper
const scrapeHTML = async (rawUrl) => {
  try {
    let url = normalizeUrl(rawUrl);
    let res;
    
    try {
      res = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });
    } catch (e) {
      if (url.startsWith('https://')) {
        url = url.replace('https://', 'http://');
        res = await fetch(url, {
          redirect: 'follow',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
      } else {
        throw e;
      }
    }
    
    if (!res.ok) throw new Error(`Failed to fetch ${url} - Status: ${res.status}`);
    
    let html = await res.text();
    const finalUrl = res.url;
    
    // Extract Maps data before stripping scripts
    let mapsData = '';
    if (finalUrl.includes('google.com/maps')) {
      const scriptRegex = /<script\b[^>]*>(.*?)<\/script>/gis;
      let sMatch;
      while ((sMatch = scriptRegex.exec(html)) !== null) {
        if (sMatch[1].includes('APP_INITIALIZATION_STATE') || sMatch[1].includes(')]}\'')) {
          mapsData += sMatch[1] + '\n';
        }
      }
    }
    
    // Very naive tag stripping to reduce token count (remove script, style, SVG, etc.)
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    html = html.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');
    
    // Extract title
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : '';
    
    // Extract meta tags
    const metaMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^">]+)"/i);
    const description = metaMatch ? metaMatch[1] : '';
    
    let extractedBusinessName = '';
    const match = finalUrl.match(/\/place\/([^\/]+)/);
    if (match) {
      extractedBusinessName = decodeURIComponent(match[1].replace(/\+/g, ' '));
    }
    
    // Strip all HTML tags, collapse whitespace
    let textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50000); // limit to 50k chars
    if (extractedBusinessName) {
      textContent += `\n\nGoogle Maps Location Target: ${extractedBusinessName}`;
    }
    if (mapsData) {
      textContent += `\n\nGoogle Maps Raw JSON Data:\n` + mapsData.slice(0, 150000);
    }
    
    return {
      finalUrl,
      title,
      description,
      textContent
    };
  } catch (err) {
    throw new Error('Could not scrape URL: ' + err.message);
  }
};

const fetchPlacesData = async (url) => {
  try {
    let finalUrl = url;
    const res = await fetch(normalizeUrl(url), { redirect: 'follow' });
    finalUrl = res.url;
    
    let businessName = '';
    const match = finalUrl.match(/\/place\/([^\/]+)/);
    if (match) {
      businessName = decodeURIComponent(match[1].replace(/\+/g, ' '));
    }
    
    if (!businessName) {
      throw new Error("Could not extract business name from URL to perform Places API search.");
    }
    
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    
    // 1. Search for Place ID
    const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress'
      },
      body: JSON.stringify({ textQuery: businessName })
    });
    
    if (!searchRes.ok) throw new Error("Places API Search failed: " + searchRes.statusText);
    const searchData = await searchRes.json();
    
    if (!searchData.places || searchData.places.length === 0) {
      throw new Error(`No Places found for ${businessName}`);
    }
    
    const placeId = searchData.places[0].id;
    
    // 2. Fetch Place Details
    const detailsRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,rating,userRatingCount,reviews,regularOpeningHours,nationalPhoneNumber,internationalPhoneNumber,websiteUri,types,primaryType'
      }
    });
    
    if (!detailsRes.ok) throw new Error("Places API Details failed: " + detailsRes.statusText);
    const detailsData = await detailsRes.json();
    
    return {
      finalUrl,
      title: detailsData.displayName?.text || businessName,
      description: `Google Places Data for ${businessName}`,
      textContent: JSON.stringify(detailsData, null, 2)
    };
  } catch (err) {
    throw new Error('Google Places API Error: ' + err.message);
  }
};

const processAudit = async (jobId, type, url, userId) => {
  jobs[jobId] = { status: 'processing' };
  
  try {
    // 1. Log request
    const reqs = readJSON(AUDIT_REQUESTS_FILE, []);
    reqs.push({
      id: jobId,
      sales_agent_id: userId,
      type,
      input_url: url,
      status: 'processing',
      created_at: new Date().toISOString()
    });
    writeJSON(AUDIT_REQUESTS_FILE, reqs);

    // 2. Fetch LLM settings
    const llmSettingsList = readJSON(path.join(DATA_DIR, 'llm_settings.json'), []);
    const llmConfig = llmSettingsList[0];
    if (!llmConfig || !llmConfig.provider || !llmConfig.api_key) {
      throw new Error("LLM Integration is not configured. Please contact an admin.");
    }
    const apiKey = decryptLlm(llmConfig.api_key);
    const targetUrl = llmConfig.provider === 'Insforge Model Gateway' ? (llmConfig.gateway_url || llmConfig.base_url) : llmConfig.base_url;
    
    const provider = LLMFactory.create(llmConfig.provider, apiKey, targetUrl, llmConfig.default_model);

    // 3. Scrape Data or API Fetch
    let scrapedData;
    if (type === 'gmb') {
      scrapedData = await fetchPlacesData(url);
    } else {
      scrapedData = await scrapeHTML(url);
    }

    // 4. Generate Audit
    let prompt = '';
    if (type === 'gmb') {
      const { getSystemPrompt } = require('./prompts');


      prompt = `${getSystemPrompt('gmb')}

URL: ${scrapedData.finalUrl}
Business Name: ${scrapedData.title}

Raw JSON from Google Places API (Use this structured data to run your 500+ point audit):
${scrapedData.textContent}

Produce a structured JSON report mapping your 500+ point analysis into this EXACT schema:
{
  "name": "Business Name",
  "address": "Business Address",
  "score": 85, // Overall GBP Health Score (0-100)
  "completeness": [
    { "label": "Category", "status": "ok" | "warning", "details": "Found issues..." },
    { "label": "Photos & Videos", "status": "ok" | "warning", "details": "Analysis..." },
    { "label": "Local SEO & NAP", "status": "ok" | "warning", "details": "Analysis..." }
  ],
  "reviews_summary": "Summary of Reputation Score and Review Health",
  "nap_flags": ["Any inconsistencies found in Name, Address, Phone, Website"],
  "recommendations": [
    { "priority": "Critical" | "Moderate" | "Minor", "action": "Action description", "rationale": "Why" }
  ],
  "raw_data": { "scrapedTitle": "${scrapedData.title}" }
}
Respond strictly with valid JSON only.`;
    } else {
      prompt = `You are an expert technical SEO auditor. I will provide you with the scraped text of a Website.
Analyze the data to estimate SEO rankings, find technical issues, and evaluate the domain.
URL: ${scrapedData.finalUrl}
Page Title: ${scrapedData.title}
Meta Description: ${scrapedData.description}

Scraped Content:
${scrapedData.textContent}

Produce a structured JSON report matching exactly this schema:
{
  "target_url": "${scrapedData.finalUrl}",
  "score": 75, // 0-100 website health score
  "domain_summary": "Summary of domain context based on content",
  "ux_score_breakdown": "Explanation of likely UX/UI performance based on page structure/text",
  "keyword_summary": "Estimated top keywords they rank for or should rank for based on content density",
  "technical_errors": ["Missing meta tags", "Low content", "etc"],
  "recommendations": [
    { "priority": "Critical" | "Moderate" | "Minor", "action": "Action description", "rationale": "Why" }
  ],
  "raw_data": { "title": "${scrapedData.title}", "description": "${scrapedData.description}" }
}
Respond strictly with valid JSON only.`;
    }

    // Call LLM
    const llmRes = await provider.generateCompletion(prompt, { temperature: 0.2 });
    let rawText = llmRes.text.trim();
    if (rawText.startsWith('```json')) rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    if (rawText.startsWith('```')) rawText = rawText.replace(/```/g, '').trim();
    
    let reportObj;
    try {
      reportObj = JSON.parse(rawText);
    } catch (e) {
      logger.error("LLM did not return valid JSON", rawText);
      throw new Error("AI analysis failed to produce a valid report format.");
    }

    // 5. Save Report
    if (type === 'gmb') {
      const gmbReports = readJSON(GMB_REPORTS_FILE, []);
      gmbReports.push({
        id: crypto.randomUUID(),
        audit_request_id: jobId,
        input_url: url,
        score: reportObj.score || 0,
        report: reportObj,
        created_at: new Date().toISOString()
      });
      writeJSON(GMB_REPORTS_FILE, gmbReports);
    } else {
      const webReports = readJSON(WEB_REPORTS_FILE, []);
      webReports.push({
        id: crypto.randomUUID(),
        audit_request_id: jobId,
        input_url: url,
        score: reportObj.score || 0,
        report: reportObj,
        created_at: new Date().toISOString()
      });
      writeJSON(WEB_REPORTS_FILE, webReports);
    }

    jobs[jobId] = { status: 'completed', report: reportObj };

  } catch (err) {
    jobs[jobId] = { status: 'failed', error: err.message };
  }
};

const startAudit = (type, url, userId) => {
  const jobId = crypto.randomUUID();
  jobs[jobId] = { status: 'pending' };
  
  // Fire and forget background worker
  setTimeout(() => {
    processAudit(jobId, type, url, userId);
  }, 100);

  return jobId;
};

const getAuditStatus = (jobId) => {
  return jobs[jobId] || { status: 'not_found' };
};

const getAuditHistory = (type, userId) => {
  const file = type === 'gmb' ? GMB_REPORTS_FILE : WEB_REPORTS_FILE;
  return readJSON(file, []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

module.exports = {
  startAudit,
  getAuditStatus,
  getAuditHistory
};

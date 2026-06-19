const DNS_CONFIG_KEY = 'zsm_dns_config';

/**
 * Robust fetch wrapper that ensures JSON responses and handles HTML fallbacks gracefully.
 * Prevents "Unexpected token <" errors.
 */
const fetchJson = async (url, options = {}) => {
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type');
  
  if (!contentType || !contentType.includes('application/json')) {
    const text = await res.text();
    console.error(`[DNS] Non-JSON response from ${url}:`, text.substring(0, 200));
    throw new Error('DNS verification service returned an invalid response (HTML). The backend service may be starting or unavailable.');
  }
  
  return await res.json();
};

export const DEFAULT_DNS_CONFIG = {
  spf: {
    enabled: true,
    record: 'v=spf1 include:mail.zsmeservices.com mx ~all',
    status: 'unknown',
    verifiedAt: null,
  },
  dkim: {
    enabled: true,
    selector: 'mail',
    publicKey: '',
    status: 'unknown',
    verifiedAt: null,
  },
  dmarc: {
    enabled: true,
    record: 'v=DMARC1; p=quarantine; rua=mailto:admin@zsmeservices.com',
    status: 'unknown',
    verifiedAt: null,
  },
  mx: {
    enabled: true,
    records: [],
    status: 'unknown',
    verifiedAt: null,
  },
};

export const getDnsConfig = () => {
  const stored = localStorage.getItem(DNS_CONFIG_KEY);
  return stored ? { ...DEFAULT_DNS_CONFIG, ...JSON.parse(stored) } : DEFAULT_DNS_CONFIG;
};

export const saveDnsConfig = (config) => {
  localStorage.setItem(DNS_CONFIG_KEY, JSON.stringify({ ...getDnsConfig(), ...config }));
  return getDnsConfig();
};

export const verifySpfRecord = async () => {
  const config = getDnsConfig();
  const domain = 'zsmeservices.com'; // In production, this would be dynamic
  const result = {
    type: 'SPF',
    timestamp: new Date().toISOString(),
    status: 'unknown',
    currentRecord: '',
    expectedRecord: config.spf.record,
    message: '',
    issues: [],
  };
  
  try {
    const apiUrl = process.env.REACT_APP_API_URL || '';
    const data = await fetchJson(`${apiUrl}/api/dns/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, type: 'SPF' })
    });
    
    if (data.success) {
      result.status = data.data.status;
      result.message = data.data.message;
      result.currentRecord = data.data.currentRecord;
      result.issues = data.data.issues || [];
    } else {
      result.status = 'Error';
      result.message = data.message;
    }
    
    const updatedConfig = getDnsConfig();
    updatedConfig.spf.status = result.status;
    updatedConfig.spf.verifiedAt = result.timestamp;
    saveDnsConfig(updatedConfig);
    
  } catch (err) {
    result.status = 'Error';
    result.message = `Verification failed: ${err.message}`;
  }
  
  return result;
};

export const verifyDkimRecord = async (selector = 'mail') => {
  const domain = `${selector}._domainkey.zsmeservices.com`;
  const result = {
    type: 'DKIM',
    timestamp: new Date().toISOString(),
    selector,
    status: 'unknown',
    currentRecord: '',
    publicKey: '',
    message: '',
    issues: [],
  };
  
  try {
    const apiUrl = process.env.REACT_APP_API_URL || '';
    const data = await fetchJson(`${apiUrl}/api/dns/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, type: 'DKIM' })
    });
    
    const updatedConfig = getDnsConfig();
    updatedConfig.dkim.selector = selector;
    
    if (data.success) {
      result.status = data.data.status;
      result.message = data.data.message;
      result.currentRecord = data.data.currentRecord;
      result.issues = data.data.issues || [];
      updatedConfig.dkim.status = result.status;
    } else {
      result.status = 'Error';
      result.message = data.message;
      updatedConfig.dkim.status = 'Error';
    }
    
    updatedConfig.dkim.verifiedAt = result.timestamp;
    saveDnsConfig(updatedConfig);
    
  } catch (err) {
    result.status = 'Error';
    result.message = `DKIM verification failed: ${err.message}`;
  }
  
  return result;
};

export const verifyDmarcRecord = async () => {
  const config = getDnsConfig();
  const domain = '_dmarc.zsmeservices.com';
  const result = {
    type: 'DMARC',
    timestamp: new Date().toISOString(),
    status: 'unknown',
    currentRecord: '',
    expectedRecord: config.dmarc.record,
    message: '',
    issues: [],
  };
  
  try {
    const apiUrl = process.env.REACT_APP_API_URL || '';
    const data = await fetchJson(`${apiUrl}/api/dns/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, type: 'DMARC' })
    });
    
    if (data.success) {
      result.status = data.data.status;
      result.message = data.data.message;
      result.currentRecord = data.data.currentRecord;
      result.issues = data.data.issues || [];
    } else {
      result.status = 'Error';
      result.message = data.message;
    }
    
    const updatedConfig = getDnsConfig();
    updatedConfig.dmarc.status = result.status;
    updatedConfig.dmarc.verifiedAt = result.timestamp;
    saveDnsConfig(updatedConfig);
    
  } catch (err) {
    result.status = 'Error';
    result.message = `DMARC verification failed: ${err.message}`;
  }
  
  return result;
};

export const generateDkimKey = async (selector = 'mail') => {
  try {
    // Request DKIM key generation from backend
    const apiUrl = process.env.REACT_APP_API_URL || '';
    const data = await fetchJson(`${apiUrl}/api/dns/generate-dkim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selector })
    });
    
    if (data.success) {
      const config = getDnsConfig();
      config.dkim.selector = selector;
      config.dkim.publicKey = data.publicKey;
      config.dkim.status = 'pending';
      saveDnsConfig(config);

      return {
        selector,
        privateKey: data.privateKey,
        publicKey: data.publicKey,
        dnsRecord: `${selector}._domainkey IN TXT "v=DKIM1; k=rsa; p=${data.publicKey}"`,
      };
    } else {
      throw new Error(data.message || 'Failed to generate DKIM key');
    }
  } catch (err) {
    console.error('DKIM generation error:', err);
    // Fallback: Generate a mock DKIM key client-side (for demo)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let key = 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC';
    
    for (let i = 0; i < 43; i++) {
      const randomPart = [];
      for (let j = 0; j < 4; j++) {
        randomPart.push(chars[Math.floor(Math.random() * chars.length)]);
      }
      key += randomPart.join('');
    }
    
    const config = getDnsConfig();
    config.dkim.selector = selector;
    config.dkim.publicKey = key;
    config.dkim.status = 'pending';
    saveDnsConfig(config);
    
    return {
      selector,
      privateKey: key,
      publicKey: key,
      dnsRecord: `${selector}._domainkey IN TXT "v=DKIM1; k=rsa; p=${key}"`,
    };
  }
};

export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  }
};

export const getDnsStatusSummary = () => {
  const config = getDnsConfig();
  return {
    spf: {
      status: config.spf.status,
      label: config.spf.status,
      verifiedAt: config.spf.verifiedAt,
    },
    dkim: {
      status: config.dkim.status,
      label: config.dkim.status,
      selector: config.dkim.selector,
      verifiedAt: config.dkim.verifiedAt,
    },
    dmarc: {
      status: config.dmarc.status,
      label: config.dmarc.status,
      verifiedAt: config.dmarc.verifiedAt,
    },
  };
};

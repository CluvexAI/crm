/**
 * Backend DNS Service
 * Handles DNS record management, verification, and DKIM key operations
 */

const crypto = require('crypto');
const dns = require('dns').promises;

// Default timeout for DNS queries (5 seconds)
const DNS_QUERY_TIMEOUT = 5000;

/**
 * Wrapper for DNS queries with timeout
 * @param {Promise} queryPromise - The DNS query promise
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise} - Resolved query result
 */
const withTimeout = (queryPromise, timeoutMs = DNS_QUERY_TIMEOUT) => {
  return Promise.race([
    queryPromise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`DNS query timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

/**
 * Resolve TXT records with retry logic
 * @param {string} domain - Domain name to query
 * @param {number} retries - Number of retry attempts
 * @returns {Promise<Array>} - Array of TXT records
 */
const resolveTxtWithRetry = async (domain, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const records = await withTimeout(dns.resolveTxt(domain));
      return records;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  return [];
};

// Mock database client (replace with actual DB client)
class DNSService {
  constructor(dbClient) {
    this.db = dbClient;
  }

  /**
   * Create DNS settings for a domain
   */
  async createDNSSettings(domainName, userId) {
    try {
      const result = await this.db.query(
        'INSERT INTO dns_settings (domain_name, created_by_user_id) VALUES ($1, $2) RETURNING *',
        [domainName, userId]
      );
      return result.rows[0];
    } catch (err) {
      throw new Error(`Failed to create DNS settings: ${err.message}`);
    }
  }

/**
    * Save DNS record (SPF, DKIM, DMARC)
    */
  async saveDNSRecord(settingId, recordType, name, value, ttl = 3600, selector = null) {
    try {
      const result = await this.db.query(
        `INSERT INTO dns_records (dns_setting_id, record_type, record_name, record_value, ttl, selector)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (dns_setting_id, record_type, selector) DO UPDATE SET record_value = $4, updated_at = NOW()
         RETURNING *`,
        [settingId, recordType, name, value, ttl, selector]
      );
      return result.rows[0];
    } catch (err) {
      throw new Error(`Failed to save DNS record: ${err.message}`);
    }
  }

  /**
    * Save MX record
    */
  async saveMXRecord(settingId, priority, exchange, ttl = 3600) {
    try {
      // Check for duplicate priorities
      const existingCheck = await this.db.query(
        'SELECT id FROM dns_records WHERE dns_setting_id = $1 AND record_type = \'MX\' AND record_value = $2',
        [settingId, priority.toString()]
      );
      
      if (existingCheck.rows.length > 0) {
        throw new Error(`MX record with priority ${priority} already exists`);
      }

      const result = await this.db.query(
        `INSERT INTO dns_records (dns_setting_id, record_type, record_name, record_value, ttl)
         VALUES ($1, 'MX', '@', $2, $3)
         ON CONFLICT (dns_setting_id, record_type, record_value) DO UPDATE SET 
            record_name = 'updated' || excluded.record_name, 
            updated_at = NOW()
         RETURNING *`,
        [settingId, priority.toString(), ttl]
      );
      return result.rows[0];
    } catch (err) {
      throw new Error(`Failed to save MX record: ${err.message}`);
    }
  }

  /**
    * Get all MX records for a domain
    */
  async getMXRecords(domain) {
    try {
      const result = await this.db.query(
        `SELECT dr.* FROM dns_records dr
         JOIN dns_settings ds ON dr.dns_setting_id = ds.id
         WHERE ds.domain_name = $1 AND dr.record_type = 'MX'
         ORDER BY dr.record_value::integer`,
        [domain]
      );
      return result.rows;
    } catch (err) {
      throw new Error(`Failed to get MX records: ${err.message}`);
    }
  }

  /**
    * Update MX record
    */
  async updateMXRecord(recordId, priority, exchange, ttl = 3600) {
    try {
      const result = await this.db.query(
        `UPDATE dns_records 
         SET record_value = $1, ttl = $2, updated_at = NOW()
         WHERE id = $3 AND record_type = 'MX'
         RETURNING *`,
        [priority.toString(), ttl, recordId]
      );
      return result.rows[0];
    } catch (err) {
      throw new Error(`Failed to update MX record: ${err.message}`);
    }
  }

  /**
    * Delete MX record
    */
  async deleteMXRecord(recordId) {
    try {
      const result = await this.db.query(
        'DELETE FROM dns_records WHERE id = $1 AND record_type = \'MX\' RETURNING *',
        [recordId]
      );
      return result.rows[0];
    } catch (err) {
      throw new Error(`Failed to delete MX record: ${err.message}`);
    }
  }

   /**
    * Verify MX record exists publicly
    */
   async verifyMXRecord(domain) {
     const result = {
       type: 'MX',
       domain,
       timestamp: new Date().toISOString(),
       status: 'unknown',
       currentRecords: [],
       message: '',
       issues: []
     };

     try {
       const records = await withTimeout(dns.resolveMx(domain));
       
       if (records.length > 0) {
         result.currentRecords = records.map(r => ({
           priority: r.priority,
           exchange: r.exchange,
           valid: true
         }));
         
         // Validate that exchange is proper format
         const invalidExchanges = result.currentRecords.filter(r => 
           !r.exchange.match(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
         );
         
         if (invalidExchanges.length > 0) {
           result.status = 'invalid';
           result.message = '⚠️ MX records found but some have invalid exchange formats';
           result.issues = invalidExchanges.map(r => `Invalid exchange: ${r.exchange}`);
         } else {
           result.status = 'valid';
           result.message = '✅ MX records are correctly configured';
         }
       } else {
         result.status = 'not_found';
         result.message = '❌ No MX records found for domain';
         result.issues = ['No MX records exist - incoming emails will not work'];
       }
     } catch (err) {
       if (err.code === 'ENOTFOUND' || err.code === 'ENODATA' || err.message.includes('timed out')) {
         result.status = 'not_found';
         result.message = '❌ No MX records found for domain';
         result.issues = ['No MX records exist - incoming emails will not work'];
       } else {
         result.status = 'error';
         result.message = `❌ Verification error: ${err.message}`;
       }
     }

     return result;
   }

  /**
   * Generate and store DKIM key pair
   */
  async generateDKIMKeyPair(settingId, selector, userId) {
    try {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });

      // Extract public key in DKIM format
      const publicKeyLines = publicKey.split('\n');
      const publicKeyContent = publicKeyLines.slice(1, -2).join('');

      // Store in database
      const result = await this.db.query(
        `INSERT INTO dkim_keys (dns_setting_id, selector, private_key, public_key, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, selector, public_key`,
        [settingId, selector, privateKey, publicKeyContent, userId]
      );

      return {
        id: result.rows[0].id,
        selector: result.rows[0].selector,
        privateKey,
        publicKey: result.rows[0].public_key
      };
    } catch (err) {
      throw new Error(`Failed to generate DKIM key pair: ${err.message}`);
    }
  }

   /**
    * Verify SPF record
    */
   async verifySPFRecord(domain) {
     const result = { type: 'SPF', domain, timestamp: new Date().toISOString(), status: 'Error', currentRecord: '', expectedRecord: `v=spf1 include:mail.${domain} mx ~all`, message: '', issues: [], log: {} };
     try {
       const spfRecords = await resolveTxtWithRetry(domain);
       const spfRecord = spfRecords ? spfRecords.join(' ') : '';
       result.log = { queriedHostname: domain, rawResponse: spfRecords, parsedValue: spfRecord || null, responseTimeMs: 0 };
       if (spfRecord) {
         result.currentRecord = spfRecord;
         if (spfRecord.includes(`mail.${domain}`) || spfRecord.includes('mail.zsmeservices.com')) {
           result.status = 'Verified'; result.message = '✅ SPF record is correctly configured';
         } else {
           result.status = 'Missing'; result.message = '⚠️ SPF record found but does not include required mail server'; result.issues.push('Mail server reference missing from SPF record');
         }
       } else {
         result.status = 'Missing'; result.message = '❌ No SPF record found for domain';
       }
     } catch (err) {
       result.status = 'Error'; result.message = err.message.includes('timed out') ? '❌ DNS lookup timed out' : `❌ Verification error: ${err.message}`; result.log = { error: err.message };
     }
     console.log('SPF Verification Log:', JSON.stringify(result.log, null, 2));
     return result;
   }

   /**
    * Verify DKIM record
    */
   async verifyDKIMRecord(domain, selector = 'mail') {
     const dkimDomain = `${selector}._domainkey.${domain}`;
     const result = { type: 'DKIM', domain: dkimDomain, selector, timestamp: new Date().toISOString(), status: 'Error', currentRecord: '', message: '', issues: [], log: {} };
     try {
       const dkimRecords = await resolveTxtWithRetry(dkimDomain);
       const dkimRecord = dkimRecords ? dkimRecords.join(' ') : '';
       result.log = { queriedHostname: dkimDomain, rawResponse: dkimRecords, parsedValue: dkimRecord || null, responseTimeMs: 0 };
       if (dkimRecord && dkimRecord.includes('v=DKIM1')) {
         result.currentRecord = dkimRecord; result.status = 'Verified'; result.message = '✅ DKIM record is correctly configured';
       } else {
         result.status = 'Pending'; result.message = '⚠️ No valid DKIM record found'; result.issues.push('DKIM record not found');
       }
     } catch (err) {
       result.status = (err.message.includes('failed')) ? 'Pending' : 'Error';
       result.message = err.message.includes('timed out') ? '❌ DNS lookup timed out' : `❌ Verification error: ${err.message}`; result.log = { error: err.message };
     }
     console.log('DKIM Verification Log:', JSON.stringify(result.log, null, 2));
     return result;
   }

   /**
    * Verify DMARC record
    */
   async verifyDMARCRecord(domain) {
     const dmarcDomain = `_dmarc.${domain}`;
     const result = { type: 'DMARC', domain: dmarcDomain, timestamp: new Date().toISOString(), status: 'Error', currentRecord: '', expectedPolicy: 'quarantine or reject', message: '', issues: [], log: {} };
     try {
       const dmarcRecord = await resolveTxtWithRetry(dmarcDomain);
       result.log = { queriedHostname: dmarcDomain, rawResponse: dmarcRecord, parsedValue: dmarcRecord || null, responseTimeMs: 0 };
       if (dmarcRecord) {
         result.currentRecord = dmarcRecord;
         if (dmarcRecord.includes('p=quarantine') || dmarcRecord.includes('p=reject')) {
           result.status = 'Verified'; result.message = '✅ DMARC policy is correctly configured';
         } else if (dmarcRecord.includes('p=none')) {
           result.status = 'Invalid'; result.message = '⚠️ DMARC policy is set to none'; result.issues.push('Consider quarantine or reject');
         } else {
           result.status = 'Invalid'; result.message = '❌ DMARC policy is invalid'; result.issues.push('Invalid DMARC format');
         }
       } else {
         result.status = 'Invalid'; result.message = '❌ No DMARC record found';
       }
     } catch (err) {
       result.status = (err.message.includes('failed')) ? 'Invalid' : 'Error';
       result.message = err.message.includes('timed out') ? '❌ DNS lookup timed out' : `❌ Verification error: ${err.message}`; result.log = { error: err.message };
     }
     console.log('DMARC Verification Log:', JSON.stringify(result.log, null, 2));
     return result;
   }

  /**
   * Log verification result
   */
  async logVerification(settingId, recordType, status, expected, actual, userId) {
    try {
      await this.db.query(
        `INSERT INTO dns_verification_logs (dns_setting_id, record_type, verification_status, expected_value, actual_value, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [settingId, recordType, status, expected, actual, userId]
      );
    } catch (err) {
      console.error('Failed to log verification:', err);
    }
  }

  /**
   * Get DNS settings for domain
   */
  async getDNSSettings(domain) {
    try {
      const result = await this.db.query(
        'SELECT * FROM dns_settings WHERE domain_name = $1',
        [domain]
      );
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to get DNS settings: ${err.message}`);
    }
  }

  /**
   * Get all DNS records for a domain
   */
  async getDNSRecords(domain) {
    try {
      const result = await this.db.query(
        `SELECT dr.* FROM dns_records dr
         JOIN dns_settings ds ON dr.dns_setting_id = ds.id
         WHERE ds.domain_name = $1
         ORDER BY dr.record_type, dr.selector`,
        [domain]
      );
      return result.rows;
    } catch (err) {
      throw new Error(`Failed to get DNS records: ${err.message}`);
    }
  }

  /**
   * Get DKIM keys for domain
   */
  async getDKIMKeys(domain) {
    try {
      const result = await this.db.query(
        `SELECT dk.* FROM dkim_keys dk
         JOIN dns_settings ds ON dk.dns_setting_id = ds.id
         WHERE ds.domain_name = $1 AND dk.status = 'active'
         ORDER BY dk.selector`,
        [domain]
      );
      return result.rows;
    } catch (err) {
      throw new Error(`Failed to get DKIM keys: ${err.message}`);
    }
  }

  /**
    * Get DNS verification status summary
    */
  async getDNSStatusSummary(domain) {
    try {
      const result = await this.db.query(
        `SELECT record_type, status, verified_at FROM dns_records dr
         JOIN dns_settings ds ON dr.dns_setting_id = ds.id
         WHERE ds.domain_name = $1
         ORDER BY dr.record_type`,
        [domain]
      );

      const summary = {
        spf: { status: 'unknown', label: 'Unknown', verifiedAt: null },
        dkim: { status: 'unknown', label: 'Unknown', verifiedAt: null },
        dmarc: { status: 'unknown', label: 'Unknown', verifiedAt: null },
        mx: { status: 'unknown', label: 'Unknown', verifiedAt: null }
      };

      result.rows.forEach(row => {
        const key = row.record_type.toLowerCase();
        if (summary[key]) {
          summary[key].status = row.status;
          summary[key].label = this._getStatusLabel(row.status);
          summary[key].verifiedAt = row.verified_at;
        }
      });

      return summary;
    } catch (err) {
      console.error('Failed to get DNS status summary:', err);
      return {
        spf: { status: 'error', label: 'Error' },
        dkim: { status: 'error', label: 'Error' },
        dmarc: { status: 'error', label: 'Error' },
        mx: { status: 'error', label: 'Error' }
      };
    }
  }

  _getStatusLabel(status) {
    const labels = {
      'valid': '✅ Valid',
      'invalid': '❌ Invalid',
      'not_found': '⏳ Not Found',
      'pending': '⏸️ Pending',
      'warning': '⚠️ Warning',
      'error': '❌ Error'
    };
    return labels[status] || '❓ Unknown';
  }
}

module.exports = DNSService;

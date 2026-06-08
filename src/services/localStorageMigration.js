/**
 * localStorageMigration.js
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time migration: extracts all leads from each Sales Agent's browser
 * localStorage and pushes them to the central InsForge database.
 *
 * Runs ONCE per browser (guarded by MIGRATION_FLAG).
 * Safe to call on every app load — skips immediately if already done.
 * Handles converted leads by also creating the associated sale record.
 */

import api from './apiService';

const CRM_LOCAL_KEY    = 'zsm_crm_leads';
const SALES_LOCAL_KEY  = 'zsm_crm_sales';
const OFFLINE_QUEUE_KEY = 'zsm_crm_offline_queue';
const MIGRATION_FLAG   = 'zsm_crm_migration_complete';
const MIGRATION_VERSION = 'v2.0.0'; // v2: switched to crm_leads table (UUID-safe, no FK constraint)

// ─── Banner Helpers ───────────────────────────────────────────────────────────

const _ensureBanner = () => {
  let banner = document.getElementById('migration-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'migration-banner';
    document.body.prepend(banner);
  }
  return banner;
};

export const showMigrationBanner = (count) => {
  const banner = _ensureBanner();
  banner.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0;
    background: #185FA5;
    color: #ffffff;
    padding: 14px 24px;
    font-size: 14px;
    font-weight: 600;
    z-index: 99999;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    font-family: sans-serif;
  `;

  // Inject keyframe once
  if (!document.getElementById('migration-spin-style')) {
    const style = document.createElement('style');
    style.id = 'migration-spin-style';
    style.innerHTML = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }

  banner.innerHTML = `
    <span style="animation: spin 1.5s linear infinite; display: inline-block;">⟳</span>
    <span>Syncing ${count} offline leads to the central database. Please do not close this window...</span>
  `;
};

export const showMigrationSuccess = (migrated, skipped) => {
  const banner = document.getElementById('migration-banner');
  if (banner) {
    banner.style.background = '#0F6E56';
    banner.innerHTML = `
      <span>✓</span>
      <span>${migrated} leads successfully synced to the central database. ${skipped} duplicates skipped.</span>
    `;
    setTimeout(() => {
      banner.style.opacity = '0';
      banner.style.transition = 'opacity 0.4s ease';
      setTimeout(() => banner.remove(), 450);
    }, 5000);
  }
};

export const showMigrationWarning = (migrated, failed) => {
  const banner = document.getElementById('migration-banner');
  if (banner) {
    banner.style.background = '#854F0B';
    banner.innerHTML = `
      <span>⚠</span>
      <span>${migrated} leads synced. ${failed} leads failed. Will retry on next session.</span>
    `;
  }
};

// Clean phone numbers for safe comparison
const cleanPhoneString = (ph) => {
  if (!ph) return '';
  return String(ph).replace(/[\s\-+()]/g, '').trim();
};

// Deduplicate by ID, local_id, phone, or email to prevent DB unique constraint errors
const isLeadDuplicate = (lead, existingLeads) => {
  // 1. Check ID or local_id match
  const matchesId = existingLeads.some(existing =>
    (lead.id && String(existing.id) === String(lead.id)) ||
    (lead.local_id && String(existing.local_id) === String(lead.local_id))
  );
  if (matchesId) return true;

  // 2. Check phone match (if not empty/short)
  const leadPhone = cleanPhoneString(lead.ownerPhone);
  if (leadPhone && leadPhone.length > 5) {
    const matchesPhone = existingLeads.some(existing => {
      const existingPhone = cleanPhoneString(existing.ownerPhone);
      return existingPhone && existingPhone === leadPhone;
    });
    if (matchesPhone) {
      console.log(`[MIGRATION] Skip phone duplicate: ${lead.contactName || lead.businessName} (${lead.ownerPhone})`);
      return true;
    }
  }

  // 3. Check email match (if not empty)
  if (lead.email && lead.email.trim().length > 3) {
    const leadEmail = lead.email.trim().toLowerCase();
    const matchesEmail = existingLeads.some(existing => {
      const existingEmail = existing.email ? existing.email.trim().toLowerCase() : '';
      return existingEmail && existingEmail === leadEmail;
    });
    if (matchesEmail) {
      console.log(`[MIGRATION] Skip email duplicate: ${lead.contactName || lead.businessName} (${lead.email})`);
      return true;
    }
  }

  return false;
};

// ─── Post Migration Log to Server ─────────────────────────────────────────────

const postMigrationLog = async (summary) => {
  try {
    await fetch((process.env.REACT_APP_API_URL || '') + '/api/migration/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...summary,
        migrated_at: new Date().toISOString(),
        device_info: navigator.userAgent,
        browser_info: navigator.platform,
        migration_source: 'localStorage',
        migration_key: CRM_LOCAL_KEY,
      })
    });
  } catch (err) {
    console.warn('[MIGRATION] Could not post migration log to server:', err.message);
  }
};

// ─── Main Migration Runner ────────────────────────────────────────────────────

export const runOneTimeMigration = async (currentUserId) => {
  // Guard: skip if already migrated in this browser
  const alreadyMigrated = localStorage.getItem(MIGRATION_FLAG);
  if (alreadyMigrated === MIGRATION_VERSION) {
    console.log('[MIGRATION] Already completed for this browser. Skipping.');
    return null;
  }

  // Read locally stored leads
  const rawLeadsData = localStorage.getItem(CRM_LOCAL_KEY);
  const rawSalesData = localStorage.getItem(SALES_LOCAL_KEY);

  if (!rawLeadsData) {
    console.log('[MIGRATION] No local leads found. Marking migration complete.');
    localStorage.setItem(MIGRATION_FLAG, MIGRATION_VERSION);
    return null;
  }

  let localLeads = [];
  let localSales = [];

  try {
    const parsed = JSON.parse(rawLeadsData);
    localLeads = Array.isArray(parsed) ? parsed : Object.values(parsed);
  } catch (err) {
    console.error('[MIGRATION] Failed to parse local leads:', err);
    return null;
  }

  try {
    const parsedSales = rawSalesData ? JSON.parse(rawSalesData) : [];
    localSales = Array.isArray(parsedSales) ? parsedSales : Object.values(parsedSales);
  } catch (_) {
    localSales = [];
  }

  if (!localLeads.length) {
    console.log('[MIGRATION] Local lead array is empty. Marking complete.');
    localStorage.setItem(MIGRATION_FLAG, MIGRATION_VERSION);
    return null;
  }

  console.log(`[MIGRATION] Found ${localLeads.length} local leads to migrate.`);
  showMigrationBanner(localLeads.length);

  // Fetch existing leads from central DB for deduplication
  let existingLeads = [];
  try {
    existingLeads = await api.leads.getAll();
  } catch (err) {
    console.warn('[MIGRATION] Could not fetch existing leads for deduplication:', err.message);
  }

  const results = { migrated: [], skipped: [], failed: [] };

  // ── Migrate each lead ────────────────────────────────────────────────────
  for (const lead of localLeads) {
    const isDuplicate = isLeadDuplicate(lead, existingLeads);

    if (isDuplicate) {
      results.skipped.push(lead.id || lead.ownerPhone);
      console.log(`[MIGRATION] Skipped duplicate: ${lead.contactName || lead.businessName}`);
      continue;
    }

    try {
      // Enrich with migration metadata
      const migratedLead = {
        ...lead,
        local_id: String(lead.id || lead.local_id || `local_${Date.now()}`),
        migration_source: 'localStorage_migration',
        migrated_at: new Date().toISOString(),
        original_created_at: lead.createdAt || lead.created_at || null,
        created_by: lead.createdBy || currentUserId || null,
      };

      const saved = await api.leads.create(migratedLead);
      results.migrated.push(lead.id);
      existingLeads.push(saved); // prevent re-inserting within this loop
      console.log(`[MIGRATION] ✓ Migrated lead: ${lead.contactName || lead.businessName || lead.id}`);

      // If this lead was converted — also create the sale and invoice records
      if (
        (lead.status === 'converted' || lead.status === 'Closed (Won)') &&
        !localSales.some(s => String(s.leadId) === String(lead.id))
      ) {
        try {
          const savedSale = await api.sales.create({
            leadId: saved.id || lead.id,
            businessName: lead.businessName || lead.contactName,
            proposalType: lead.proposalType || lead.plan || 'N/A',
            amount: lead.saleValue || lead.amount || 0,
            paymentStatus: lead.paymentStatus || 'Pending',
            createdBy: lead.convertedBy || currentUserId,
            migration_source: 'localStorage_migration',
            migrated_at: new Date().toISOString(),
            createdAt: lead.convertedAt || new Date().toISOString(),
          });
          console.log(`[MIGRATION] ✓ Created sale record for converted lead: ${lead.id}`);

          // Also create invoice centrally for the converted lead
          try {
            await api.invoices.create({
              id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              saleId: savedSale.id || `sale_${Date.now()}`,
              leadId: saved.id || lead.id,
              status: 'PENDING',
              lockedTotal: lead.saleValue || lead.amount || 0,
              totalAmount: lead.saleValue || lead.amount || 0,
              client: {
                businessName: lead.businessName || lead.contactName || '',
                contactName: lead.contactName || '',
                email: lead.email || '',
                phone: lead.ownerPhone || ''
              },
              invoiceInfo: {
                invoiceDate: new Date().toISOString().split('T')[0],
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                currency: 'EUR'
              },
              services: [{
                id: `svc_${Date.now()}`,
                name: lead.proposalType || lead.plan || 'Web Design Plan',
                description: 'Migrated service item',
                duration: 'Monthly',
                quantity: 1,
                unitPrice: lead.saleValue || lead.amount || 0,
                total: lead.saleValue || lead.amount || 0
              }],
              createdAt: new Date().toISOString()
            });
            console.log(`[MIGRATION] ✓ Created invoice record for converted lead: ${lead.id}`);
          } catch (invErr) {
            console.warn(`[MIGRATION] Could not create invoice for converted lead ${lead.id}:`, invErr.message);
          }
        } catch (saleErr) {
          console.warn(`[MIGRATION] Could not create sale for converted lead ${lead.id}:`, saleErr.message);
        }
      }
    } catch (err) {
      const errMsg = String(err?.message || err || '').toLowerCase();
      const isDbDuplicate = errMsg.includes('already exists') || 
                            errMsg.includes('duplicate') || 
                            errMsg.includes('unique constraint') ||
                            errMsg.includes('violates unique constraint');

      if (isDbDuplicate) {
        results.skipped.push(lead.id || lead.local_id);
        console.log(`[MIGRATION] DB duplicate skipped: ${lead.contactName || lead.businessName || lead.id}`);
        continue;
      }

      results.failed.push(lead.id || lead.local_id || 'unknown');
      console.error(
        `[MIGRATION] ✕ Failed to migrate lead: ${lead.contactName || lead.businessName || lead.id}`,
        '\nError:', err?.message || err,
        '\nLead data:', JSON.stringify({ id: lead.id, status: lead.status, ownerPhone: lead.ownerPhone })
      );

      // Post the exact migration error to the backend for audit
      try {
        await fetch((process.env.REACT_APP_API_URL || '') + '/api/migration/log-error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_id: currentUserId || 'unknown',
            lead_name: lead.contactName || lead.businessName || 'Unknown Lead',
            lead_local_id: lead.id || lead.local_id || null,
            http_status: err.status || 500,
            error_response: err.message || String(err),
            lead_data: lead
          })
        });
      } catch (logErr) {
        console.warn('[MIGRATION] Failed to post error details to backend:', logErr.message);
      }
    }
  }

  // ── Also sync offline queue if any ───────────────────────────────────────
  const offlineQueue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  if (offlineQueue.length > 0) {
    console.log(`[MIGRATION] Also syncing ${offlineQueue.length} offline-queued leads...`);
    const queueFailed = [];
    for (const qLead of offlineQueue) {
      const { local_id, offline, queued_at, ...cleanLead } = qLead;
      if (isLeadDuplicate(qLead, existingLeads)) {
        results.skipped.push(local_id);
        continue;
      }
      try {
        const saved = await api.leads.create({ ...cleanLead, migration_source: 'offline_queue' });
        results.migrated.push(local_id);
        existingLeads.push(saved);
      } catch (err) {
        queueFailed.push(qLead);
        results.failed.push(local_id);
      }
    }
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queueFailed));
  }

  // ── Post audit log to backend ─────────────────────────────────────────────
  await postMigrationLog({
    agent_id: currentUserId,
    total_local: localLeads.length,
    total_migrated: results.migrated.length,
    total_skipped: results.skipped.length,
    total_failed: results.failed.length,
    status: results.failed.length === 0 ? 'complete' : 'partial',
  });

  // ── Update UI and clear localStorage if fully successful ─────────────────
  if (results.failed.length === 0) {
    localStorage.removeItem(CRM_LOCAL_KEY);
    localStorage.setItem(MIGRATION_FLAG, MIGRATION_VERSION);
    showMigrationSuccess(results.migrated.length, results.skipped.length);
    console.log(
      `[MIGRATION COMPLETE] Migrated: ${results.migrated.length} | ` +
      `Skipped: ${results.skipped.length} | Failed: 0`
    );
  } else {
    // Keep localStorage intact so next session can retry failed items
    showMigrationWarning(results.migrated.length, results.failed.length);
    console.warn(
      `[MIGRATION PARTIAL] ${results.failed.length} leads failed. ` +
      'Will retry on next session.'
    );
  }

  return results;
};

const MigrationService = { runOneTimeMigration, showMigrationBanner, showMigrationSuccess, showMigrationWarning };

export default MigrationService;

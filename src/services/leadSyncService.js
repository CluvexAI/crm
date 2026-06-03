/**
 * leadSyncService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Permanently replaces localStorage with direct backend API calls.
 * Drop-in replacement for all localStorage lead operations.
 *
 * ARCHITECTURE: All reads/writes go to InsForge cloud database.
 * Offline fallback: uses zsm_crm_offline_queue (NOT zsm_crm_leads).
 * Auto-syncs the offline queue when the browser comes back online.
 */

import api from './apiService';

const OFFLINE_QUEUE_KEY = 'zsm_crm_offline_queue';

const LeadSyncService = {

  // ── CREATE — save directly to backend, no localStorage ──────────────────
  async createLead(leadData) {
    try {
      const saved = await api.leads.create(leadData);
      if (!saved) throw new Error('Lead not saved to database — empty response');
      return saved;
    } catch (err) {
      console.warn('[SyncService] createLead failed centrally — enqueuing offline fallback.', err.message);
      return this.createLeadOffline(leadData);
    }
  },

  // ── READ — always fetch from backend ────────────────────────────────────
  async getLeads(filters = {}) {
    const leads = await api.leads.getAll();
    // Apply any client-side filters (status, assignedTo, etc.)
    return Object.keys(filters).length === 0
      ? leads
      : leads.filter(lead =>
          Object.entries(filters).every(([key, val]) => lead[key] === val)
        );
  },

  // ── UPDATE — update backend directly ────────────────────────────────────
  async updateLead(leadId, updates) {
    const saved = await api.leads.update(leadId, updates);
    if (!saved) throw new Error('Lead update not confirmed by database');
    return saved;
  },

  // ── ADD REMARK — save remark to backend ─────────────────────────────────
  async addRemark(leadId, remark) {
    try {
      const lead = await api.leads.getById(leadId);
      const newRemark = {
        text: typeof remark === 'string' ? remark : remark.text,
        timestamp: new Date().toISOString(),
        by: typeof remark === 'object' ? remark.by : undefined,
      };
      const updatedRemarks = [...(lead?.remarks || []), newRemark];
      return await api.leads.update(leadId, {
        remarks: updatedRemarks,
        lastFollowUp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[SyncService] addRemark failed:', err.message);
      throw err;
    }
  },

  // ── CONVERT — atomic conversion: create sale + update lead status ────────
  async convertLead(leadId, saleData) {
    // 1. Create sale record in central database
    const savedSale = await api.sales.create({
      ...saleData,
      leadId,
      createdAt: new Date().toISOString(),
    });

    if (!savedSale) throw new Error('Lead conversion not confirmed — sale record not created');

    // 2. Update lead status to Closed (Won)
    await api.leads.update(leadId, {
      status: 'Closed (Won)',
      convertedAt: new Date().toISOString(),
    });

    return { success: true, sale: savedSale };
  },

  // ── OFFLINE FALLBACK — temporary queue only, not zsm_crm_leads ──────────
  createLeadOffline(leadData) {
    const offlineQueue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');

    const localLead = {
      ...leadData,
      id: leadData.id || Date.now(),
      local_id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      offline: true,
      queued_at: new Date().toISOString(),
    };

    offlineQueue.push(localLead);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(offlineQueue));

    console.warn(
      '[OFFLINE] Lead queued locally. Will sync when connection is restored. ' +
      `Queue length: ${offlineQueue.length}`
    );

    return localLead;
  },

  // ── SYNC OFFLINE QUEUE — runs when connection restored ───────────────────
  async syncOfflineQueue() {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    if (!queue.length) return;

    console.log(`[OFFLINE SYNC] Syncing ${queue.length} queued leads to central database...`);

    const synced = [];
    const failed = [];

    for (const lead of queue) {
      try {
        const { local_id, offline, queued_at, ...cleanLead } = lead;
        await api.leads.create(cleanLead);
        synced.push(lead.local_id);
        console.log(`[OFFLINE SYNC] ✓ Synced offline lead: ${lead.local_id}`);
      } catch (err) {
        failed.push(lead.local_id);
        console.error(`[OFFLINE SYNC] ✕ Failed to sync: ${lead.local_id}`, err.message);
      }
    }

    // Retain only truly failed items in the queue
    const remaining = queue.filter(l => failed.includes(l.local_id));
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));

    console.log(
      `[OFFLINE SYNC DONE] Synced: ${synced.length} | Failed: ${failed.length}`
    );

    return { synced: synced.length, failed: failed.length };
  },
};

// Auto-sync when connection is restored
window.addEventListener('online', () => {
  console.log('[SyncService] Connection restored — starting offline queue sync...');
  LeadSyncService.syncOfflineQueue();
});

export default LeadSyncService;

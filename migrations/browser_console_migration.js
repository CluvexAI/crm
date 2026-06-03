// =============================================================
// FORCE MIGRATION SCRIPT
// Paste this ENTIRE block into your browser console while
// logged in to the CRM as an Admin user.
// It reads all leads from localStorage and pushes them to
// the shared crm_leads cloud table so all agents can see them.
// =============================================================

(async () => {
  console.log('[MIGRATION] Starting localStorage → crm_leads sync...');

  // Read leads from localStorage
  const raw = localStorage.getItem('zsm_crm_leads');
  if (!raw) {
    console.log('[MIGRATION] No leads found in localStorage. Nothing to migrate.');
    return;
  }

  let localLeads;
  try {
    localLeads = JSON.parse(raw);
  } catch (e) {
    console.error('[MIGRATION] Failed to parse localStorage leads:', e.message);
    return;
  }

  console.log(`[MIGRATION] Found ${localLeads.length} leads in localStorage.`);

  // Get the InsForge client from the window (it's initialised by the app)
  // We'll use fetch directly against the InsForge REST API
  const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
  const INSFORGE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';

  const headers = {
    'Content-Type': 'application/json',
    'apikey': INSFORGE_KEY,
    'Authorization': `Bearer ${INSFORGE_KEY}`,
    'Prefer': 'return=representation'
  };

  // First fetch existing crm_leads to avoid duplicates
  let existingLeads = [];
  try {
    const resp = await fetch(`${INSFORGE_URL}/rest/v1/crm_leads?select=owner_phone,email,website`, { headers });
    existingLeads = await resp.json();
    console.log(`[MIGRATION] ${existingLeads.length} leads already in crm_leads cloud table.`);
  } catch (e) {
    console.warn('[MIGRATION] Could not fetch existing leads:', e.message);
  }

  const normPhone = (p) => {
    if (!p) return null;
    const d = String(p).replace(/\D/g, '');
    return d.length >= 7 ? d.replace(/^0+/, '') : null;
  };
  const normEmail = (e) => e ? String(e).trim().toLowerCase() : null;

  let migrated = 0, skipped = 0, failed = 0;

  for (const lead of localLeads) {
    // Check if already in cloud
    const lPhone = normPhone(lead.ownerPhone || lead.owner_phone);
    const lEmail = normEmail(lead.email);

    const alreadyExists = existingLeads.some(ex => {
      const ep = normPhone(ex.owner_phone);
      const ee = normEmail(ex.email);
      return (lPhone && ep && ep === lPhone) || (lEmail && ee && ee === lEmail);
    });

    if (alreadyExists) {
      console.log(`[MIGRATION] Skipping (already in cloud): ${lead.businessName || lead.contactName} | ${lead.ownerPhone}`);
      skipped++;
      continue;
    }

    // Map camelCase → snake_case
    const payload = {
      id:               lead.id && lead.id.match(/^[0-9a-f-]{36}$/i) ? lead.id : undefined,
      contact_name:     lead.contactName || lead.contact_name || '',
      business_name:    lead.businessName || lead.business_name || '',
      owner_phone:      lead.ownerPhone || lead.owner_phone || '',
      alt_phone:        lead.altPhone || lead.alt_phone || '',
      website:          lead.website || '',
      country:          lead.country || '',
      address:          lead.address || '',
      county:           lead.county || '',
      email:            lead.email || '',
      business_category: lead.businessCategory || lead.business_category || '',
      proposal_type:    lead.proposalType || lead.proposal_type || '',
      company_type:     lead.companyType || lead.company_type || '',
      city:             lead.city || '',
      status:           lead.status || 'New Lead',
      follow_up_result: lead.followUpResult || lead.follow_up_result || '',
      created_by:       String(lead.createdBy || lead.created_by || ''),
      created_by_name:  lead.createdByName || lead.created_by_name || '',
      assigned_to:      String(lead.assignedTo || lead.assigned_to || lead.createdBy || ''),
      remarks:          lead.remarks || [],
      last_follow_up:   lead.lastFollowUp || lead.last_follow_up || lead.createdAt || new Date().toISOString(),
      followup_count:   lead.followupCount || 0,
      created_at:       lead.createdAt || lead.created_at || new Date().toISOString(),
    };

    // Remove undefined fields
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    try {
      const resp = await fetch(`${INSFORGE_URL}/rest/v1/crm_leads`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (resp.ok) {
        console.log(`[MIGRATION] ✅ Pushed: ${payload.business_name || payload.contact_name} | ${payload.owner_phone}`);
        migrated++;
        existingLeads.push(payload); // prevent re-push in same run
      } else {
        const err = await resp.json();
        console.error(`[MIGRATION] ❌ Failed: ${payload.business_name}`, err);
        failed++;
      }
    } catch (e) {
      console.error(`[MIGRATION] ❌ Error: ${payload.business_name}`, e.message);
      failed++;
    }
  }

  console.log('\n[MIGRATION COMPLETE]');
  console.log(`✅ Migrated: ${migrated}`);
  console.log(`⏭  Skipped (already in cloud): ${skipped}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed === 0 && migrated > 0) {
    console.log('\n✅ All leads are now in the shared cloud database.');
    console.log('Duplicate prevention is now ACTIVE across all agents on all devices.');
  }
})();

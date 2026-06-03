import insforge from './insforgeClient';

const db = insforge.database;

// ─── Company & Currency Helpers (local clone to avoid circular imports) ───
const getCompanySettings = () => {
  const defaults = {
    name: "ZSM e-Services Pvt. Ltd.",
    address: "55B, Mirza Ghalib Street, Kolkata-700014, India",
    email: "contact@zsmeservices.com",
    phone: "+91 33 4006 9692",
    contactDetails: {
      mailingAddress: "55B Mirza Ghalib Street, Kolkata 700016",
      email: "info@zsmeservices.com",
      contacts: {
        AUS: "+61 756606789",
        IRE: "+353 12544499",
        IND: "+91 033 40049692"
      }
    }
  };
  try {
    const saved = localStorage.getItem('zsm_company_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { 
        ...defaults, 
        ...parsed, 
        contactDetails: { ...defaults.contactDetails, ...(parsed.contactDetails || {}) } 
      };
    }
  } catch (e) {}
  return defaults;
};

const getCurrencySymbol = (code) => {
  if (code === 'EUR') return '€';
  if (code === 'GBP') return '£';
  if (code === 'USD') return '$';
  if (code === 'AUD') return 'A$';
  return '€';
};

// ─── UUID & Sanitization Helpers ──────────────────────────────────────────────
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

// ─── Normalization Helpers ─────────────────────────────────────────────────────
const normPhone = (p) => {
  if (!p) return null;
  let d = String(p).replace(/\D/g, '');
  
  // Handle common international dialing mistakes (Country Code + Trunk Prefix 0)
  if (d.startsWith('3530')) d = '353' + d.substring(4); // Ireland
  else if (d.startsWith('440')) d = '44' + d.substring(3); // UK
  else if (d.startsWith('610')) d = '61' + d.substring(3); // Australia
  
  d = d.replace(/^0+/, '');
  return d.length >= 7 ? d : null;
};
const normEmail = (e) => e ? String(e).trim().toLowerCase() : null;
const normWebsite = (w) => {
  if (!w) return null;
  return String(w).trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').split('/')[0];
};

// ─── BIDIRECTIONAL MAPPERS (camelCase ⇆ snake_case) ──────────────────────────

const mapLeadToDB = (lead) => {
  if (!lead) return lead;
  const clean = { ...lead };
  if (!clean.id || !uuidRegex.test(clean.id)) {
    clean.id = generateUUID();
  }
  
  const dbLead = {
    id: clean.id,
    contact_name: clean.contactName || clean.contact_name || '',
    business_name: clean.businessName || clean.business_name || '',
    owner_phone: clean.ownerPhone || clean.owner_phone || '',
    alt_phone: clean.altPhone || clean.alt_phone || '',
    website: clean.website || '',
    country: clean.country || '',
    address: clean.address || '',
    county: clean.county || '',
    email: clean.email || '',
    business_category: clean.businessCategory || clean.business_category || '',
    status: clean.status || 'New Lead',
    created_by: String(clean.createdBy !== undefined ? clean.createdBy : (clean.created_by || '')),
    created_by_name: clean.createdByName || clean.created_by_name || '',
    assigned_to: String(clean.assignedTo !== undefined ? clean.assignedTo : (clean.assigned_to || '')),
    follow_up_result: clean.followUpResult || clean.follow_up_result || '',
    city: clean.city || '',
    company_type: clean.companyType || clean.company_type || '',
    remarks: clean.remarks || [],
    created_at: clean.createdAt || clean.created_at || new Date().toISOString(),
    last_follow_up: clean.lastFollowUp || clean.last_follow_up || new Date().toISOString(),
    proposal_type: clean.proposalType || clean.proposal_type || ''
  };

  Object.keys(dbLead).forEach(k => {
    if (dbLead[k] === undefined || dbLead[k] === null) delete dbLead[k];
  });
  return dbLead;
};

const mapLeadFromDB = (dbLead) => {
  if (!dbLead) return null;
  return {
    id: dbLead.id,
    contactName: dbLead.contact_name || '',
    businessName: dbLead.business_name || '',
    ownerPhone: dbLead.owner_phone || '',
    altPhone: dbLead.alt_phone || '',
    website: dbLead.website || '',
    country: dbLead.country || '',
    address: dbLead.address || '',
    county: dbLead.county || '',
    email: dbLead.email || '',
    businessCategory: dbLead.business_category || '',
    status: dbLead.status || 'New Lead',
    createdBy: dbLead.created_by,
    createdByName: dbLead.created_by_name || '',
    assignedTo: dbLead.assigned_to,
    followUpResult: dbLead.follow_up_result || '',
    city: dbLead.city || '',
    companyType: dbLead.company_type || '',
    remarks: dbLead.remarks || [],
    createdAt: dbLead.created_at,
    lastFollowUp: dbLead.last_follow_up,
    proposalType: dbLead.proposal_type || ''
  };
};

const mapSaleToDB = (sale) => {
  if (!sale) return sale;
  const clean = { ...sale };
  if (!clean.id || !uuidRegex.test(clean.id)) {
    clean.id = generateUUID();
  }

  const dbSale = {
    id: clean.id,
    lead_id: clean.leadId !== undefined ? clean.leadId : clean.lead_id,
    lead_name: clean.leadName || clean.lead_name || '',
    business_name: clean.businessName || clean.business_name || '',
    closed_by: clean.closedBy !== undefined ? clean.closedBy : clean.closed_by,
    closed_by_name: clean.closedByName || clean.closed_by_name || '',
    proposal_type: clean.proposalType || clean.proposal_type || '',
    amount: clean.amount || 0,
    sale_status: clean.saleStatus || clean.sale_status || 'Closed',
    payment_status: clean.paymentStatus || clean.payment_status || 'Pending',
    invoice_status: clean.invoiceStatus || clean.invoice_status || 'Pending',
    invoice_id: clean.invoiceId || clean.invoice_id || null,
    created_at: clean.createdAt || clean.created_at || new Date().toISOString(),
    installments: clean.installments || 1,
    paid_installments: clean.paidInstallments !== undefined ? clean.paidInstallments : clean.paid_installments || 0,
    installment_plan: clean.installmentPlan || clean.installment_plan || [],
    created_by: clean.createdBy !== undefined ? clean.createdBy : clean.created_by
  };

  Object.keys(dbSale).forEach(k => {
    if (dbSale[k] === undefined || dbSale[k] === null) delete dbSale[k];
  });
  return dbSale;
};

const mapSaleFromDB = (dbSale) => {
  if (!dbSale) return null;
  return {
    id: dbSale.id,
    leadId: dbSale.lead_id,
    leadName: dbSale.lead_name || '',
    businessName: dbSale.business_name || '',
    closedBy: dbSale.closed_by,
    closedByName: dbSale.closed_by_name || '',
    proposalType: dbSale.proposal_type || '',
    amount: dbSale.amount || 0,
    saleStatus: dbSale.sale_status || 'Closed',
    paymentStatus: dbSale.payment_status || 'Pending',
    invoiceStatus: dbSale.invoice_status || 'Pending',
    invoiceId: dbSale.invoice_id || null,
    createdAt: dbSale.created_at,
    installments: dbSale.installments || 1,
    paidInstallments: dbSale.paid_installments || 0,
    installmentPlan: dbSale.installment_plan || [],
    createdBy: dbSale.created_by
  };
};

const mapInvoiceToDB = (inv) => {
  if (!inv) return inv;
  return {
    id: inv.id,
    sale_id: inv.saleId || inv.sale_id,
    lead_name: inv.client?.businessName || inv.lead_name || '',
    amount: inv.lockedTotal || inv.totalAmount || inv.amount || 0,
    status: inv.status || 'Pending',
    generated_date: inv.invoiceInfo?.invoiceDate || inv.generated_date || new Date().toISOString().split('T')[0],
    due_date: inv.invoiceInfo?.dueDate || inv.due_date || new Date().toISOString().split('T')[0],
    items: inv.services || inv.items || [],
    created_at: inv.createdAt || inv.created_at || new Date().toISOString()
  };
};

const mapInvoiceFromDB = (dbInv) => {
  if (!dbInv) return null;
  const companySettings = getCompanySettings();
  const lockedTotal = dbInv.amount || 0;
  
  return {
    id: dbInv.id,
    invoiceNumber: dbInv.id?.startsWith('inv_') ? 'INV-' + dbInv.id.substring(4, 12).toUpperCase() : dbInv.id || '',
    saleId: dbInv.sale_id,
    leadId: dbInv.lead_id || '',
    createdBy: dbInv.created_by || '',
    status: dbInv.status?.toUpperCase() || 'PENDING',
    lockedTotal: lockedTotal,
    saleTotalAmount: lockedTotal,
    contactDetails: {
      mailingAddress: companySettings.contactDetails.mailingAddress,
      email: companySettings.contactDetails.email,
      contacts: { ...companySettings.contactDetails.contacts }
    },
    from: { ...companySettings },
    client: {
      businessName: dbInv.lead_name || '',
      contactName: dbInv.lead_name || '',
      email: '', phone: '', addressLine1: '', city: '', state: '',
      country: '', countryCode: 'IN', dialCode: '+91'
    },
    invoiceInfo: {
      invoiceDate: dbInv.generated_date || '',
      dueDate: dbInv.due_date || '',
      currency: 'EUR',
      currencySymbol: '€'
    },
    services: (dbInv.items || []).map((item, idx) => ({
      id: `svc_${Date.now()}_${idx}`,
      name: item.name || item.description || 'Service',
      description: item.description || '',
      duration: 'Monthly',
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || item.amount || lockedTotal,
      total: item.total || item.amount || lockedTotal
    })),
    amountSummary: {
      subtotal: lockedTotal, discountType: 'FLAT', discountValue: 0,
      discountAmount: 0, afterDiscount: lockedTotal, taxName: 'GST',
      taxPercent: 0, taxAmount: 0, additionalCharges: [],
      additionalChargesTotal: 0, grandTotal: lockedTotal
    },
    installments: [], payments: [],
    totalAmount: lockedTotal,
    paidAmount: dbInv.status?.toUpperCase() === 'PAID' || dbInv.status?.toUpperCase() === 'FULL' ? lockedTotal : 0,
    dueAmount: dbInv.status?.toUpperCase() === 'PAID' || dbInv.status?.toUpperCase() === 'FULL' ? 0 : lockedTotal,
    notes: 'Thank you for your business. Payment is due within 30 days.',
    terms: 'Payment terms: Net 30 days. Late payments may incur additional fees.',
    renewalTerms: 'This service will auto-renew unless cancelled 15 days prior.',
    signature: { authorizedBy: companySettings.name, signedAt: dbInv.created_at || new Date().toISOString() },
    auditLog: [],
    createdAt: dbInv.created_at || new Date().toISOString(),
    updatedAt: dbInv.created_at || new Date().toISOString()
  };
};

// ─── Shared Duplicate Check ────────────────────────────────────────────────────
// Exported so AppContext.js can use the same logic in its offline fallback
export const runDuplicateCheck = async (phone, email, website, agentId) => {
  const pNorm = normPhone(phone);
  const eNorm = normEmail(email);
  const wNorm = normWebsite(website);
  if (!pNorm && !eNorm && !wNorm) return { isDuplicate: false };

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const matchesLead = (l) => {
    const ownerPhone   = l.owner_phone  || l.ownerPhone  || '';
    const ownerEmail   = l.email        || '';
    const ownerWebsite = l.website      || '';
    const createdBy    = String(l.created_by || l.createdBy || '');
    const status       = l.status || '';
    const lastAct      = new Date(l.last_follow_up || l.lastFollowUp || l.created_at || l.createdAt || 0);

    // If it has been soft deleted, ignore it
    if (l.deleted_at || l.deletedAt) return null;

    if (['Closed (Lost)', 'closed_lost', 'rejected'].includes(status)) return null;
    if (lastAct < cutoff) return null;

    const lPhone     = normPhone(ownerPhone);
    const phoneMatch = pNorm && lPhone && (lPhone === pNorm || lPhone.includes(pNorm) || pNorm.includes(lPhone));
    const emailMatch = eNorm && normEmail(ownerEmail) === eNorm;
    const webMatch   = wNorm && normWebsite(ownerWebsite) === wNorm;

    if (!phoneMatch && !emailMatch && !webMatch) return null;

    const daysSince     = Math.floor((Date.now() - lastAct.getTime()) / 86400000);
    const daysRemaining = Math.max(0, 30 - daysSince);
    const matchedOn     = phoneMatch ? 'phone' : emailMatch ? 'email' : 'website';
    const matchedValue  = phoneMatch ? ownerPhone : emailMatch ? ownerEmail : ownerWebsite;
    const agentName     = l.created_by_name || l.createdByName || `Agent (${createdBy.substring(0, 8)}...)`;

    return {
      isDuplicate:         true,
      matched_on:          matchedOn,
      matched_value:       matchedValue,
      lead_name:           l.business_name || l.businessName || l.contact_name || l.contactName || 'Unknown',
      owner_agent_name:    agentName,
      days_since_activity: daysSince,
      days_remaining:      daysRemaining,
      message:             'Lead already exists and is under active follow-up by another Sales Agent User within the last 30 days.'
    };
  };

  // Step 1 — Cloud crm_leads table (UUID-compatible, no FK constraint)
  try {
    const { data: cloudLeads, error } = await db.from('crm_leads').select('*');
    if (!error && cloudLeads) {
      for (const l of cloudLeads) {
        const r = matchesLead(l); if (r) return r;
      }
    }
  } catch (ex) {
    console.warn('[DUP CHECK] Cloud check skipped:', ex.message);
  }

  // Step 2 — localStorage (same browser, same device)
  try {
    const raw = localStorage.getItem('zsm_crm_leads');
    if (raw) {
      const localLeads = JSON.parse(raw);
      for (const l of localLeads) {
        const r = matchesLead(l);
        if (r) return { ...r, matched_on: r.matched_on + ' (local)' };
      }
    }
  } catch (localErr) {
    console.error('[DUP CHECK] Local check error:', localErr.message);
    throw new Error('Duplicate check could not be completed. Lead not saved for safety.');
  }

  return { isDuplicate: false };
};

export const api = {
  users: {
    getAll: async () => {
      const { data, error } = await db.from('users').select('*');
      if (error) throw error;
      return data || [];
    },
    getById: async (id) => {
      const { data, error } = await db.from('users').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    create: async (user) => {
      const { data, error } = await db.from('users').insert([user]);
      if (error) throw error;
      return data?.[0] || user;
    },
    update: async (id, updates) => {
      const { data, error } = await db.from('users').update(updates).eq('id', id);
      if (error) throw error;
      return data?.[0] || updates;
    },
    delete: async (id) => {
      const { error } = await db.from('users').delete().eq('id', id);
      if (error) throw error;
    }
  },

  leads: {
    getAll: async () => {
      let { data, error } = await db.from('crm_leads').select('*');
      if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
        ({ data, error } = await db.from('leads').select('*'));
      }
      if (error) throw error;
      return (data || []).map(mapLeadFromDB);
    },
    getById: async (id) => {
      let { data, error } = await db.from('crm_leads').select('*').eq('id', id).single();
      if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
        ({ data, error } = await db.from('leads').select('*').eq('id', id).single());
      }
      if (error) throw error;
      return mapLeadFromDB(data);
    },
    checkDuplicate: async (phone, email, website, agentId) => {
      return runDuplicateCheck(phone, email, website, agentId);
    },
    create: async (lead) => {
      const clean = mapLeadToDB(lead);
      const agentId = clean.created_by || clean.assigned_to;

      // HARD BLOCK — no bypass
      const dupCheck = await runDuplicateCheck(clean.owner_phone, clean.email, clean.website, agentId);
      if (dupCheck && dupCheck.isDuplicate) {
        try {
          await db.from('crm_duplicate_blocks').insert([{
            attempted_by:      String(agentId),
            attempted_by_name: clean.created_by_name || '',
            matched_lead_id:   dupCheck.lead_id ? String(dupCheck.lead_id) : null,
            matched_on:        dupCheck.matched_on || 'unknown',
            matched_value:     dupCheck.matched_value || '',
            days_remaining:    dupCheck.days_remaining || 0,
            attempted_data:    clean
          }]);
        } catch (logErr) {
          console.warn('[create] Audit log failed:', logErr.message);
        }
        throw new Error(`DUPLICATE_LEAD:${JSON.stringify(dupCheck)}`);
      }

      // Insert into crm_leads (TEXT columns — accepts UUID agent IDs)
      const { data, error } = await db.from('crm_leads').insert([clean]);
      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          throw new Error('ACTION_REQUIRED: Run 20260529_create_crm_leads.sql in InsForge SQL Editor.');
        }
        throw error;
      }
      return mapLeadFromDB(data?.[0]) || lead;
    },
    update: async (id, updates) => {
      const clean = mapLeadToDB({ ...updates, id });
      let { data, error } = await db.from('crm_leads').update(clean).eq('id', id);
      if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
        ({ data, error } = await db.from('leads').update(clean).eq('id', id));
      }
      if (error) throw error;
      return mapLeadFromDB(data?.[0]) || updates;
    },
    delete: async (id) => {
      let { error } = await db.from('crm_leads').delete().eq('id', id);
      if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
        ({ error } = await db.from('leads').delete().eq('id', id));
      }
      if (error) throw error;
    },
    addFollowupLog: async (leadId, agentId, text) => {
      try {
        await db.from('lead_followup_logs').insert([{
          lead_id: String(leadId),
          followed_up_by: String(agentId),
          followup_type: 'remark',
          notes: text
        }]);
      } catch (e) {
        console.warn('Failed to insert followup log:', e);
      }
    }
  },

  sales: {
    getAll: async () => {
      const { data, error } = await db.from('sales').select('*');
      if (error) throw error;
      return (data || []).map(mapSaleFromDB);
    },
    getById: async (id) => {
      const { data, error } = await db.from('sales').select('*').eq('id', id).single();
      if (error) throw error;
      return mapSaleFromDB(data);
    },
    create: async (sale) => {
      const clean = mapSaleToDB(sale);
      const { data, error } = await db.from('sales').insert([clean]);
      if (error) throw error;
      return mapSaleFromDB(data?.[0]) || sale;
    },
    update: async (id, updates) => {
      const clean = mapSaleToDB({ ...updates, id });
      const { data, error } = await db.from('sales').update(clean).eq('id', id);
      if (error) throw error;
      return mapSaleFromDB(data?.[0]) || updates;
    },
    delete: async (id) => {
      const { error } = await db.from('sales').delete().eq('id', id);
      if (error) throw error;
    }
  },

  invoices: {
    getAll: async () => {
      const { data, error } = await db.from('invoices').select('*');
      if (error) throw error;
      return (data || []).map(mapInvoiceFromDB);
    },
    getById: async (id) => {
      const { data, error } = await db.from('invoices').select('*').eq('id', id).single();
      if (error) throw error;
      return mapInvoiceFromDB(data);
    },
    create: async (invoice) => {
      const clean = mapInvoiceToDB(invoice);
      const { data, error } = await db.from('invoices').insert([clean]);
      if (error) throw error;
      return mapInvoiceFromDB(data?.[0]) || invoice;
    },
    update: async (id, updates) => {
      const clean = mapInvoiceToDB({ ...updates, id });
      const { data, error } = await db.from('invoices').update(clean).eq('id', id);
      if (error) throw error;
      return mapInvoiceFromDB(data?.[0]) || updates;
    },
    delete: async (id) => {
      const { error } = await db.from('invoices').delete().eq('id', id);
      if (error) throw error;
    }
  }
};

export default api;

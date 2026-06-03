const STORAGE_KEY = 'zsm_crm_leads';

const getStorage = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch (e) {
    console.error('[LeadDB] Error reading:', e);
    return null;
  }
};

const setStorage = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('[LeadDB] Error writing:', e);
    return false;
  }
};

export const initializeLeadsDatabase = (defaultLeads) => {
  const stored = getStorage();
  if (stored) {
    console.log('[LeadDB] Loaded', stored.length, 'leads from storage');
    return stored;
  }
  console.log('[LeadDB] Initializing with default leads');
  setStorage(defaultLeads);
  return defaultLeads;
};

export const getAllLeads = () => getStorage() || [];

export const getLeadById = (id) => {
  const leads = getStorage();
  return leads?.find(l => l.id === id) || null;
};

export const createLeadRecord = (leadData) => {
  const leads = getStorage() || [];
  const newLead = {
    ...leadData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1
  };
  leads.push(newLead);
  setStorage(leads);
  console.log('[LeadDB] Created lead:', newLead.id);
  return newLead;
};

export const updateLeadRecord = (id, leadData) => {
  const leads = getStorage() || [];
  const index = leads.findIndex(l => l.id === id);
  
  if (index === -1) {
    console.warn('[LeadDB] Lead not found, creating dynamic fallback record for:', id);
    const newLead = {
      id,
      ...leadData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    };
    leads.push(newLead);
    setStorage(leads);
    return newLead;
  }
  
  const currentLead = leads[index];
  const updatedLead = {
    ...currentLead,
    ...leadData,
    updatedAt: new Date().toISOString(),
    version: (currentLead.version || 0) + 1
  };
  
  leads[index] = updatedLead;
  setStorage(leads);
  console.log('[LeadDB] Updated lead:', id, 'version:', updatedLead.version);
  
  return updatedLead;
};

export const deleteLeadRecord = (id) => {
  const leads = getStorage() || [];
  const filtered = leads.filter(l => String(l.id) !== String(id));
  setStorage(filtered);
  console.log('[LeadDB] Deleted lead:', id);
  return true;
};

export const bulkDeleteLeadRecords = (ids) => {
  const leads = getStorage() || [];
  const strIds = ids.map(id => String(id));
  const filtered = leads.filter(l => !strIds.includes(String(l.id)));
  setStorage(filtered);
  console.log('[LeadDB] Bulk deleted leads:', ids.length);
  return filtered;
};

export const addLeadRemark = (leadId, text, by) => {
  const leads = getStorage() || [];
  const index = leads.findIndex(l => l.id === leadId);
  
  if (index === -1) return null;
  
  const remark = { text, timestamp: new Date().toISOString(), by };
  leads[index].remarks = [...(leads[index].remarks || []), remark];
  leads[index].lastFollowUp = new Date().toISOString();
  leads[index].updatedAt = new Date().toISOString();
  
  setStorage(leads);
  return leads[index];
};

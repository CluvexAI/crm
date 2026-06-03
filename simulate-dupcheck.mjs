// Simulate exactly what the browser's duplicate check does
// Testing phone +353864067893

const STORAGE_KEY = 'zsm_crm_leads';

// Simulate what's in localStorage (from two different agents)
const mockLocalStorage = JSON.stringify([
  {
    id: 'lead-001',
    contactName: 'Test Person A',
    businessName: 'Business A',
    ownerPhone: '+353864067893',
    email: 'testa@test.com',
    website: 'www.businessA.com',
    status: 'New Lead',
    createdBy: '2eab48d9-b005-4a6b-b1bb-bfb481de316b',  // Agent arshee
    createdByName: 'arshee.khatoon@zsmeservices.com',
    lastFollowUp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }
]);

// Simulate Agent 2 trying to create a lead with same phone
const phone = '+353864067893';
const agentId = '0f8d95b7-e071-4c1a-a1ea-74b5ad632639'; // Agent md.ayan

// --- Replicate apiService checkDuplicate logic exactly ---
const normPhone = (p) => {
  if (!p) return null;
  const digits = String(p).replace(/\D/g, '');
  return digits.length >= 7 ? digits.replace(/^0+/, '') : null;
};

const pNorm = normPhone(phone);
console.log('Input phone normalized:', pNorm);

const localLeads = JSON.parse(mockLocalStorage);
const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

for (const l of localLeads) {
  console.log('\nChecking lead:', l.contactName, '| createdBy:', l.createdBy);
  
  // GATE 1: Skip own leads
  if (String(l.createdBy) === String(agentId)) {
    console.log('  → SKIPPED (own lead)');
    continue;
  }
  
  // GATE 2: Skip closed
  if (l.status === 'Closed (Lost)' || l.status === 'closed_lost') {
    console.log('  → SKIPPED (closed)');
    continue;
  }
  
  // GATE 3: Check 30-day window
  const lastActivity = new Date(l.lastFollowUp || l.createdAt);
  console.log('  → Last activity:', lastActivity.toISOString(), '| Cutoff:', cutoff.toISOString());
  if (lastActivity < cutoff) {
    console.log('  → SKIPPED (outside 30 days)');
    continue;
  }
  
  // Phone match
  const lNorm = normPhone(l.ownerPhone);
  console.log('  → Phone in DB normalized:', lNorm, '| Input:', pNorm);
  
  if (pNorm && lNorm) {
    const exact = lNorm === pNorm;
    const substr1 = lNorm.includes(pNorm);
    const substr2 = pNorm.includes(lNorm);
    console.log('  → Exact match:', exact, '| lNorm.includes(pNorm):', substr1, '| pNorm.includes(lNorm):', substr2);
    
    if (exact || substr1 || substr2) {
      console.log('  ✅ MATCH FOUND — should be blocked!');
    }
  }
}

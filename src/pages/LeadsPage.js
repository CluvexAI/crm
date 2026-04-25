import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BUSINESS_CATEGORIES, LEAD_STATUSES, PROPOSAL_TYPES } from '../data/mockData';
import PhoneInput from '../components/PhoneInput';
import CountryDropdown from '../components/CountryDropdown';
import CurrencyDropdown from '../components/CurrencyDropdown';
import { isValidE164, isSamePhone } from '../services/phoneService';
import { DEFAULT_COUNTRY } from '../services/countryService';
import { BASE_CURRENCY, convertCurrency, formatCurrencyAmount } from '../services/currencyService';

const LeadForm = ({ lead, onClose, onSave }) => {
  const { checkPhoneDuplicate } = useApp();
  const [form, setForm] = useState(lead || {
    contactName: '', businessName: '', ownerPhone: '', altPhone: '',
    website: '', address: '', county: '', email: '',
    businessCategory: '', proposalType: '', city: lead?.city || lead?.targetArea || '', companyType: '',
    followUpResult: '', status: 'New Lead',
    countryName: 'Ireland', countryCode: 'IE', dialCode: '+353',
  });
  const [errors, setErrors] = useState({});
  const [phoneWarning, setPhoneWarning] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(
    lead?.countryCode ? { code: lead.countryCode, dialCode: lead.dialCode, name: lead.countryName } : DEFAULT_COUNTRY
  );

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handlePhoneBlur = () => {
    if (!form.ownerPhone) return;
    const result = checkPhoneDuplicate(form.ownerPhone, lead?.id);
    if (result.isDuplicate) {
      setPhoneWarning(result);
    } else {
      setPhoneWarning(null);
    }
  };

  const validateAltPhone = () => {
    if (!form.altPhone) return null;

    if (!isValidE164(form.altPhone)) {
      return 'Invalid international phone format (use country code)';
    }

    if (isSamePhone(form.altPhone, form.ownerPhone)) {
      return 'Alternate phone cannot be same as primary phone';
    }

    return null;
  };

  const validate = () => {
    const errs = {};
    if (!form.contactName) errs.contactName = 'Contact name required';
    if (!form.businessName) errs.businessName = 'Business name required';
    if (!form.ownerPhone) errs.ownerPhone = 'Phone number required';
    if (phoneWarning?.blocked) errs.ownerPhone = `Lead with this phone contacted ${phoneWarning.daysSince} days ago (<30 days). Blocked.`;
    if (!form.businessCategory) errs.businessCategory = 'Category required';
    if (!form.city) errs.city = 'City required';

    const altPhoneError = validateAltPhone();
    if (altPhoneError) errs.altPhone = altPhoneError;

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) onSave(form);
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-title">
            {lead ? '✏️ Edit Lead' : '➕ Add New Lead'}
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Contact Name <span className="required">*</span></label>
                <input className="form-control" value={form.contactName} onChange={e => handleChange('contactName', e.target.value)} placeholder="Full name" />
                {errors.contactName && <div className="form-error">{errors.contactName}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Business Name <span className="required">*</span></label>
                <input className="form-control" value={form.businessName} onChange={e => handleChange('businessName', e.target.value)} placeholder="Company name" />
                {errors.businessName && <div className="form-error">{errors.businessName}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Owner Phone <span className="required">*</span></label>
                <PhoneInput
                  value={form.ownerPhone}
                  onChange={(value) => handleChange('ownerPhone', value)}
                  onBlur={handlePhoneBlur}
                  error={errors.ownerPhone}
                  required
                  defaultCountry={selectedCountry}
                />
                {phoneWarning && !phoneWarning.blocked && (
                  <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 4, fontWeight: 500 }}>
                    ⚠️ Phone exists (last contacted {phoneWarning.daysSince} days ago – allowed)
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Alternate Phone</label>
                <PhoneInput
                  value={form.altPhone}
                  onChange={(value) => handleChange('altPhone', value)}
                  placeholder="Optional alternate number"
                  defaultCountry={selectedCountry}
                />
                {errors.altPhone && <div className="form-error">{errors.altPhone}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-control" type="email" value={form.email} onChange={e => handleChange('email', e.target.value)} placeholder="email@domain.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Website</label>
                <input className="form-control" value={form.website} onChange={e => handleChange('website', e.target.value)} placeholder="www.example.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Business Category <span className="required">*</span></label>
                <select className="form-control" value={form.businessCategory} onChange={e => handleChange('businessCategory', e.target.value)}>
                  <option value="">Select category</option>
                  {BUSINESS_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                {errors.businessCategory && <div className="form-error">{errors.businessCategory}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Company Type</label>
                <select className="form-control" value={form.companyType} onChange={e => handleChange('companyType', e.target.value)}>
                  <option value="">Select type</option>
                  {['Proprietorship', 'Partnership', 'Private Ltd', 'LLP', 'Public Ltd', 'Trust', 'NGO'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <CountryDropdown
                  value={{ countryCode: form.countryCode, countryName: form.countryName }}
                  onChange={(countryData) => {
                    handleChange('countryName', countryData.countryName);
                    handleChange('countryCode', countryData.countryCode);
                    handleChange('dialCode', countryData.dialCode);
                  }}
                  onCountryChange={(country) => setSelectedCountry(country)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">County / State</label>
                <input className="form-control" value={form.county} onChange={e => handleChange('county', e.target.value)} placeholder="State/Region" />
              </div>
              <div className="form-group">
                <label className="form-label">City <span className="required">*</span></label>
                <input className="form-control" value={form.city} onChange={e => handleChange('city', e.target.value)} placeholder="City / Area" />
                {errors.city && <div className="form-error">{errors.city}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Proposal Type</label>
                <select className="form-control" value={form.proposalType} onChange={e => handleChange('proposalType', e.target.value)}>
                  <option value="">Select proposal</option>
                  {PROPOSAL_TYPES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Address</label>
                <input className="form-control" value={form.address} onChange={e => handleChange('address', e.target.value)} placeholder="Full address" />
              </div>
              <div className="form-group">
                <label className="form-label">Follow-Up Result</label>
                <input className="form-control" value={form.followUpResult} onChange={e => handleChange('followUpResult', e.target.value)} placeholder="E.g. Interested, Callback, Not interested" />
              </div>
              {lead && (
                <div className="form-group">
                  <label className="form-label">Lead Status</label>
                  <select className="form-control" value={form.status} onChange={e => handleChange('status', e.target.value)}>
                    {LEAD_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">
              {lead ? '💾 Save Changes' : '➕ Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const RemarkModal = ({ lead, onClose }) => {
  const { addRemark } = useApp();
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    addRemark(lead.id, text);
    setText('');
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-sm">
        <div className="modal-header">
          <div className="modal-title">💬 Add Remark — {lead.businessName}</div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: 16, maxHeight: 200, overflowY: 'auto' }}>
            {lead.remarks?.map((r, i) => (
              <div key={i} style={{ padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 13 }}>{r.text}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {r.by} · {new Date(r.timestamp).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
            {(!lead.remarks || lead.remarks.length === 0) && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>No remarks yet</div>
            )}
          </div>
          <form onSubmit={handleSubmit}>
            <textarea className="form-control" value={text} onChange={e => setText(e.target.value)} placeholder="Write your remark..." rows={3} required />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary">Add Remark</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const LeadsPage = () => {
  const { currentUser, myLeads, allLeads, createLead, updateLead, createSale, bulkDeleteLeads, rbac } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [remarkLead, setRemarkLead] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showConvertModal, setShowConvertModal] = useState(null);
  const [selectedLeads, setSelectedLeads] = useState([]);

  const isAdmin = currentUser.role === 'Admin';
  const canDelete = rbac.can('DELETE_LEAD');
  const leads = isAdmin ? allLeads : myLeads;

  const filtered = leads.filter(l => {
    const matchSearch = !search || l.contactName.toLowerCase().includes(search.toLowerCase()) || l.businessName.toLowerCase().includes(search.toLowerCase()) || l.ownerPhone.includes(search);
    const matchStatus = statusFilter === 'All' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleSave = (form) => {
    if (editLead) {
      updateLead(editLead.id, form);
      setEditLead(null);
    } else {
      createLead(form);
    }
    setShowForm(false);
  };

  const toggleSelectLead = (id) => {
    setSelectedLeads(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkDelete = () => {
    if (selectedLeads.length === 0) return;
    try {
      bulkDeleteLeads(selectedLeads);
      setSelectedLeads([]);
    } catch (error) {
      console.error(error);
      window.alert(error.message || "Failed to delete leads");
    }
  };

  const statusColor = (s) => {
    const map = {
      'New Lead': 'badge-info', 'Follow-Up': 'badge-warning', 'Pending': 'badge-secondary',
      'Closed (Won)': 'badge-success', 'Closed (Lost)': 'badge-danger', 'Expired': 'badge-neutral',
    };
    return map[s] || 'badge-neutral';
  };

  const daysSince = (date) => Math.floor((new Date() - new Date(date)) / (1000 * 60 * 60 * 24));

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="toolbar">
        <div className="search-bar">
          🔍 <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..." />
        </div>
        <select className="form-control" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option>All</option>
          {['New Lead', 'Follow-Up', 'Pending', 'Closed (Won)', 'Closed (Lost)', 'Expired'].map(s => <option key={s}>{s}</option>)}
        </select>
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={() => { setEditLead(null); setShowForm(true); }}>
            + Add Lead
          </button>
        </div>
      </div>

      {/* Summary Chips */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {['New Lead', 'Follow-Up', 'Pending', 'Closed (Won)', 'Closed (Lost)'].map(s => {
          const count = leads.filter(l => l.status === s).length;
          return (
            <button key={s} onClick={() => setStatusFilter(s === statusFilter ? 'All' : s)}
              className={`badge ${statusColor(s)}`}
              style={{ cursor: 'pointer', border: 'none', padding: '6px 14px', fontSize: 12 }}>
              {s}: {count}
            </button>
          );
        })}
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="card-title">📞 Lead Management ({filtered.length})</div>
          {selectedLeads.length > 0 && (
            <button
              className="btn btn-danger btn-sm"
              onClick={handleBulkDelete}
            >
              Delete Selected
            </button>
          )}
        </div>
        <div className="table-container">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-title">No leads found</div>
              <div className="empty-state-text">Try adjusting your filters or add a new lead.</div>
              <button className="btn btn-primary" onClick={() => setShowForm(true)}>Add First Lead</button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedLeads.length === filtered.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedLeads(filtered.map(l => l.id));
                        else setSelectedLeads([]);
                      }}
                    />
                  </th>
                  <th>#</th>
                  <th>Contact / Business</th>
                  <th>Phone</th>
                  <th>Category</th>
                  <th>Proposal</th>
                  <th>Status</th>
                  <th>Last Activity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead, idx) => {
                  const days = daysSince(lead.lastFollowUp);
                  const isExpiringSoon = days >= 25 && days < 30;
                  const isExpired = days >= 30 && !['Closed (Won)', 'Closed (Lost)'].includes(lead.status);
                  return (
                    <tr key={lead.id} style={{ background: isExpiringSoon ? 'rgba(245,158,11,0.04)' : isExpired ? 'rgba(239,68,68,0.04)' : '' }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedLeads.includes(lead.id)}
                          onChange={() => toggleSelectLead(lead.id)}
                        />
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{lead.contactName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lead.businessName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>✉️ {lead.email || 'No email'}</div>
                        {(lead.city || lead.targetArea) && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>📍 {lead.city || lead.targetArea}</div>}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 13 }}>
                        {lead.ownerPhone}
                        {lead.altPhone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lead.altPhone}</div>}
                      </td>
                      <td><span className="badge badge-neutral">{lead.businessCategory}</span></td>
                      <td>
                        {lead.proposalType ? (
                          <span className="badge badge-primary" style={{ fontSize: 11 }}>{lead.proposalType}</span>
                        ) : '—'}
                      </td>
                      <td>
                        <span className={`badge ${statusColor(lead.status)}`}>{lead.status}</span>
                        {isExpired && <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 2 }}>⚠ {days}d no activity</div>}
                        {isExpiringSoon && <div style={{ fontSize: 10, color: 'var(--warning)', marginTop: 2 }}>⏰ Expiring soon</div>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {days === 0 ? 'Today' : `${days}d ago`}
                        <div style={{ fontSize: 11 }}>{lead.remarks?.length || 0} remarks</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-sm btn-outline" title="Edit" onClick={() => { setEditLead(lead); setShowForm(true); }}>✏️</button>
                          <button className="btn btn-sm btn-ghost" title="Remarks" onClick={() => setRemarkLead(lead)}>💬</button>
                          {lead.status !== 'Closed (Won)' && (
                            <button className="btn btn-sm btn-success" title="Convert to Sale" onClick={() => setShowConvertModal(lead)} style={{ fontSize: 11 }}>Convert</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {(showForm || editLead) && (
        <LeadForm lead={editLead} onClose={() => { setShowForm(false); setEditLead(null); }} onSave={handleSave} />
      )}
      {remarkLead && <RemarkModal lead={remarkLead} onClose={() => setRemarkLead(null)} />}

      {showConvertModal && (
        <ConvertToSaleModal
          lead={showConvertModal}
          onClose={() => setShowConvertModal(null)}
          onConvert={(saleData) => {
            createSale(saleData);
            updateLead(showConvertModal.id, { status: 'Closed (Won)' });
            setShowConvertModal(null);
          }}
        />
      )}
    </div>
  );
};

const ConvertToSaleModal = ({ lead, onClose, onConvert }) => {
  const { currentUser } = useApp();
  const [currency, setCurrency] = useState({ code: 'USD', symbol: '$', name: 'US Dollar' });
  const [proposals, setProposals] = useState([
    { type: lead.proposalType || '', package: '', description: '', amount: '' }
  ]);
  const [form, setForm] = useState({
    leadId: lead.id, leadName: lead.contactName, businessName: lead.businessName,
    email: lead.email || '', ownerPhone: lead.ownerPhone || '',
    addressLine1: lead.address || '',
    city: lead.city || lead.targetArea || '',
    state: lead.county || '',
    country: lead.countryName || '',
    countryCode: lead.countryCode || 'IE',
    dialCode: lead.dialCode || '+353',
    closedBy: currentUser.id, closedByName: currentUser.name,
    saleStatus: 'Closed', paymentStatus: 'Full Payment',
    invoiceStatus: 'Generated', installments: 1, paidInstallments: 0,
    currencyCode: 'USD',
  });

  const handleCurrencyChange = (curr) => {
    setCurrency(curr);
    setForm(p => ({ ...p, currencyCode: curr?.code || 'USD' }));
  };

  const updateProposal = (index, field, value) => {
    const newProposals = [...proposals];
    newProposals[index][field] = value;
    setProposals(newProposals);
  };

  const addProposal = () => {
    setProposals([...proposals, { type: '', package: '', description: '', amount: '' }]);
  };

  const removeProposal = (index) => {
    setProposals(proposals.filter((_, i) => i !== index));
  };

  const totalSaleAmount = proposals.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.email) {
      window.alert("Email is required to convert to sale.");
      throw new Error("Email is required to convert to sale");
    }
    if (!form.country) {
      window.alert("Country is required for billing.");
      throw new Error("Country is required for billing");
    }
    if (proposals.length === 0) {
      window.alert("At least one proposal is required");
      throw new Error("At least one proposal is required");
    }

    const finalProposals = proposals.map(p => ({
      ...p,
      amount: Number(p.amount || 0),
    }));

    onConvert({
      ...form,
      proposalType: proposals[0].type, // legacy fallback
      amount: totalSaleAmount,
      totalAmount: Number(totalSaleAmount.toFixed(2)),
      currency: 'EUR',
      proposals: finalProposals,
    });
  };

  const convertedAmount = convertCurrency(totalSaleAmount, currency.code, BASE_CURRENCY);

  return (
    <div className="modal-overlay">
      <div className="modal modal-sm">
        <div className="modal-header">
          <div className="modal-title">💰 Convert to Sale</div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Verify Client Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600 }}>Business Name</label>
                  <input className="form-control" value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600 }}>Contact Name</label>
                  <input className="form-control" value={form.leadName} onChange={e => setForm({ ...form, leadName: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600 }}>Email *</label>
                  <input className="form-control" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600 }}>Phone</label>
                  <input className="form-control" value={form.ownerPhone} onChange={e => setForm({ ...form, ownerPhone: e.target.value })} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 11, fontWeight: 600 }}>Address Line 1</label>
                  <input className="form-control" value={form.addressLine1} onChange={e => setForm({ ...form, addressLine1: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600 }}>City</label>
                  <input className="form-control" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600 }}>State / County</label>
                  <input className="form-control" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 11, fontWeight: 600 }}>Country *</label>
                  <input className="form-control" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} required />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h5 style={{ margin: 0, fontSize: 13 }}>💼 Proposals</h5>
              <button type="button" className="btn btn-sm btn-outline" onClick={addProposal}>+ Add</button>
            </div>

            <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 16 }}>
              {proposals.map((p, index) => (
                <div key={index} style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, marginBottom: 8, position: 'relative' }}>
                  {proposals.length > 1 && (
                    <button type="button" onClick={() => removeProposal(index)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16 }}>×</button>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600 }}>Proposal Type *</label>
                      <input className="form-control" placeholder="e.g. Website Design" value={p.type} onChange={(e) => updateProposal(index, "type", e.target.value)} required />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600 }}>Package</label>
                      <input className="form-control" placeholder="e.g. Premium" value={p.package} onChange={(e) => updateProposal(index, "package", e.target.value)} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600 }}>Description</label>
                      <input className="form-control" placeholder="Short description" value={p.description} onChange={(e) => updateProposal(index, "description", e.target.value)} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600 }}>Amount *</label>
                      <input className="form-control" type="number" min="0" placeholder="0" value={p.amount} onChange={(e) => updateProposal(index, "amount", e.target.value)} required />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--bg-primary)', padding: 16, borderRadius: 8, marginBottom: 16, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid var(--border-light)', paddingBottom: 8 }}>
                <strong style={{ fontSize: 13 }}>Proposal Summary:</strong>
                <CurrencyDropdown value={currency} onChange={handleCurrencyChange} />
              </div>
              {proposals.map((p, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span>{p.type || 'Unnamed'} {p.package ? `– ${p.package}` : ''}</span>
                  <span style={{ fontWeight: 600 }}>{currency.symbol}{Number(p.amount || 0).toLocaleString()}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '2px dashed var(--border-color)', fontWeight: 'bold', fontSize: 16 }}>
                <span>TOTAL:</span>
                <span style={{ color: 'var(--primary)' }}>{currency.symbol}{totalSaleAmount.toLocaleString()}</span>
              </div>
              {totalSaleAmount > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                  ≈ {formatCurrencyAmount(convertedAmount, BASE_CURRENCY)} USD
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Payment Type</label>
              <select className="form-control" value={form.paymentStatus} onChange={e => setForm(p => ({ ...p, paymentStatus: e.target.value }))}>
                <option>Full Payment</option>
                <option>Installments</option>
              </select>
            </div>
            {form.paymentStatus === 'Installments' && (
              <div className="form-group">
                <label className="form-label">Number of Installments (1–12)</label>
                <input className="form-control" type="number" min={1} max={12} value={form.installments} onChange={e => setForm(p => ({ ...p, installments: parseInt(e.target.value) }))} />
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-success">✅ Convert to Sale</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LeadsPage;

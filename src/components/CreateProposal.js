import React, { useState, useEffect } from 'react';
import { 
  EMAIL_TEMPLATES, 
  SERVICES, 
  getSignature, 
  MERGE_TAGS, 
  replaceMergeTags,
  calculateProposalTotal,
  generateProposalHTML,
  generateProposalText
} from '../services/proposalService';
import { BASE_CURRENCY, formatCurrencyAmount } from '../services/currencyService';
import { useApp } from '../context/AppContext';
import RichTextEditor from './RichTextEditor';

const CreateProposal = ({ lead, onClose, onSave }) => {
  const { currentUser } = useApp();
  
  const [selectedTemplate, setSelectedTemplate] = useState('new_proposal');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const [proposalTitle, setProposalTitle] = useState('');
  const [validUntil, setValidUntil] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
  });
  
  const [clientName] = useState(lead?.contactName || '');
  const [businessName] = useState(lead?.businessName || '');
  const [items, setItems] = useState(() => {
    if (lead?.proposalType) {
      const service = SERVICES.find(s => s.id === lead.proposalType?.toLowerCase().replace(' ', '')) || SERVICES[0];
      return [{ ...service, quantity: 1, total: service.basePrice }];
    }
    return [{ ...SERVICES[0], quantity: 1, total: SERVICES[0].basePrice }];
  });
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(18);
  
  const agentName = currentUser?.name || 'Sales Agent';
  const agentPhone = currentUser?.phone || '+91 98765 43210';
  const agentEmail = currentUser?.email || 'info@zsmeservices.com';
  const companyName = 'ZSM Services';

  const totals = calculateProposalTotal(items, discount);

  useEffect(() => {
    loadTemplate(selectedTemplate);
  }, []);

  const loadTemplate = (templateId) => {
    const template = EMAIL_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      const mergedSubject = replaceMergeTags(template.subject, {
        clientName: lead?.contactName || '',
        businessName: lead?.businessName || '',
        agentName,
        companyName
      });
      setEmailSubject(mergedSubject);
      setProposalTitle(`${template.name} - ${lead?.businessName || 'Proposal'}`);
      
      let body = replaceMergeTags(template.body, {
        clientName: lead?.contactName || '',
        businessName: lead?.businessName || '',
        agentName,
        companyName
      });
      body += getSignature(agentName, agentPhone, agentEmail, companyName);
      setEmailBody(body);
    }
  };

  const handleTemplateChange = (e) => {
    const templateId = e.target.value;
    setSelectedTemplate(templateId);
    loadTemplate(templateId);
  };

  const handleResetTemplate = () => {
    loadTemplate(selectedTemplate);
  };

  const handleInsertSignature = () => {
    const signature = getSignature(agentName, agentPhone, agentEmail, companyName);
    setEmailBody(prev => prev + signature);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'basePrice') {
      newItems[index].total = (newItems[index].quantity || 1) * (newItems[index].basePrice || 0);
    }
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { ...SERVICES[0], quantity: 1, total: SERVICES[0].basePrice }]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const formatCurrency = (n) => formatCurrencyAmount(n || 0, BASE_CURRENCY);

  const calculatedTotal = totals.subtotal - totals.discount + ((totals.subtotal - totals.discount) * taxPercent / 100);

  const handleSaveDraft = async () => {
    const proposalData = {
      leadId: lead?.id,
      clientName,
      businessName,
      items,
      notes,
      discount,
      taxPercent,
      proposalTitle,
      validUntil,
      emailSubject,
      emailBody,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
    
    if (onSave) {
      onSave(proposalData);
    }
    window.alert('Proposal saved as draft!');
    onClose();
  };

  const handleSend = async () => {
    if (!lead?.email) {
      window.alert('No email address for this lead.');
      return;
    }
    
    const emailConfig = currentUser?.emailConfig;
    if (!emailConfig?.email) {
      window.alert('Please configure your email in Profile → Email Settings first.');
      return;
    }
    
    setIsSending(true);
    try {
      const proposalId = `prop_${Date.now()}`;
      const token = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const baseUrl = window.location.origin;
      
      const proposal = {
        id: proposalId,
        items,
        notes,
        discount,
        clientName,
        businessName,
        currency: BASE_CURRENCY,
        acceptUrl: `${baseUrl}/proposal/accept/${token}`,
        rejectUrl: `${baseUrl}/proposal/reject/${token}`,
      };

      generateProposalHTML(proposal, businessName, clientName);
      generateProposalText(proposal, businessName, clientName);
      const subject = emailSubject || `Proposal for ${businessName}`;

      console.log('Sending proposal email:', { to: lead.email, subject });
      console.log('Email body:', emailBody);

      if (onSave) {
        onSave({
          id: proposalId,
          leadId: lead?.id,
          clientName,
          businessName,
          items,
          notes,
          discount,
          taxPercent,
          proposalTitle,
          validUntil,
          emailSubject: subject,
          emailBody,
          total: calculatedTotal,
          currency: BASE_CURRENCY,
          status: 'sent',
          token,
          sentAt: new Date().toISOString(),
          fromEmail: emailConfig?.email,
        });
      }

      window.alert('Proposal sent successfully!');
      onClose();
    } catch (error) {
      window.alert('Failed to send proposal: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const renderMergeTags = () => (
    <div style={{ marginTop: 10, marginBottom: 15 }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Merge Tags:</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {MERGE_TAGS.map(({ tag, label }) => (
          <button
            key={tag}
            type="button"
            className="btn btn-sm"
            style={{ 
              background: '#e3f2fd', 
              color: '#1565c0',
              fontSize: 11,
              padding: '4px 8px'
            }}
            onClick={() => {
              const newBody = emailBody + tag;
              setEmailBody(newBody);
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="modal" style={{ background: 'white', borderRadius: 12, width: '98%', maxWidth: 1100, maxHeight: '95vh', overflow: 'auto' }}>
        <div className="modal-header" style={{ padding: 20, borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>📄 Create Proposal</h2>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 1. CLIENT INFORMATION CARD - Top */}
          <div className="card" style={{ background: 'var(--bg-secondary)', padding: 20 }}>
            <h4 style={{ margin: '0 0 15px', display: 'flex', alignItems: 'center', gap: 8 }}>
              👤 Client Information
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 15 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 12, color: 'var(--text-muted)' }}>Business Name</label>
                <div style={{ padding: '8px 12px', background: 'white', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                  {lead?.businessName || '—'}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 12, color: 'var(--text-muted)' }}>Contact Name</label>
                <div style={{ padding: '8px 12px', background: 'white', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                  {lead?.contactName || '—'}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 12, color: 'var(--text-muted)' }}>Email</label>
                <div style={{ padding: '8px 12px', background: 'white', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                  {lead?.email || '—'}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 12, color: 'var(--text-muted)' }}>Phone</label>
                <div style={{ padding: '8px 12px', background: 'white', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                  {lead?.ownerPhone || '—'}
                </div>
              </div>
            </div>
          </div>

          {/* 2. PROPOSAL DETAILS CARD */}
          <div className="card" style={{ background: 'var(--bg-secondary)', padding: 20 }}>
            <h4 style={{ margin: '0 0 15px', display: 'flex', alignItems: 'center', gap: 8 }}>
              📋 Proposal Details
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 12, color: 'var(--text-muted)' }}>Proposal Title</label>
                <input
                  type="text"
                  className="form-control"
                  value={proposalTitle}
                  onChange={(e) => setProposalTitle(e.target.value)}
                  placeholder="Enter proposal title..."
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 12, color: 'var(--text-muted)' }}>Valid Until</label>
                <input
                  type="date"
                  className="form-control"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 12, color: 'var(--text-muted)' }}>Email Template</label>
                <select 
                  className="form-control" 
                  value={selectedTemplate}
                  onChange={handleTemplateChange}
                >
                  {EMAIL_TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={handleResetTemplate}>
                  🔄 Reset
                </button>
                <button className="btn btn-primary" onClick={handleInsertSignature}>
                  ✍️ Signature
                </button>
              </div>
            </div>
          </div>

          {/* 3. EMAIL BODY CARD */}
          <div className="card" style={{ background: 'var(--bg-secondary)', padding: 20 }}>
            <h4 style={{ margin: '0 0 15px', display: 'flex', alignItems: 'center', gap: 8 }}>
              📧 Email Body
            </h4>
            <div style={{ marginBottom: 15 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>📝 Subject</label>
              <input
                type="text"
                className="form-control"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Enter email subject..."
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Email Content</label>
              <RichTextEditor 
                value={emailBody} 
                onChange={setEmailBody}
                placeholder="Compose your email..."
              />
              {renderMergeTags()}
            </div>
          </div>

          {/* 4. QUOTATION CARD */}
          <div className="card" style={{ background: 'var(--bg-secondary)', padding: 20 }}>
            <h4 style={{ margin: '0 0 15px', display: 'flex', alignItems: 'center', gap: 8 }}>
              💰 Quotation
            </h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 15 }}>
              <thead>
                <tr style={{ background: 'var(--primary)', color: 'white' }}>
                  <th style={{ padding: 10, textAlign: 'left', fontSize: 12 }}>Service</th>
                  <th style={{ padding: 10, width: 50, textAlign: 'center', fontSize: 12 }}>Qty</th>
                  <th style={{ padding: 10, width: 80, textAlign: 'right', fontSize: 12 }}>Price</th>
                  <th style={{ padding: 10, width: 80, textAlign: 'right', fontSize: 12 }}>Total</th>
                  <th style={{ padding: 10, width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: 8 }}>
                      <select
                        className="form-control"
                        style={{ fontSize: 12 }}
                        value={item.id}
                        onChange={(e) => {
                          const service = SERVICES.find(s => s.id === e.target.value);
                          updateItem(index, 'id', service.id);
                          updateItem(index, 'name', service.name);
                          updateItem(index, 'basePrice', service.basePrice);
                          updateItem(index, 'total', service.basePrice * item.quantity);
                        }}
                      >
                        {SERVICES.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: 8 }}>
                      <input
                        type="number"
                        className="form-control"
                        style={{ textAlign: 'center', fontSize: 12 }}
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                      />
                    </td>
                    <td style={{ padding: 8 }}>
                      <input
                        type="number"
                        className="form-control"
                        style={{ textAlign: 'right', fontSize: 12 }}
                        value={item.basePrice}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0) {
                            updateItem(index, 'basePrice', val);
                          }
                        }}
                      />
                    </td>
                    <td style={{ padding: 8, fontWeight: 600, color: 'var(--primary)', textAlign: 'right', fontSize: 12 }}>
                      {formatCurrency(item.total)}
                    </td>
                    <td style={{ padding: 8 }}>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                        style={{ padding: 2 }}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-ghost" onClick={addItem} style={{ marginBottom: 15 }}>
              + Add Service
            </button>

            <div style={{ display: 'flex', gap: 15 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 11, fontWeight: 600 }}>🏷️ Discount (%)</label>
                <input
                  type="number"
                  className="form-control"
                  style={{ fontSize: 12 }}
                  min="0"
                  max="100"
                  value={discount}
                  onChange={(e) => setDiscount(parseInt(e.target.value) || 0)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 11, fontWeight: 600 }}>📊 Tax (%)</label>
                <input
                  type="number"
                  className="form-control"
                  style={{ fontSize: 12 }}
                  min="0"
                  max="100"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div style={{ flex: 2 }}>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 11, fontWeight: 600 }}>📝 Notes</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: 12 }}
                  placeholder="Additional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="card" style={{ marginTop: 15, background: 'var(--primary)', color: 'white', padding: 15 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12 }}>
                  <div>Subtotal: <strong>{formatCurrency(totals.subtotal)}</strong></div>
                  {discount > 0 && (
                    <div>Discount ({discount}%): <strong>-{formatCurrency(totals.discount)}</strong></div>
                  )}
                  <div>Tax ({taxPercent}%): <strong>{formatCurrency((totals.subtotal - totals.discount) * taxPercent / 100)}</strong></div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  Total: {formatCurrency(calculatedTotal)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ padding: 20, borderTop: '1px solid var(--border-color)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-ghost" onClick={handleSaveDraft}>
            💾 Save Draft
          </button>
          <button className="btn btn-primary" onClick={() => setShowPreview(true)}>
            👁 Preview
          </button>
          <button className="btn btn-primary" onClick={handleSend} disabled={isSending}>
            {isSending ? '⏳ Sending...' : '📤 Send Proposal'}
          </button>
        </div>
      </div>

      {showPreview && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }} onClick={() => setShowPreview(false)}>
          <div className="modal" style={{ background: 'white', borderRadius: 12, width: '95%', maxWidth: 800, maxHeight: '85vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: 20, borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>📧 Proposal Preview</h3>
              <button className="btn btn-ghost" onClick={() => setShowPreview(false)}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 20, padding: 15, background: '#f8f9fa', borderRadius: 8 }}>
                <div style={{ marginBottom: 8 }}><strong>Subject:</strong> {emailSubject || `Proposal for ${businessName}`}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>To: {lead?.email}</div>
              </div>
              
              <div 
                style={{ 
                  padding: 20, 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 8,
                  minHeight: 150,
                  marginBottom: 20
                }}
                dangerouslySetInnerHTML={{ __html: emailBody }}
              />

              <div style={{ marginBottom: 20 }}>
                <h4 style={{ marginBottom: 10 }}>Client: {businessName} - {clientName}</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--primary)', color: 'white' }}>
                      <th style={{ padding: 10, textAlign: 'left', fontSize: 12 }}>Service</th>
                      <th style={{ padding: 10, textAlign: 'center', fontSize: 12 }}>Qty</th>
                      <th style={{ padding: 10, textAlign: 'right', fontSize: 12 }}>Price</th>
                      <th style={{ padding: 10, textAlign: 'right', fontSize: 12 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: 10, fontSize: 12 }}>{item.name}</td>
                        <td style={{ padding: 10, textAlign: 'center', fontSize: 12 }}>{item.quantity}</td>
                        <td style={{ padding: 10, textAlign: 'right', fontSize: 12 }}>{formatCurrency(item.basePrice)}</td>
                        <td style={{ padding: 10, textAlign: 'right', fontWeight: 600, fontSize: 12 }}>{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div style={{ 
                background: 'var(--primary)', 
                color: 'white', 
                padding: 20, 
                borderRadius: 8,
                textAlign: 'right'
              }}>
                <div style={{ fontSize: 13 }}>Subtotal: {formatCurrency(totals.subtotal)}</div>
                {discount > 0 && <div style={{ fontSize: 13 }}>Discount ({discount}%): -{formatCurrency(totals.discount)}</div>}
                <div style={{ fontSize: 13 }}>Tax ({taxPercent}%): {formatCurrency((totals.subtotal - totals.discount) * taxPercent / 100)}</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 10 }}>
                  Total: {formatCurrency(calculatedTotal)}
                </div>
              </div>
              
              {notes && (
                <div style={{ marginTop: 20, padding: 15, background: '#fff3cd', borderRadius: 8, borderLeft: '4px solid #ffc107' }}>
                  <strong>Notes:</strong> {notes}
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ padding: 20, borderTop: '1px solid var(--border-color)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowPreview(false)}>Close</button>
              <button className="btn btn-primary" onClick={handleSend} disabled={isSending}>
                {isSending ? '⏳ Sending...' : '📤 Send Proposal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateProposal;

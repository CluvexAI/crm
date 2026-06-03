import React, { useState } from 'react';
import { SERVICES, generateProposalHTML, generateProposalText, sendProposalEmail, generateToken, calculateProposalTotal } from '../services/proposalService';
import { BASE_CURRENCY, formatCurrencyAmount } from '../services/currencyService';
import { useApp } from '../context/AppContext';

const ProposalBuilder = ({ lead, onClose, onSend }) => {
  const { currentUser, sendEmail } = useApp();
  const [alertModal, setAlertModal] = useState(null);
  const [clientName, setClientName] = useState(lead?.contactName || '');
  const [businessName, setBusinessName] = useState(lead?.businessName || '');
  const [items, setItems] = useState(() => {
    if (lead?.proposalType) {
      const type = lead.proposalType.toLowerCase();
      const service = SERVICES.find(s => 
        s.id === type || 
        s.name.toLowerCase() === type || 
        s.id === type.replace(/\s+/g, '') ||
        type.includes(s.id)
      ) || SERVICES[0];
      return [{ ...service, quantity: 1, total: service.basePrice }];
    }
    return [{ ...SERVICES[0], quantity: 1, total: SERVICES[0].basePrice }];
  });
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isEditing, setIsEditing] = useState(true);

  const totals = calculateProposalTotal(items, discount);

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    if (typeof field === 'object' && field !== null) {
      newItems[index] = { ...newItems[index], ...field };
      if ('quantity' in field || 'basePrice' in field) {
        newItems[index].total = (newItems[index].quantity || 1) * (newItems[index].basePrice || 0);
      }
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
      if (field === 'quantity' || field === 'basePrice') {
        newItems[index].total = (newItems[index].quantity || 1) * (newItems[index].basePrice || 0);
      }
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

  const handleSend = async () => {
    if (!lead?.email) {
      setAlertModal({ title: '⚠️ Missing Email', message: 'No email address for this lead.' });
      return;
    }

    const safeItems = Array.isArray(items) ? items : Object.values(items || {});
    if (safeItems.length === 0) {
      setAlertModal({ title: '⚠️ No Items', message: 'Please add at least one item to the proposal before sending.' });
      return;
    }
    
    let emailConfig = null;
    try {
      const { getEmailByUserId } = await import('../services/emailService');
      const uid = currentUser?.uuid || currentUser?.id;
      const accounts = getEmailByUserId(uid, currentUser?.email);
      emailConfig = accounts && accounts.length > 0 ? accounts[0] : null;
    } catch (e) {
      console.error('Failed to get email config:', e);
    }
    
    if (!emailConfig?.email) {
      setAlertModal({ title: '⚠️ Email Not Configured', message: 'Please configure your email in Profile → Email Settings first.' });
      return;
    }
    
    setIsSending(true);
    try {
      const proposalId = `prop_${Date.now()}`;
      const token = generateToken();
      const baseUrl = window.location.origin;
      
      const validUntilDate = new Date();
      validUntilDate.setDate(validUntilDate.getDate() + 30);
      const validUntilFormatted = validUntilDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      const proposal = {
        id: proposalId,
        items: safeItems,
        notes,
        discount,
        clientName,
        businessName,
        title: `Proposal for ${businessName}`,
        validUntil: validUntilFormatted,
        companyName: 'ZSM Services',
        senderName: currentUser?.name || 'ZSM CRM User',
        senderEmail: emailConfig?.email || currentUser?.email || 'info@zsmservices.com',
        senderPhone: currentUser?.phone || '',
        currency: BASE_CURRENCY,
        acceptUrl: `${baseUrl}/proposal/accept/${token}`,
        rejectUrl: `${baseUrl}/proposal/reject/${token}`,
      };

      const html = generateProposalHTML(proposal, safeItems, totals);
      const text = generateProposalText(proposal, safeItems, totals);
      const subject = `Proposal for ${businessName}`;

      const isUsingUserEmail = true;
      if (isUsingUserEmail && sendEmail) {
        sendEmail({
          to: lead.email,
          subject,
          html,
          text
        });
      } else {
        await sendProposalEmail(lead.email, subject, html);
      }

      if (onSend) {
        onSend({
          id: proposalId,
          leadId: lead.id,
          items: safeItems,
          notes,
          discount,
          clientName,
          businessName,
          total: totals.total,
          currency: BASE_CURRENCY,
          status: 'sent',
          token,
          sentAt: new Date().toISOString(),
          fromEmail: emailConfig.email,
        });
      }

      setAlertModal({ title: '✅ Sent', message: 'Proposal sent successfully!' });
      onClose();
    } catch (error) {
      setAlertModal({ title: '❌ Send Failed', message: 'Failed to send proposal: ' + error.message });
    } finally {
      setIsSending(false);
    }
  };

  const formatCurrency = (n) => formatCurrencyAmount(n || 0, BASE_CURRENCY);

  const handleSave = () => {
    if (onSend) {
      onSend({
        items,
        notes,
        discount,
        clientName,
        businessName,
        total: totals.total,
        currency: BASE_CURRENCY,
        status: 'draft',
        updatedAt: new Date().toISOString(),
      });
    }
    setAlertModal({ title: '📄 Saved', message: 'Proposal saved!' });
  };

  const validateAmount = (value) => {
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0;
  };

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="modal" style={{ background: 'white', borderRadius: 12, width: '90%', maxWidth: 800, maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-header" style={{ padding: 20, borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>📄 Proposal Builder</h2>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button 
              className={`btn ${isEditing ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setIsEditing(true)}
            >
              ✏️ Edit
            </button>
            <button 
              className={`btn ${!isEditing ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setIsEditing(false)}
            >
              👁 Preview
            </button>
          </div>

          <div className="card" style={{ marginBottom: 20, background: 'var(--bg-secondary)', padding: 15 }}>
            <h4 style={{ margin: '0 0 10px' }}>👤 Client Information</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 12, color: 'var(--text-muted)' }}>Business Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    className="form-control"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                ) : (
                  <div><strong>{businessName || lead?.businessName}</strong></div>
                )}
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 12, color: 'var(--text-muted)' }}>Contact Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    className="form-control"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                ) : (
                  <div><strong>{clientName || lead?.contactName}</strong></div>
                )}
              </div>
              <div><strong>Email:</strong> {lead?.email || '—'}</div>
              <div><strong>Phone:</strong> {lead?.ownerPhone || '—'}</div>
            </div>
          </div>

          <h4 style={{ marginBottom: 10 }}>🛠️ Services</h4>
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th style={{ width: 80 }}>Qty</th>
                <th style={{ width: 120 }}>Price (€)</th>
                <th style={{ width: 120 }}>Total (€)</th>
                <th style={{ width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td>
                    {item.id === 'custom' ? (
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        <input
                          type="text"
                          className="form-control"
                          style={{ fontSize: 12 }}
                          placeholder="Enter custom service name..."
                          value={item.name === 'Custom Service' ? '' : item.name}
                          onChange={(e) => updateItem(index, 'name', e.target.value)}
                          disabled={!isEditing}
                        />
                        {isEditing && (
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => {
                              updateItem(index, {
                                id: SERVICES[0].id,
                                name: SERVICES[0].name,
                                basePrice: SERVICES[0].basePrice,
                                total: SERVICES[0].basePrice * item.quantity
                              });
                            }}
                            style={{ padding: '4px 8px', fontSize: 12 }}
                            title="Switch back to listed services"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ) : (
                      <select
                        className="form-control"
                        value={item.id}
                        onChange={(e) => {
                          if (e.target.value === 'custom') {
                            updateItem(index, {
                              id: 'custom',
                              name: 'Custom Service',
                              basePrice: 0,
                              total: 0
                            });
                          } else {
                            const service = SERVICES.find(s => s.id === e.target.value);
                            updateItem(index, {
                              id: service.id,
                              name: service.name,
                              basePrice: service.basePrice,
                              total: service.basePrice * item.quantity
                            });
                          }
                        }}
                        disabled={!isEditing}
                      >
                        {SERVICES.map(s => (
                          <option key={s.id} value={s.id}>{s.name} - €{s.basePrice}</option>
                        ))}
                        <option value="custom">✨ Custom Service...</option>
                      </select>
                    )}
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-control"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                      disabled={!isEditing}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-control"
                      value={item.basePrice}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (validateAmount(e.target.value)) {
                          updateItem(index, 'basePrice', isNaN(val) ? 0 : val);
                        }
                      }}
                      disabled={!isEditing}
                    />
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                    {formatCurrency(item.total)}
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1 || !isEditing}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {isEditing && (
            <button className="btn btn-ghost" onClick={addItem} style={{ marginTop: 10 }}>
              + Add Service
            </button>
          )}

          <div style={{ display: 'flex', gap: 20, marginTop: 20 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>📝 Additional Notes</label>
              <textarea
                className="form-control remark-textarea"
                rows={4}
                placeholder="Add custom pitch, special offer, or strategy notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!isEditing}
              />
            </div>
            <div style={{ width: 200 }}>
              <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>🏷️ Discount (%)</label>
              <input
                type="number"
                className="form-control"
                min="0"
                max="100"
                value={discount}
                onChange={(e) => setDiscount(parseInt(e.target.value) || 0)}
                disabled={!isEditing}
              />
            </div>
          </div>

          <div className="card" style={{ marginTop: 20, background: 'var(--primary)', color: 'white', padding: 15 }}>
            <h3 style={{ margin: '0 0 10px', color: 'white' }}>💶 Quotation</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div>Subtotal: {formatCurrency(totals.subtotal)}</div>
                {discount > 0 && <div>Discount ({totals.discountPercent}%): -{formatCurrency(totals.discountAmount)}</div>}
                <div>Net Amount: {formatCurrency(totals.taxableAmount)}</div>
                <div>GST ({totals.taxPercent}%): {formatCurrency(totals.taxAmount)}</div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                Total: {formatCurrency(totals.grandTotal)}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ padding: 20, borderTop: '1px solid var(--border-color)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {isEditing ? (
            <>
              <button className="btn btn-ghost" onClick={() => setIsEditing(false)}>
                👁 Preview
              </button>
              <button className="btn btn-ghost" onClick={handleSave}>
                💾 Save Draft
              </button>
              <button className="btn btn-primary" onClick={handleSend} disabled={isSending}>
                {isSending ? '⏳ Sending...' : '📤 Send Proposal'}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
                ✏️ Edit
              </button>
              <button className="btn btn-primary" onClick={handleSend} disabled={isSending}>
                {isSending ? '⏳ Sending...' : '📤 Send Proposal'}
              </button>
            </>
          )}
        </div>
      </div>

      {showPreview && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }} onClick={() => setShowPreview(false)}>
          <div className="modal" style={{ background: 'white', borderRadius: 12, width: '95%', maxWidth: 600, maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: 20, borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>📧 Email Preview</h3>
              <button className="btn btn-ghost" onClick={() => setShowPreview(false)}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 15 }}>
                <strong>Subject:</strong> Proposal for {businessName || lead?.businessName}
              </div>
              <div style={{ background: '#f8f9fa', padding: 15, borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  To: {lead?.email}
                </div>
                <p>Dear {clientName || lead?.contactName},</p>
                <p>Thank you for your interest in our services. Please find your proposal details below:</p>
                <div style={{ background: 'white', padding: 10, borderRadius: 4, border: '1px solid #ddd' }}>
                  {items.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                      <span>{item.name}</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                </div>
                <p style={{ marginTop: 10, fontWeight: 600 }}>Total: {formatCurrency(totals.total)}</p>
                {notes && <div className="remark-item" style={{ marginTop: 10 }}><strong>Note:</strong> <span className="remark-text">{notes}</span></div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {alertModal && (
        <div className="modal-overlay" onClick={() => setAlertModal(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{alertModal.title}</div>
              <button className="btn btn-ghost" onClick={() => setAlertModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ whiteSpace: 'pre-line', margin: 0, lineHeight: 1.6 }}>{alertModal.message}</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setAlertModal(null)}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProposalBuilder;

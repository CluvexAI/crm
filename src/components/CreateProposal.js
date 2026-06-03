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
  const { currentUser, sendEmail } = useApp();
  const [alertModal, setAlertModal] = useState(null);
  
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
  
  const [clientName, setClientName] = useState(lead?.contactName || '');
  const [businessName, setBusinessName] = useState(lead?.businessName || '');
  const [email, setEmail] = useState(lead?.email || '');
  const [phone, setPhone] = useState(lead?.ownerPhone || '');
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
  const [taxPercent, setTaxPercent] = useState(18);
  
  const [savedSignature, setSavedSignature] = useState(() => {
    return localStorage.getItem(`zsm_signature_${currentUser?.id || 'default'}`) || '';
  });
  const [tempSignature, setTempSignature] = useState('');
  const [tempSignatureName, setTempSignatureName] = useState('');
  const [uploadError, setUploadError] = useState('');
  
  const agentName = currentUser?.name || 'Sales Agent';
  const agentPhone = currentUser?.phone || '+91 98765 43210';
  const agentEmail = currentUser?.email || 'info@zsmeservices.com';
  const companyName = 'ZSM Services';

  const totals = calculateProposalTotal(items, taxPercent, discount);

  const getHtmlSignature = (sig) => {
    const baseSignature = `<br/><br/>---<br/><strong>Best regards,</strong><br/>${agentName}<br/>${companyName}<br/>Phone: ${agentPhone}<br/>Email: ${agentEmail}`;
    if (sig) {
      return `${baseSignature}<br/><br/><img src="${sig}" alt="Signature" style="max-height: 60px; max-width: 200px; object-fit: contain; margin-top: 10px; border-radius: 4px;" />`;
    }
    return baseSignature;
  };

  const loadTemplate = (templateId, sig = savedSignature) => {
    const template = EMAIL_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      const title = `${template.name} - ${lead?.businessName || 'Proposal'}`;
      const validUntilDate = new Date();
      validUntilDate.setDate(validUntilDate.getDate() + 30);
      const validUntilFormatted = validUntilDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      
      const templateData = {
        company_name: companyName,
        proposal_title: title,
        client_name: lead?.contactName || lead?.prospectName || lead?.name || 'Valued Customer',
        business_name: lead?.businessName || '',
        agent_name: agentName,
        valid_until: validUntilFormatted,
        proposal_total: formatCurrency(totals.total || 0)
      };

      const mergedSubject = replaceMergeTags(template.subject, templateData);
      setEmailSubject(mergedSubject);
      setProposalTitle(title);
      
      let body = replaceMergeTags(template.body, templateData);
      body = body.replace(/\n/g, '<br/>');
      body += getHtmlSignature(sig);
      setEmailBody(body);
    }
  };

  useEffect(() => {
    loadTemplate(selectedTemplate);
  }, []);

  const handleTemplateChange = (e) => {
    const templateId = e.target.value;
    setSelectedTemplate(templateId);
    loadTemplate(templateId);
  };

  const handleResetTemplate = () => {
    loadTemplate(selectedTemplate);
  };

  const handleInsertSignature = () => {
    if (savedSignature) {
      const signatureHtml = `<br/><br/><img src="${savedSignature}" alt="Signature" style="max-height: 60px; max-width: 200px; object-fit: contain; margin-top: 10px; border-radius: 4px;" />`;
      setEmailBody(prev => prev + signatureHtml);
    }
  };

  const handleSignatureFileChange = (e) => {
    const file = e.target.files[0];
    setUploadError('');
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Image size exceeds 2MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setTempSignature(event.target.result);
      setTempSignatureName(file.name);
    };
    reader.onerror = () => {
      setUploadError('Error reading file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSignature = () => {
    if (tempSignature) {
      const key = `zsm_signature_${currentUser?.id || 'default'}`;
      localStorage.setItem(key, tempSignature);
      setSavedSignature(tempSignature);
      setTempSignature('');
      setTempSignatureName('');
      // Proactively reload the template to include the newly saved signature!
      loadTemplate(selectedTemplate, tempSignature);
      setAlertModal({ title: '✅ Signature Saved', message: 'Signature saved successfully!' });
    }
  };

  const handleClearSignature = () => {
    if (window.confirm('Are you sure you want to remove your saved signature?')) {
      const key = `zsm_signature_${currentUser?.id || 'default'}`;
      localStorage.removeItem(key);
      setSavedSignature('');
      setTempSignature('');
      setTempSignatureName('');
      // Reload template without signature
      loadTemplate(selectedTemplate, '');
    }
  };

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

  const formatCurrency = (n) => formatCurrencyAmount(n || 0, BASE_CURRENCY);

  const calculatedTotal = totals.grandTotal;

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
      email,
      phone,
      status: 'draft',
      createdAt: new Date().toISOString(),
      ...totals
    };
    
    if (onSave) {
      onSave(proposalData);
    }
    setAlertModal({ title: '📄 Draft Saved', message: 'Proposal saved as draft!' });
    onClose();
  };

  const handleSend = async () => {
    if (!email) {
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
      const token = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const baseUrl = window.location.origin;
      
      const validUntilFormatted = validUntil ? new Date(validUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : "N/A";
      const proposal = {
        id: proposalId,
        items: safeItems,
        notes,
        discount,
        clientName,
        businessName,
        title: proposalTitle || `Proposal for ${businessName}`,
        validUntil: validUntilFormatted,
        companyName: companyName || 'ZSM Services',
        senderName: agentName || currentUser?.name || 'ZSM CRM User',
        senderEmail: emailConfig?.email || currentUser?.email || 'info@zsmservices.com',
        senderPhone: currentUser?.phone || '',
        currency: BASE_CURRENCY,
        acceptUrl: `${baseUrl}/proposal/accept/${token}`,
        rejectUrl: `${baseUrl}/proposal/reject/${token}`,
      };

      const html = generateProposalHTML(proposal, safeItems, totals);
      const text = generateProposalText(proposal, safeItems, totals);
      const subject = emailSubject || `Proposal for ${businessName}`;

      console.log('Sending proposal email:', { to: email, subject });
      console.log('Email body:', emailBody);

      if (sendEmail) {
        const combinedHtml = `${emailBody}<br/><br/>${html}`;
        const combinedText = `${emailBody}\n\n${text}`;
        await sendEmail({
          to: email,
          subject,
          html: combinedHtml,
          text: combinedText
        });
      }

      if (onSave) {
        onSave({
          id: proposalId,
          leadId: lead?.id,
          clientName,
          businessName,
          items: safeItems,
          notes,
          discount,
          taxPercent,
          proposalTitle,
          validUntil,
          emailSubject: subject,
          emailBody,
          email,
          phone,
          status: 'sent',
          token,
          sentAt: new Date().toISOString(),
          fromEmail: emailConfig?.email,
          currency: BASE_CURRENCY,
          ...totals
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
                <input
                  type="text"
                  className="form-control"
                  style={{ background: 'white', padding: '8px 12px' }}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 12, color: 'var(--text-muted)' }}>Contact Name</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ background: 'white', padding: '8px 12px' }}
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 12, color: 'var(--text-muted)' }}>Email</label>
                <input
                  type="email"
                  className="form-control"
                  style={{ background: 'white', padding: '8px 12px' }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 12, color: 'var(--text-muted)' }}>Phone</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ background: 'white', padding: '8px 12px' }}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
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
                <button 
                  className="btn btn-primary" 
                  onClick={handleInsertSignature}
                  disabled={!savedSignature}
                  title={!savedSignature ? 'Please save a signature first in the Signature Settings below' : 'Insert saved signature'}
                >
                  ✍️ Signature
                </button>
              </div>
            </div>
          </div>

          {/* Agent Signature Settings Card */}
          <div className="card" style={{ background: 'var(--bg-secondary)', padding: 20 }}>
            <h4 style={{ margin: '0 0 15px', display: 'flex', alignItems: 'center', gap: 8 }}>
              ✍️ Agent Signature Settings
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Left Column: Upload / Preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)' }}>
                  Upload Signature Image (PNG, JPG, Max 2MB)
                </label>
                
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSignatureFileChange}
                    style={{ display: 'none' }}
                    id="signature-file-upload"
                  />
                  <label
                    htmlFor="signature-file-upload"
                    className="btn btn-ghost"
                    style={{
                      cursor: 'pointer',
                      border: '2px dashed var(--border-color)',
                      padding: '12px 20px',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'white',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span>📁 Choose File</span>
                  </label>
                  {tempSignatureName && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                      {tempSignatureName}
                    </span>
                  )}
                </div>

                {uploadError && (
                  <div style={{ color: 'red', fontSize: 12 }}>
                    ⚠️ {uploadError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveSignature}
                    disabled={!tempSignature}
                  >
                    💾 Save Signature
                  </button>
                  {savedSignature && (
                    <button
                      className="btn btn-ghost"
                      onClick={handleClearSignature}
                      style={{ color: 'red', borderColor: '#ffccd5' }}
                    >
                      🗑️ Remove Saved Signature
                    </button>
                  )}
                </div>
              </div>

              {/* Right Column: Visual Preview Box */}
              <div style={{ 
                border: '1px solid var(--border-color)', 
                borderRadius: 8, 
                padding: 15, 
                background: 'white', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                minHeight: 120,
                position: 'relative'
              }}>
                <span style={{ 
                  position: 'absolute', 
                  top: 5, 
                  left: 8, 
                  fontSize: 10, 
                  color: 'var(--text-muted)', 
                  fontWeight: 600 
                }}>
                  PREVIEW
                </span>
                
                {tempSignature ? (
                  <div style={{ textAlign: 'center' }}>
                    <img 
                      src={tempSignature} 
                      alt="Temp Signature" 
                      style={{ maxHeight: 60, maxWidth: 200, objectFit: 'contain', border: '1px dashed #4caf50', padding: 4, borderRadius: 4 }} 
                    />
                    <div style={{ fontSize: 10, color: '#4caf50', marginTop: 4 }}>Staged (Click Save)</div>
                  </div>
                ) : savedSignature ? (
                  <div style={{ textAlign: 'center' }}>
                    <img 
                      src={savedSignature} 
                      alt="Saved Signature" 
                      style={{ maxHeight: 60, maxWidth: 200, objectFit: 'contain', padding: 4 }} 
                    />
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Saved Signature</div>
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>
                    No signature uploaded yet
                  </div>
                )}
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
                      {item.id === 'custom' ? (
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          <input
                            type="text"
                            className="form-control"
                            style={{ fontSize: 12 }}
                            placeholder="Enter custom service name..."
                            value={item.name === 'Custom Service' ? '' : item.name}
                            onChange={(e) => updateItem(index, 'name', e.target.value)}
                          />
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
                        </div>
                      ) : (
                        <select
                          className="form-control"
                          style={{ fontSize: 12 }}
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
                        >
                          {SERVICES.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                          <option value="custom">✨ Custom Service...</option>
                        </select>
                      )}
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
                    <div>Discount ({discount}%): <strong>-{formatCurrency(totals.discountAmount)}</strong></div>
                  )}
                  <div>Net Amount: <strong>{formatCurrency(totals.afterDiscount)}</strong></div>
                  <div>Tax ({taxPercent}%): <strong>{formatCurrency(totals.taxAmount)}</strong></div>
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
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>To: {email}</div>
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
                {discount > 0 && <div style={{ fontSize: 13 }}>Discount ({discount}%): -{formatCurrency(totals.discountAmount)}</div>}
                <div style={{ fontSize: 13 }}>Net Amount: {formatCurrency(totals.afterDiscount)}</div>
                <div style={{ fontSize: 13 }}>Tax ({taxPercent}%): {formatCurrency(totals.taxAmount)}</div>
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

export default CreateProposal;

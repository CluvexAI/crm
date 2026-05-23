import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { CURRENCIES, getCurrencySymbol, BASE_CURRENCY } from '../services/currencyService';
import { PROPOSAL_TYPES, getNextInvoiceNumber, saveCustomInvoice, getCompanySettings } from '../services/invoiceService';

const CreateInvoiceModal = ({ onClose, refreshInvoices }) => {
  const { allSales, allLeads, currentUser, allUsers } = useApp();
  const companySettings = getCompanySettings();

  // Primary Metadata State
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [currency, setCurrency] = useState(BASE_CURRENCY);
  const [saleId, setSaleId] = useState('');
  const [leadId, setLeadId] = useState('');
  const [creditToAgent, setCreditToAgent] = useState('');

  // Prefill Select State
  const [selectedPrefill, setSelectedPrefill] = useState('');

  // Client Details State
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [countryCode, setCountryCode] = useState('IN');
  const [dialCode, setDialCode] = useState('+91');

  // Service items
  const [services, setServices] = useState([
    {
      id: `svc_${Date.now()}_0`,
      name: 'Web Design Plan',
      description: '',
      duration: 'Monthly',
      quantity: 1,
      unitPrice: 0,
      taxRate: 0,
    }
  ]);

  // Amount Summary Modifiers
  const [discountAmount, setDiscountAmount] = useState(0);

  // Installments Plan State
  const [enableInstallments, setEnableInstallments] = useState(false);
  const [numberOfInstallments, setNumberOfInstallments] = useState(2);
  const [installments, setInstallments] = useState([]);

  // Notes & Signatures
  const [notes, setNotes] = useState('Thank you for your business. Payment is due within 30 days.');
  const [terms, setTerms] = useState('Payment terms: Net 30 days. Late payments may incur additional fees.');
  const [renewalTerms, setRenewalTerms] = useState('This service will auto-renew unless cancelled 15 days prior.');
  const [authorizedSignature, setAuthorizedSignature] = useState(companySettings.name || '');

  // Loading & Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch next invoice number on component mount
  useEffect(() => {
    setInvoiceNumber(getNextInvoiceNumber());
  }, []);

  // Handle prefill selection changes
  const handlePrefillChange = (e) => {
    const val = e.target.value;
    setSelectedPrefill(val);
    if (!val) {
      // Clear fields
      setBusinessName('');
      setContactName('');
      setClientEmail('');
      setClientPhone('');
      setAddressLine1('');
      setCity('');
      setState('');
      setCountry('');
      setSaleId('');
      setLeadId('');
      return;
    }

    const [type, id] = val.split('_');
    if (type === 'sale') {
      const sale = allSales.find(s => String(s.id) === id);
      if (sale) {
        setBusinessName(sale.businessName || '');
        setContactName(sale.leadName || '');
        setClientEmail(sale.email || '');
        setClientPhone(sale.ownerPhone || sale.phone || '');
        setAddressLine1(sale.addressLine1 || sale.address || '');
        setCity(sale.city || '');
        setState(sale.state || '');
        setCountry(sale.country || '');
        setCountryCode(sale.countryCode || 'IN');
        setDialCode(sale.dialCode || '+91');
        setSaleId(sale.id);
        setLeadId(sale.leadId || '');
        if (sale.closedBy) setCreditToAgent(sale.closedBy);
      }
    } else if (type === 'lead') {
      const lead = allLeads.find(l => String(l.id) === id);
      if (lead) {
        setBusinessName(lead.businessName || lead.company || '');
        setContactName(lead.contactName || lead.name || '');
        setClientEmail(lead.email || '');
        setClientPhone(lead.ownerPhone || lead.phone || '');
        setAddressLine1(lead.address || '');
        setCity(lead.city || '');
        setState(lead.state || lead.county || '');
        setCountry(lead.country || '');
        setCountryCode(lead.countryCode || 'IN');
        setDialCode(lead.dialCode || '+91');
        setSaleId('');
        setLeadId(lead.id);
        if (lead.assignedTo) setCreditToAgent(lead.assignedTo);
      }
    }
  };

  // Service Row CRUD helpers
  const handleAddServiceRow = () => {
    setServices(prev => [
      ...prev,
      {
        id: `svc_${Date.now()}_${prev.length}`,
        name: 'Custom Service',
        description: '',
        duration: 'Monthly',
        quantity: 1,
        unitPrice: 0,
        taxRate: 0,
      }
    ]);
  };

  const handleUpdateServiceRow = (id, field, val) => {
    setServices(prev =>
      prev.map(row => {
        if (row.id === id) {
          let parsedVal = val;
          if (field === 'quantity') parsedVal = Math.max(0, parseInt(val, 10) || 0);
          if (field === 'unitPrice') parsedVal = Math.max(0, parseFloat(val) || 0);
          if (field === 'taxRate') parsedVal = Math.max(0, parseFloat(val) || 0);
          return { ...row, [field]: parsedVal };
        }
        return row;
      })
    );
  };

  const handleRemoveServiceRow = (id) => {
    if (services.length <= 1) {
      window.alert('At least one service line item is required.');
      return;
    }
    setServices(prev => prev.filter(row => row.id !== id));
  };

  // Calculations
  const subtotal = services.reduce((sum, s) => sum + (s.quantity * s.unitPrice), 0);
  const taxAmount = services.reduce((sum, s) => sum + ((s.quantity * s.unitPrice * s.taxRate) / 100), 0);
  const grandTotal = Math.max(0, subtotal + taxAmount - discountAmount);

  // Installments list generation & validation
  useEffect(() => {
    if (!enableInstallments) {
      setInstallments([]);
      return;
    }
    // Initialize standard installments distributed evenly
    distributeEvenly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableInstallments, numberOfInstallments]);

  // Distribute grand total evenly
  const distributeEvenly = () => {
    if (numberOfInstallments < 2) return;
    const baseAmt = Math.floor((grandTotal / numberOfInstallments) * 100) / 100;
    const items = [];
    let allocated = 0;

    for (let i = 1; i <= numberOfInstallments; i++) {
      const isLast = i === numberOfInstallments;
      const amt = isLast ? Number((grandTotal - allocated).toFixed(2)) : baseAmt;
      allocated = Number((allocated + amt).toFixed(2));

      // Calculate due dates sequentially (every 30 days)
      const d = new Date(invoiceDate);
      d.setDate(d.getDate() + (i * 30));
      const dateStr = d.toISOString().split('T')[0];

      items.push({
        id: `inst_new_${i}_${Date.now()}`,
        installment_number: i,
        amount: amt,
        dueDate: dateStr,
        status: 'PENDING',
        paidAmount: 0,
        paidAt: null,
        paymentMethod: null,
      });
    }
    setInstallments(items);
  };

  const handleUpdateInstallment = (index, field, val) => {
    setInstallments(prev => {
      const copy = [...prev];
      if (field === 'amount') {
        copy[index].amount = Math.max(0, parseFloat(val) || 0);
      } else if (field === 'dueDate') {
        copy[index].dueDate = val;
      }
      return copy;
    });
  };

  // Validate installments sum
  const installmentsTotal = installments.reduce((sum, inst) => sum + inst.amount, 0);
  const isInstallmentSumValid = !enableInstallments || Math.abs(installmentsTotal - grandTotal) < 0.01;

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!businessName.trim()) {
      window.alert('Business name is required.');
      return;
    }
    if (!invoiceNumber.trim()) {
      window.alert('Invoice number is required.');
      return;
    }
    if (enableInstallments && !isInstallmentSumValid) {
      window.alert(`Installment schedule total (${installmentsTotal.toFixed(2)}) must exactly equal the Grand Total (${grandTotal.toFixed(2)}). Please adjust the installments.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const now = new Date().toISOString();
      const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const firstInstallmentAmount = enableInstallments && installments.length > 0 ? installments[0].amount : grandTotal;

      // Automatically generate stripe payment link
      let paymentLinkUrl = null;
      let paymentLinkId = null;

      try {
        const stripeRes = await fetch('/api/stripe/payment-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceId: invoiceId,
            amount: firstInstallmentAmount,
            currency: currency || 'USD',
            customerName: businessName,
            customerEmail: clientEmail || ''
          })
        });
        const stripeData = await stripeRes.json();
        if (stripeData.success) {
          paymentLinkUrl = stripeData.url;
          paymentLinkId = stripeData.id;
        } else {
          console.warn('Stripe unconfigured or error:', stripeData.message);
          // Fallback checkout link simulation
          paymentLinkUrl = `https://checkout.stripe.com/pay/${invoiceId}?amount=${Math.round(firstInstallmentAmount * 100)}`;
          paymentLinkId = `mock_link_${Date.now()}`;
        }
      } catch (err) {
        console.error('Failed to connect to Stripe endpoint:', err);
        // Fallback checkout link simulation
        paymentLinkUrl = `https://checkout.stripe.com/pay/${invoiceId}?amount=${Math.round(firstInstallmentAmount * 100)}`;
        paymentLinkId = `mock_link_${Date.now()}`;
      }

      const clientObj = {
        businessName,
        contactName,
        email: clientEmail,
        phone: clientPhone,
        addressLine1,
        city,
        state,
        country,
        countryCode,
        dialCode,
      };

      const formattedServices = services.map((s, index) => ({
        id: `svc_${Date.now()}_${index}`,
        name: s.name,
        description: s.description,
        duration: s.duration,
        quantity: s.quantity,
        unitPrice: s.unitPrice,
        taxRate: s.taxRate,
        total: Number((s.quantity * s.unitPrice * (1 + s.taxRate / 100)).toFixed(2)),
      }));

      const newInvoiceObj = {
        id: invoiceId,
        invoiceNumber,
        saleId: saleId || null,
        leadId: leadId || null,
        createdBy: currentUser?.name || 'Accounts User',
        status: 'PENDING',
        lockedTotal: enableInstallments && installments.length > 0 ? installments[0].amount : grandTotal,
        saleTotalAmount: grandTotal,
        stripe_payment_link_url: paymentLinkUrl,
        stripe_payment_link_id: paymentLinkId,
        contactDetails: {
          mailingAddress: companySettings.contactDetails?.mailingAddress || '',
          email: companySettings.contactDetails?.email || '',
          contacts: { ...(companySettings.contactDetails?.contacts || {}) }
        },
        from: { ...companySettings },
        client: clientObj,
        invoiceInfo: {
          invoiceDate,
          dueDate: enableInstallments && installments.length > 0 ? installments[0].dueDate : dueDate,
          currency,
          currencySymbol: getCurrencySymbol(currency),
        },
        services: formattedServices,
        amountSummary: {
          subtotal,
          discountType: 'FLAT',
          discountValue: discountAmount,
          discountAmount,
          afterDiscount: subtotal - discountAmount,
          taxName: 'GST',
          taxPercent: services.reduce((sum, s) => sum + s.taxRate, 0) / services.length,
          taxAmount,
          additionalCharges: [],
          additionalChargesTotal: 0,
          grandTotal: enableInstallments && installments.length > 0 ? installments[0].amount : grandTotal,
        },
        installments: enableInstallments ? installments.map(inst => ({
          ...inst,
          id: `inst_${Date.now()}_${inst.installment_number}`
        })) : [],
        payments: [],
        totalAmount: enableInstallments && installments.length > 0 ? installments[0].amount : grandTotal,
        paidAmount: 0,
        dueAmount: enableInstallments && installments.length > 0 ? installments[0].amount : grandTotal,
        notes,
        terms,
        renewalTerms,
        signature: {
          authorizedBy: authorizedSignature,
          signedAt: now,
        },
        auditLog: [],
        createdAt: now,
        updatedAt: now,
      };

      // Save using service and trigger refresh
      saveCustomInvoice(newInvoiceObj, currentUser?.name || 'Accounts User');
      if (refreshInvoices) refreshInvoices();
      setIsSubmitting(false);
      onClose();
    } catch (err) {
      window.alert(`Failed to save invoice: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ background: 'rgba(14, 30, 54, 0.65)', backdropFilter: 'blur(8px)' }}>
      <div className="modal modal-lg" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid rgba(14, 84, 145, 0.15)', boxShadow: '0 24px 48px -12px rgba(14, 84, 145, 0.25)', maxWidth: '1000px', display: 'flex', flexDirection: 'column' }}>
        
        {/* Sticky Header with subtle gradient */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-light)', padding: '20px 24px', background: 'linear-gradient(135deg, #0E5491, #1a6bb5)', color: '#ffffff', borderRadius: '16px 16px 0 0' }}>
          <div className="modal-title" style={{ fontSize: '18px', fontWeight: '700', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🧾 Create Customized Invoice</span>
            <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '12px', fontWeight: 'normal' }}>Accounts Desk</span>
          </div>
          <button className="btn btn-icon btn-ghost" style={{ color: '#ffffff', background: 'transparent', transition: 'all 0.2s' }} onClick={onClose}>✕</button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="modal-body" style={{ padding: '24px', flex: '1', overflowY: 'auto' }}>
          <form id="customInvoiceForm" onSubmit={handleSubmit}>

            {/* Quick Prefill Section */}
            <div className="card" style={{ border: '1px dashed var(--primary-light)', padding: '16px', background: 'var(--bg-secondary)', marginBottom: '24px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ fontSize: '20px' }}>⚡</span>
                <div>
                  <h4 style={{ fontWeight: '700', color: 'var(--primary-dark)', fontSize: '14px', margin: 0 }}>Client Auto-Prefill (Optional)</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Select an existing Customer or Lead to automatically fill billing details</p>
                </div>
              </div>
              <div>
                <select className="form-control" value={selectedPrefill} onChange={handlePrefillChange} style={{ background: '#ffffff', border: '1.5px solid var(--border)' }}>
                  <option value="">-- No Prefill (Create Blank Custom Invoice) --</option>
                  <optgroup label="Sales / Customers">
                    {allSales.map(sale => (
                      <option key={`sale_${sale.id}`} value={`sale_${sale.id}`}>
                        💼 {sale.businessName || 'Unnamed'} ({sale.leadName || 'Contact'}) - {sale.proposalType}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Leads">
                    {allLeads.map(lead => (
                      <option key={`lead_${lead.id}`} value={`lead_${lead.id}`}>
                        👤 {lead.businessName || lead.company || 'Unnamed'} ({lead.contactName || lead.name}) - {lead.proposalType}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            {/* General Layout Split */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
              
              {/* Column 1: Billing & Client Info */}
              <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#fcfdfe', border: '1px solid var(--border-light)' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '2px solid var(--bg-tertiary)', paddingBottom: '8px', color: 'var(--primary)', marginBottom: '16px' }}>👤 Billing Client Information</h3>
                
                <div className="form-group">
                  <label className="form-label">Business / Company Name <span className="required">*</span></label>
                  <input className="form-control" type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Acme Corporation" required />
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Person Name</label>
                  <input className="form-control" type="text" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="e.g. John Doe" />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Client Email</label>
                    <input className="form-control" type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="name@company.com" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Client Phone</label>
                    <input className="form-control" type="text" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="e.g. +91 99999 99999" />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Mailing Address</label>
                  <input className="form-control" type="text" value={addressLine1} onChange={e => setAddressLine1(e.target.value)} placeholder="e.g. Suite 4B, 100 Main St" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input className="form-control" type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="City" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State / Region</label>
                    <input className="form-control" type="text" value={state} onChange={e => setState(e.target.value)} placeholder="State" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Country</label>
                    <input className="form-control" type="text" value={country} onChange={e => setCountry(e.target.value)} placeholder="Country" />
                  </div>
                </div>
              </div>

              {/* Column 2: Invoice Info & Parameters */}
              <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#fcfdfe', border: '1px solid var(--border-light)' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '2px solid var(--bg-tertiary)', paddingBottom: '8px', color: 'var(--primary)', marginBottom: '16px' }}>⚙️ Invoice Parameters & Meta</h3>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Invoice Number <span className="required">*</span></label>
                    <input className="form-control" type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="INV-YYYY-XXX" required style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--primary)' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Transaction Currency</label>
                    <select className="form-control" value={currency} onChange={e => setCurrency(e.target.value)}>
                      {CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>{c.flag} {c.code} ({c.symbol}) - {c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Issue Date</label>
                    <input className="form-control" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Due Date</label>
                    <input className="form-control" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={enableInstallments} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Credit to Agent</label>
                    <select className="form-control" value={creditToAgent} onChange={e => setCreditToAgent(e.target.value)}>
                      <option value="">-- Assign Sales Credit (Optional) --</option>
                      {allUsers.filter(u => u.role === 'Sales Agent' || u.department === 'Sales').map(u => (
                        <option key={u.id} value={u.id}>👤 {u.name} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Linked CRM Lead</label>
                    <select className="form-control" value={leadId} onChange={e => setLeadId(e.target.value)}>
                      <option value="">-- Link Lead Record (Optional) --</option>
                      {allLeads.map(l => (
                        <option key={l.id} value={l.id}>{l.businessName || l.company} ({l.contactName || l.name})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Company Authorized Signatory</label>
                  <input className="form-control" type="text" value={authorizedSignature} onChange={e => setAuthorizedSignature(e.target.value)} placeholder="Authorized Name" />
                </div>
              </div>

            </div>

            {/* Service Line Items Section */}
            <div className="card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border-light)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--bg-tertiary)', paddingBottom: '8px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--primary)', margin: 0 }}>🛠️ Service / Proposal Line Items</h3>
                <button type="button" className="btn btn-sm btn-primary" onClick={handleAddServiceRow}>➕ Add Line Item</button>
              </div>

              <div className="table-container" style={{ overflowVisible: 'visible' }}>
                <table style={{ minWidth: '850px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '25%' }}>Service Category</th>
                      <th style={{ width: '25%' }}>Description / Details</th>
                      <th style={{ width: '12%' }}>Duration</th>
                      <th style={{ width: '8%', textAlign: 'center' }}>Qty</th>
                      <th style={{ width: '12%' }}>Unit Price ({getCurrencySymbol(currency)})</th>
                      <th style={{ width: '8%', textAlign: 'center' }}>Tax %</th>
                      <th style={{ width: '10%', textAlign: 'right' }}>Total</th>
                      <th style={{ width: '5%', textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((row) => {
                      const itemSub = row.quantity * row.unitPrice;
                      const itemTax = (itemSub * row.taxRate) / 100;
                      const rowTotal = itemSub + itemTax;

                      return (
                        <tr key={row.id}>
                          <td>
                            <select className="form-control" value={row.name} onChange={e => handleUpdateServiceRow(row.id, 'name', e.target.value)}>
                              {PROPOSAL_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input className="form-control" type="text" value={row.description} onChange={e => handleUpdateServiceRow(row.id, 'description', e.target.value)} placeholder="e.g. Standard package setup details" />
                          </td>
                          <td>
                            <select className="form-control" value={row.duration} onChange={e => handleUpdateServiceRow(row.id, 'duration', e.target.value)}>
                              <option value="One-time">One-time</option>
                              <option value="Monthly">Monthly</option>
                              <option value="Quarterly">Quarterly</option>
                              <option value="Yearly">Yearly</option>
                            </select>
                          </td>
                          <td>
                            <input className="form-control" type="number" min="1" value={row.quantity} onChange={e => handleUpdateServiceRow(row.id, 'quantity', e.target.value)} style={{ textAlign: 'center' }} />
                          </td>
                          <td>
                            <input className="form-control" type="number" step="0.01" min="0" value={row.unitPrice} onChange={e => handleUpdateServiceRow(row.id, 'unitPrice', e.target.value)} placeholder="0.00" />
                          </td>
                          <td>
                            <input className="form-control" type="number" min="0" max="100" value={row.taxRate} onChange={e => handleUpdateServiceRow(row.id, 'taxRate', e.target.value)} style={{ textAlign: 'center' }} />
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--primary-dark)', fontSize: '13.5px' }}>
                            {getCurrencySymbol(currency)}{rowTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button type="button" className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)', padding: '4px 8px' }} onClick={() => handleRemoveServiceRow(row.id)}>🗑️</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calculations and Summary Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', marginBottom: '24px' }}>
              
              {/* Installment Scheduling Form Block */}
              <div className="card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '700', color: 'var(--primary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={enableInstallments} onChange={e => setEnableInstallments(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                    💼 Customize Installment Schedule
                  </label>
                  {enableInstallments && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Installments count:</label>
                      <select className="form-control form-control-sm" style={{ width: '64px', height: '30px', padding: '0 6px' }} value={numberOfInstallments} onChange={e => setNumberOfInstallments(parseInt(e.target.value, 10))}>
                        {[2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <button type="button" className="btn btn-sm btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={distributeEvenly}>🔄 Split Even</button>
                    </div>
                  )}
                </div>

                {!enableInstallments ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                    Checkbox to divide this custom invoice into multiple sequenced payments with individual due dates.
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '12px', fontWeight: 'bold', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px' }}>
                      <div>Installment Number</div>
                      <div>Due Date</div>
                      <div>Amount ({getCurrencySymbol(currency)})</div>
                    </div>
                    
                    <div style={{ maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                      {installments.map((inst, index) => {
                        const isFirst = index === 0;
                        return (
                          <div 
                            key={inst.id} 
                            style={{ 
                              display: 'grid', 
                              gridTemplateColumns: '1.5fr 1.2fr 1fr', 
                              gap: '12px', 
                              alignItems: 'center', 
                              marginBottom: '8px',
                              padding: isFirst ? '10px 12px' : '4px 6px',
                              background: isFirst ? 'rgba(14, 84, 145, 0.08)' : 'transparent',
                              border: isFirst ? '1.5px solid var(--primary)' : '1px dashed transparent',
                              borderRadius: isFirst ? '10px' : '0',
                              boxShadow: isFirst ? '0 4px 12px rgba(14, 84, 145, 0.08)' : 'none',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <div style={{ fontSize: '12.5px', fontWeight: '600', color: isFirst ? 'var(--primary)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>Installment #{inst.installment_number}</span>
                              {isFirst && (
                                <span style={{ 
                                  fontSize: '10px', 
                                  background: 'var(--primary)', 
                                  color: '#ffffff', 
                                  padding: '2px 8px', 
                                  borderRadius: '12px', 
                                  fontWeight: '700',
                                  letterSpacing: '0.3px',
                                  textTransform: 'uppercase'
                                }}>
                                  First Due
                                </span>
                              )}
                            </div>
                            <div>
                              <input 
                                className="form-control" 
                                type="date" 
                                value={inst.dueDate} 
                                onChange={e => handleUpdateInstallment(index, 'dueDate', e.target.value)} 
                                style={{ 
                                  padding: '6px 10px', 
                                  fontSize: '12px',
                                  border: isFirst ? '1.5px solid var(--primary)' : '1.5px solid var(--border)'
                                }} 
                              />
                            </div>
                            <div>
                              <input 
                                className="form-control" 
                                type="number" 
                                step="0.01" 
                                min="0" 
                                value={inst.amount} 
                                onChange={e => handleUpdateInstallment(index, 'amount', e.target.value)} 
                                style={{ 
                                  padding: '6px 10px', 
                                  fontSize: '12.5px', 
                                  fontWeight: 'bold', 
                                  textAlign: 'right',
                                  border: isFirst ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
                                  background: isFirst ? '#ffffff' : 'transparent',
                                  color: isFirst ? 'var(--primary-dark)' : 'inherit'
                                }} 
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Validation Warning badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', padding: '8px 12px', borderRadius: '8px', background: isInstallmentSumValid ? 'var(--success-light)' : 'var(--danger-light)', border: `1px solid ${isInstallmentSumValid ? 'var(--success)' : 'var(--danger)'}` }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: isInstallmentSumValid ? '#065f46' : '#991b1b' }}>
                        {isInstallmentSumValid 
                          ? '✅ Installment plan balance verified!' 
                          : `⚠️ Total sum is off: ${installmentsTotal.toFixed(2)} / ${grandTotal.toFixed(2)} (${(installmentsTotal - grandTotal).toFixed(2)})`
                        }
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: isInstallmentSumValid ? '#065f46' : '#991b1b' }}>
                        Sum: {getCurrencySymbol(currency)}{installmentsTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic Recalculation Summary Panel */}
              <div className="card" style={{ padding: '20px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary-dark)', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>📊 Payment Calculations</h3>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <span>Subtotal:</span>
                  <span style={{ fontWeight: '600' }}>{getCurrencySymbol(currency)}{subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <span>Tax Amount:</span>
                  <span style={{ fontWeight: '600' }}>{getCurrencySymbol(currency)}{taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  <span>Discount Amount:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '12px' }}>{getCurrencySymbol(currency)}</span>
                    <input className="form-control" type="number" step="0.01" min="0" max={subtotal + taxAmount} value={discountAmount} onChange={e => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))} style={{ width: '80px', height: '28px', padding: '2px 6px', textAlign: 'right', fontSize: '12px' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', color: 'var(--primary-dark)', fontWeight: '800', borderTop: '2px dashed var(--border)', paddingTop: '12px', marginBottom: '8px' }}>
                  <span>GRAND TOTAL:</span>
                  <span>{getCurrencySymbol(currency)}{grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

            </div>

            {/* Terms and Notes Section */}
            <div className="card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border-light)', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)', marginBottom: '12px', borderBottom: '1px solid var(--bg-tertiary)', paddingBottom: '6px' }}>📝 Notes & Invoice Disclaimers</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Client Message & Notes</label>
                  <textarea className="form-control" value={notes} onChange={e => setNotes(e.target.value)} rows="3" placeholder="Message that will print on the PDF..."></textarea>
                </div>
                <div className="form-group">
                  <label className="form-label">Contract & Payment Terms</label>
                  <textarea className="form-control" value={terms} onChange={e => setTerms(e.target.value)} rows="3" placeholder="Payment guidelines, late fee clauses..."></textarea>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Renewal Agreement Terms</label>
                <input className="form-control" type="text" value={renewalTerms} onChange={e => setRenewalTerms(e.target.value)} placeholder="Auto-renewal clause if applicable" />
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="modal-footer" style={{ background: '#fcfdfe', borderTop: '1px solid var(--border-light)', padding: '16px 24px', margin: '24px -24px -24px -24px', borderRadius: '0 0 16px 16px' }}>
              <button type="button" className="btn btn-outline" style={{ border: '1.5px solid var(--text-muted)', color: 'var(--text-secondary)' }} onClick={onClose}>Close Editor</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting || (enableInstallments && !isInstallmentSumValid)}>
                {isSubmitting ? (
                  <span>Saving to Registry...</span>
                ) : (
                  <>
                    <span>✨ Save & Generate Invoice</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
};

export default CreateInvoiceModal;

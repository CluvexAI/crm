import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatInvoiceAmount, PAYMENT_METHODS, COMPANY_INFO, getInvoice, updateInvoice, addServiceItem, updateServiceItem, removeServiceItem, addPayment, addInstallment, markInstallmentPaid, getInvoiceAuditLog, cancelInvoice, getCustomerInvoice, DEFAULT_CONTACT_DETAILS } from '../services/invoiceService';
import { CURRENCIES } from '../services/currencyService';
import html2pdf from 'html2pdf.js';

const InvoiceView = ({ invoiceId, onClose }) => {
  const { currentUser } = useApp();
  const [invoice, setInvoice] = useState(null);
  const [editedInvoice, setEditedInvoice] = useState(null);
  const [editMode, setEditMode] = useState('view');
  const [auditLog, setAuditLog] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [newService, setNewService] = useState({ name: '', description: '', duration: 'Monthly', quantity: 1, unitPrice: 0 });
  const [newPayment, setNewPayment] = useState({ amount: 0, method: 'stripe', notes: '' });
  const [newInstallment, setNewInstallment] = useState({ dueDate: '', amount: 0, method: 'stripe' });

  const canEdit = ['Accounts', 'Admin', 'Sales Agent'].includes(currentUser?.role);
  const isAccounts = ['Accounts', 'Admin'].includes(currentUser?.role);

  useEffect(() => {
    const inv = getInvoice(invoiceId);
    setInvoice(inv);
    if (inv) {
      setAuditLog(getInvoiceAuditLog(invoiceId));
    }
  }, [invoiceId]);

  if (!invoice) {
    return (
      <div className="modal-overlay">
        <div className="modal modal-lg">
          <div className="modal-header">
            <div className="modal-title">Invoice Not Found</div>
            <button className="btn btn-icon btn-ghost" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            <p>This invoice could not be found.</p>
          </div>
        </div>
      </div>
    );
  }

  const recalculateLocalTotals = (invoiceCopy) => {
    // 🔒 STRICT COPY ARCHITECTURE - NO CALCULATIONS ALLOWED
    const lockedTotal = invoiceCopy.lockedTotal !== undefined ? invoiceCopy.lockedTotal : invoiceCopy.totalAmount || 0;

    invoiceCopy.amountSummary = {
      ...invoiceCopy.amountSummary,
      subtotal: lockedTotal,
      discountAmount: 0,
      afterDiscount: lockedTotal,
      taxAmount: 0,
      additionalChargesTotal: 0,
      grandTotal: lockedTotal,
    };
    invoiceCopy.totalAmount = lockedTotal;
    invoiceCopy.dueAmount = Math.max(0, lockedTotal - invoiceCopy.paidAmount);
    
    if (invoiceCopy.dueAmount > 0) {
      invoiceCopy.paymentLink = `https://checkout.stripe.com/pay/${invoiceCopy.id}?amount=${Math.round(invoiceCopy.dueAmount * 100)}`;
    } else {
      invoiceCopy.paymentLink = null;
    }
    return invoiceCopy;
  };

  const handleAmountSummaryChange = (field, value) => {
    setEditedInvoice(prev => {
      const updated = { ...prev, amountSummary: { ...prev.amountSummary, [field]: value } };
      return recalculateLocalTotals(updated);
    });
  };

  const handleAddCharge = () => {
    setEditedInvoice(prev => {
      const newCharge = { id: `charge_${Date.now()}`, name: '', amount: 0 };
      const updated = { ...prev, amountSummary: { ...prev.amountSummary, additionalCharges: [...(prev.amountSummary.additionalCharges || []), newCharge] } };
      return recalculateLocalTotals(updated);
    });
  };

  const handleUpdateCharge = (id, field, value) => {
    setEditedInvoice(prev => {
      const updatedCharges = (prev.amountSummary.additionalCharges || []).map(c => c.id === id ? { ...c, [field]: value } : c);
      const updated = { ...prev, amountSummary: { ...prev.amountSummary, additionalCharges: updatedCharges } };
      return recalculateLocalTotals(updated);
    });
  };

  const handleRemoveCharge = (id) => {
    setEditedInvoice(prev => {
      const updatedCharges = (prev.amountSummary.additionalCharges || []).filter(c => c.id !== id);
      const updated = { ...prev, amountSummary: { ...prev.amountSummary, additionalCharges: updatedCharges } };
      return recalculateLocalTotals(updated);
    });
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('invoice-print-area');
    const opt = {
      margin: 0.5,
      filename: `${invoice.invoiceNumber}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  const handleSendEmail = () => {
    if (!invoice.client.email) {
      window.alert('Client has no email address specified.');
      return;
    }
    const safeInvoice = getCustomerInvoice(invoice);
    const totalFormatted = formatInvoiceAmount(safeInvoice.totalAmount, safeInvoice.invoiceInfo.currency);
    const paidFormatted = formatInvoiceAmount(safeInvoice.paidAmount, safeInvoice.invoiceInfo.currency);
    const dueFormatted = formatInvoiceAmount(safeInvoice.dueAmount, safeInvoice.invoiceInfo.currency);

    const emailBody = `
<h1 style="font-size:30px; font-weight:bold; text-align:center; margin-bottom:20px;">
  INVOICE
</h1>

<p>
  <strong>${safeInvoice.from?.name || safeInvoice.company?.name || ''}</strong><br/>
  ${safeInvoice.from?.address || safeInvoice.company?.address || ''}<br/>
  Email: ${safeInvoice.from?.email || safeInvoice.company?.email || ''}<br/>
  Phone: ${safeInvoice.from?.phone || safeInvoice.company?.phone || ''}
</p>

<h2>Invoice #${safeInvoice.invoiceNumber}</h2>

<p>Total: ${totalFormatted}</p>
<p>Paid: ${paidFormatted}</p>
<p>Due: ${dueFormatted}</p>

${safeInvoice.dueAmount > 0 ? `
<div style="padding:12px; border:2px solid #f0c040; background:#fff8e5; margin:20px 0;">
  <strong>Amount Due: ${dueFormatted}</strong><br/>
  <strong>Due Date: ${safeInvoice.invoiceInfo.dueDate}</strong>
</div>
<p>
  <strong>Pay Now:</strong><br/>
  <a href="${safeInvoice.paymentLink}">
    Complete your payment securely via Stripe
  </a>
</p>
` : '<p>This invoice is fully paid. Thank you!</p>'}

<div style="margin-top:25px; font-size:13px;">
  <strong>CONTACT DETAILS</strong><br/>

  Mailing Address: ${safeInvoice.contactDetails?.mailingAddress || DEFAULT_CONTACT_DETAILS.mailingAddress}, 
  Email Address: ${safeInvoice.contactDetails?.email || DEFAULT_CONTACT_DETAILS.email}<br/>

  Contact: AUS: ${safeInvoice.contactDetails?.contacts?.AUS || DEFAULT_CONTACT_DETAILS.contacts.AUS}; IRE: ${safeInvoice.contactDetails?.contacts?.IRE || DEFAULT_CONTACT_DETAILS.contacts.IRE}; IND: ${safeInvoice.contactDetails?.contacts?.IND || DEFAULT_CONTACT_DETAILS.contacts.IND}
</div>
    `.trim();
    window.alert(`Email HTML sent to ${safeInvoice.client.email}!\n\n---\n\n${emailBody}`);
  };

  const handleFromChange = (field, value) => setEditedInvoice(prev => ({ ...prev, from: { ...(prev.from || prev.company), [field]: value } }));
  const handleClientChange = (field, value) => setEditedInvoice(prev => ({ ...prev, client: { ...prev.client, [field]: value } }));
  const handleInfoChange = (field, value) => setEditedInvoice(prev => ({ ...prev, invoiceInfo: { ...prev.invoiceInfo, [field]: value } }));

  const handleContactDetailsChange = (field, value) => setEditedInvoice(prev => ({ ...prev, contactDetails: { ...prev.contactDetails, [field]: value } }));
  const handleContactDetailsContactChange = (region, value) => setEditedInvoice(prev => ({ ...prev, contactDetails: { ...prev.contactDetails, contacts: { ...prev.contactDetails?.contacts, [region]: value } } }));

  const handleFooterChange = (field, value) => setEditedInvoice(prev => ({ ...prev, contactDetails: { ...prev.contactDetails, [field]: value } }));

  const handleServiceChange = (id, field, value) => {
    const updatedServices = editedInvoice.services.map(s => {
      if (s.id === id) {
        const updated = { ...s, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updated.total = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.unitPrice) || 0);
        }
        return updated;
      }
      return s;
    });
    setEditedInvoice(prev => recalculateLocalTotals({ ...prev, services: updatedServices }));
  };

  const handleServiceRemove = (id) => {
    const updatedServices = editedInvoice.services.filter(s => s.id !== id);
    setEditedInvoice(prev => recalculateLocalTotals({ ...prev, services: updatedServices }));
  };

  const handleAddServiceLocal = () => {
    if (!newService.name || !newService.unitPrice) return;
    const service = { ...newService, id: `svc_${Date.now()}`, total: (parseFloat(newService.quantity) || 0) * (parseFloat(newService.unitPrice) || 0) };
    const updatedServices = [...editedInvoice.services, service];
    setEditedInvoice(prev => recalculateLocalTotals({ ...prev, services: updatedServices }));
    setNewService({ name: '', description: '', duration: 'Monthly', quantity: 1, unitPrice: 0 });
  };

  const handleSave = () => {
    if (!editedInvoice.client.businessName) {
      window.alert('Business name is required');
      return;
    }
    const updated = updateInvoice(invoice.id, editedInvoice, currentUser?.name);
    if (updated) {
      setInvoice(updated);
      setAuditLog(getInvoiceAuditLog(invoice.id));
      setEditMode('view');
    }
  };

  const handleAddPayment = () => {
    if (!newPayment.amount || newPayment.amount <= 0) return;
    const updated = addPayment(invoice.id, newPayment, currentUser?.name);
    if (updated) {
      setInvoice(updated);
      setAuditLog(getInvoiceAuditLog(invoice.id));
      setShowPaymentModal(false);
      setNewPayment({ amount: 0, method: 'stripe', notes: '' });
    }
  };

  const handleAddInstallment = () => {
    if (!newInstallment.amount || !newInstallment.dueDate) return;
    const updated = addInstallment(invoice.id, newInstallment, currentUser?.name);
    if (updated) {
      setInvoice(updated);
      setAuditLog(getInvoiceAuditLog(invoice.id));
      setShowInstallmentModal(false);
      setNewInstallment({ dueDate: '', amount: 0, method: 'stripe' });
    }
  };

  const handlePayInstallment = (installmentId) => {
    const updated = markInstallmentPaid(invoice.id, installmentId, { amount: newInstallment.amount || 0, method: newInstallment.method }, currentUser?.name);
    if (updated) {
      setInvoice(updated);
      setAuditLog(getInvoiceAuditLog(invoice.id));
    }
  };

  const handleCancelInvoice = () => {
    if (!window.confirm('Are you sure you want to cancel this invoice?')) return;
    const updated = cancelInvoice(invoice.id, currentUser?.name);
    if (updated) {
      setInvoice(updated);
      setAuditLog(getInvoiceAuditLog(invoice.id));
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'FULL': return 'badge-success';
      case 'PARTIAL': return 'badge-warning';
      case 'PENDING': return 'badge-info';
      case 'CANCELLED': return 'badge-danger';
      default: return 'badge-neutral';
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-xl" style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-header">
          <div className="modal-title">
            🧾 Invoice {invoice.invoiceNumber}
            <span className={`badge ${getStatusBadge(invoice.status)}`} style={{ marginLeft: 12 }}>
              {invoice.status}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {canEdit && invoice.status !== 'CANCELLED' && (
              <>
                {editMode === 'edit' ? (
                  <>
                    <button className="btn btn-sm btn-success" onClick={handleSave}>💾 Save</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditMode('view')}>✕ Cancel</button>
                  </>
                ) : (
                  <button className="btn btn-sm btn-outline" onClick={() => { setEditMode('edit'); setEditedInvoice(JSON.parse(JSON.stringify(invoice))); }}>✏️ Edit</button>
                )}
                <button className="btn btn-sm btn-success" disabled={editMode === 'edit'} onClick={() => setShowPaymentModal(true)}>💰 Add Payment</button>
                <button className="btn btn-sm btn-primary" disabled={editMode === 'edit'} onClick={() => setShowInstallmentModal(true)}>📅 Add Installment</button>
              </>
            )}
            <button className="btn btn-sm btn-outline" onClick={handleDownloadPDF}>📄 Download PDF</button>
            <button className="btn btn-sm btn-outline" onClick={handleSendEmail}>📧 Send via Email</button>
            {!['FULL', 'CANCELLED', 'Paid'].includes(invoice.status) && invoice.dueAmount > 0 && invoice.paymentLink && (
              <a href={invoice.paymentLink} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                <button className="btn btn-sm" style={{ background: '#635BFF', color: 'white', border: 'none' }}>💳 Pay Now</button>
              </a>
            )}
            <button className="btn btn-icon btn-ghost" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="modal-body" id="invoice-print-area" style={{ padding: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '10px', marginTop: 0 }}>
              INVOICE
            </h1>
          </div>
          {/* Invoice Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            {/* Company Details */}
            <div>
              <h4 style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>FROM</h4>
              {editMode === 'edit' ? (
                <>
                  <input className="form-control" style={{ marginBottom: 4, fontWeight: 700 }} value={editedInvoice.from?.name || editedInvoice.company?.name || ''} onChange={e => handleFromChange('name', e.target.value)} />
                  <input className="form-control" style={{ marginBottom: 4, fontSize: 12 }} value={editedInvoice.from?.address || editedInvoice.company?.address || ''} onChange={e => handleFromChange('address', e.target.value)} />
                  <input className="form-control" style={{ marginBottom: 4, fontSize: 12 }} value={editedInvoice.from?.email || editedInvoice.company?.email || ''} onChange={e => handleFromChange('email', e.target.value)} />
                  <input className="form-control" style={{ fontSize: 12 }} value={editedInvoice.from?.phone || editedInvoice.company?.phone || ''} onChange={e => handleFromChange('phone', e.target.value)} />
                </>
              ) : (
                <div>
                  <strong>{invoice.from?.name || invoice.company?.name}</strong><br />
                  {invoice.from?.address || invoice.company?.address}<br />
                  Email: {invoice.from?.email || invoice.company?.email}<br />
                  Phone: {invoice.from?.phone || invoice.company?.phone}
                </div>
              )}
            </div>

            {/* Client Details */}
            <div>
              <h4 style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>BILL TO</h4>
              {editMode === 'edit' ? (
                <>
                  <input className="form-control" style={{ marginBottom: 4, fontWeight: 700 }} placeholder="Business Name" value={editedInvoice.client.businessName} onChange={e => handleClientChange('businessName', e.target.value)} />
                  <input className="form-control" style={{ marginBottom: 4, fontSize: 12 }} placeholder="Contact Name" value={editedInvoice.client.contactName} onChange={e => handleClientChange('contactName', e.target.value)} />
                  <input className="form-control" style={{ marginBottom: 4, fontSize: 12 }} placeholder="Email" value={editedInvoice.client.email} onChange={e => handleClientChange('email', e.target.value)} />
                  <input className="form-control" style={{ marginBottom: 4, fontSize: 12 }} placeholder="Phone" value={editedInvoice.client.phone} onChange={e => handleClientChange('phone', e.target.value)} />
                  <input className="form-control" style={{ marginBottom: 4, fontSize: 12 }} placeholder="Address Line 1" value={editedInvoice.client.addressLine1} onChange={e => handleClientChange('addressLine1', e.target.value)} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
                    <input className="form-control" style={{ fontSize: 12 }} placeholder="City" value={editedInvoice.client.city} onChange={e => handleClientChange('city', e.target.value)} />
                    <input className="form-control" style={{ fontSize: 12 }} placeholder="State / County" value={editedInvoice.client.state} onChange={e => handleClientChange('state', e.target.value)} />
                  </div>
                  <input className="form-control" style={{ fontSize: 12 }} placeholder="Country" value={editedInvoice.client.country} onChange={e => handleClientChange('country', e.target.value)} />
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{invoice.client.businessName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {invoice.client.contactName && <span>{invoice.client.contactName}<br /></span>}
                    {invoice.client.email && <span>{invoice.client.email}<br /></span>}
                    {invoice.client.phone && <span>{invoice.client.phone}<br /></span>}
                    <div style={{ marginTop: 8 }}>
                      {invoice.client.addressLine1 && <span>{invoice.client.addressLine1}<br /></span>}
                      {invoice.client.city && <span>{invoice.client.city}<br /></span>}
                      {invoice.client.state && <span>{invoice.client.state}<br /></span>}
                      {invoice.client.country && <span>{invoice.client.country}</span>}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Invoice Info */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24, padding: 16, background: 'var(--bg-secondary)', borderRadius: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Invoice Date</div>
              {editMode === 'edit' ? (
                <input type="date" className="form-control" style={{ fontSize: 13 }} value={editedInvoice.invoiceInfo.invoiceDate} onChange={e => handleInfoChange('invoiceDate', e.target.value)} />
              ) : (
                <div style={{ fontWeight: 600 }}>{invoice.invoiceInfo.invoiceDate}</div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Due Date</div>
              {editMode === 'edit' ? (
                <input type="date" className="form-control" style={{ fontSize: 13 }} value={editedInvoice.invoiceInfo.dueDate} onChange={e => handleInfoChange('dueDate', e.target.value)} />
              ) : (
                <div style={{ fontWeight: 600 }}>{invoice.invoiceInfo.dueDate}</div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Currency</div>
              {editMode === 'edit' ? (
                <select className="form-control" style={{ fontSize: 13 }} value={editedInvoice.invoiceInfo.currency} onChange={e => handleInfoChange('currency', e.target.value)}>
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
                </select>
              ) : (
                <div style={{ fontWeight: 600 }}>{invoice.invoiceInfo.currency}</div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Amount</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--primary)' }}>
                {formatInvoiceAmount(editMode === 'edit' ? editedInvoice.totalAmount : invoice.totalAmount, editMode === 'edit' ? editedInvoice.invoiceInfo.currency : invoice.invoiceInfo.currency)}
              </div>
            </div>
          </div>

          {/* Services Table */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0 }}>💼 Services</h4>
            </div>
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Service</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Duration</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Qty</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Unit Price</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                  {isAccounts && editMode === 'edit' && <th style={{ padding: '8px 12px', width: 50 }}></th>}
                </tr>
              </thead>
              <tbody>
                {(editMode === 'edit' ? editedInvoice : invoice).services.map(service => (
                  <tr key={service.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '12px' }}>
                      {editMode === 'edit' ? (
                        <>
                          <input className="form-control" style={{ marginBottom: 4, fontWeight: 600 }} value={service.name} onChange={e => handleServiceChange(service.id, 'name', e.target.value)} />
                          <input className="form-control" style={{ fontSize: 11 }} value={service.description} onChange={e => handleServiceChange(service.id, 'description', e.target.value)} />
                        </>
                      ) : (
                        <>
                          <div style={{ fontWeight: 600 }}>{service.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{service.description}</div>
                        </>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {editMode === 'edit' ? (
                        <input className="form-control" value={service.duration} onChange={e => handleServiceChange(service.id, 'duration', e.target.value)} />
                      ) : (
                        service.duration
                      )}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      {editMode === 'edit' ? (
                        <input className="form-control" type="number" style={{ textAlign: 'right' }} value={service.quantity} onChange={e => handleServiceChange(service.id, 'quantity', e.target.value)} />
                      ) : (
                        service.quantity
                      )}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      {editMode === 'edit' ? (
                        <input className="form-control" type="number" style={{ textAlign: 'right' }} value={service.unitPrice} onChange={e => handleServiceChange(service.id, 'unitPrice', e.target.value)} />
                      ) : (
                        formatInvoiceAmount(service.unitPrice, invoice.invoiceInfo.currency)
                      )}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>
                      {formatInvoiceAmount(service.total, (editMode === 'edit' ? editedInvoice : invoice).invoiceInfo.currency)}
                    </td>
                    {isAccounts && editMode === 'edit' && (
                      <td style={{ padding: '12px' }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => handleServiceRemove(service.id)}>🗑️</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Add Service Form */}
            {isAccounts && editMode === 'edit' && (
              <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                  <input className="form-control" placeholder="Service name" value={newService.name} onChange={e => setNewService(p => ({ ...p, name: e.target.value }))} />
                  <input className="form-control" placeholder="Duration" value={newService.duration} onChange={e => setNewService(p => ({ ...p, duration: e.target.value }))} />
                  <input className="form-control" type="number" placeholder="Qty" value={newService.quantity} onChange={e => setNewService(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} />
                  <input className="form-control" type="number" placeholder="Price" value={newService.unitPrice} onChange={e => setNewService(p => ({ ...p, unitPrice: parseFloat(e.target.value) || 0 }))} />
                  <button className="btn btn-success btn-sm" onClick={handleAddServiceLocal}>Add</button>
                </div>
              </div>
            )}
          </div>

          {/* Amount Summary */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
            <div style={{ width: '350px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                <span>Subtotal</span>
                <span>{formatInvoiceAmount((editMode === 'edit' ? editedInvoice : invoice).amountSummary.subtotal, (editMode === 'edit' ? editedInvoice : invoice).invoiceInfo.currency)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontWeight: 700, fontSize: 16 }}>
                <span>Total</span>
                <span style={{ color: 'var(--primary)' }}>{formatInvoiceAmount((editMode === 'edit' ? editedInvoice : invoice).amountSummary.grandTotal, (editMode === 'edit' ? editedInvoice : invoice).invoiceInfo.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid var(--border-color)' }}>
                <span>Paid</span>
                <span style={{ color: 'var(--success)' }}>{formatInvoiceAmount((editMode === 'edit' ? editedInvoice : invoice).paidAmount, (editMode === 'edit' ? editedInvoice : invoice).invoiceInfo.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 700 }}>
                <span>Due</span>
                <span style={{ color: (editMode === 'edit' ? editedInvoice : invoice).dueAmount > 0 ? 'var(--danger)' : 'var(--success)' }}>{formatInvoiceAmount((editMode === 'edit' ? editedInvoice : invoice).dueAmount, (editMode === 'edit' ? editedInvoice : invoice).invoiceInfo.currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          {editMode === 'edit' ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Notes</div>
                <textarea className="form-control" style={{ width: '100%', minHeight: 60, fontSize: 12 }} value={editedInvoice.notes} onChange={e => setEditedInvoice(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Terms</div>
                <textarea className="form-control" style={{ width: '100%', minHeight: 40, fontSize: 12 }} value={editedInvoice.terms} onChange={e => setEditedInvoice(p => ({ ...p, terms: e.target.value }))} />
              </div>
            </>
          ) : (
            <>
              {invoice.notes && (
                <div style={{ marginBottom: 16, padding: 16, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Notes</div>
                  <div style={{ fontSize: 12 }}>{invoice.notes}</div>
                </div>
              )}
              {invoice.terms && (
                <div style={{ marginBottom: 16, fontSize: 11, color: 'var(--text-muted)' }}>
                  <strong>Terms:</strong> {invoice.terms}
                </div>
              )}
            </>
          )}

          {/* Amount Due Highlight Block */}
          {editMode !== 'edit' && invoice.dueAmount > 0 && (
            <div style={{ marginTop: '20px', padding: '12px', border: '2px solid #f0c040', background: '#fff8e5' }}>
              <p style={{ fontSize: '16px', fontWeight: 'bold', margin: '0' }}>
                Amount Due: {formatInvoiceAmount(invoice.dueAmount, invoice.invoiceInfo.currency)}
              </p>
              <p style={{ fontSize: '14px', fontWeight: 'bold', margin: '5px 0 0 0' }}>
                Due Date: {invoice.invoiceInfo.dueDate}
              </p>
            </div>
          )}

          {/* Clickable PDF Payment Link (Only active in View Mode if Due Amount > 0) */}
          {editMode !== 'edit' && invoice.dueAmount > 0 && invoice.paymentLink && (
            <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, textAlign: 'center' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: 16 }}><strong>Pay Now:</strong></p>
              <a href={invoice.paymentLink} target="_blank" rel="noreferrer" style={{ color: '#0E5491', fontWeight: 'bold', fontSize: 14 }}>
                Click here to complete your payment securely via Stripe
              </a>
            </div>
          )}

          {/* Payment History */}
          {invoice.payments.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ marginBottom: 12 }}>💳 Payment History</h4>
              <table style={{ width: '100%', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.payments.map(payment => (
                    <tr key={payment.id}>
                      <td>{new Date(payment.paidAt).toLocaleDateString('en-IN')}</td>
                      <td style={{ fontWeight: 600, color: 'var(--success)' }}>{formatInvoiceAmount(payment.amount, invoice.invoiceInfo.currency)}</td>
                      <td>{PAYMENT_METHODS.find(m => m.id === payment.method)?.name || payment.method}</td>
                      <td>{payment.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Installments */}
          {invoice.installments.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ marginBottom: 12 }}>📅 Installment Schedule</h4>
              <table style={{ width: '100%', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    <th>Due Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.installments.map(inst => (
                    <tr key={inst.id}>
                      <td>{inst.dueDate}</td>
                      <td style={{ fontWeight: 600 }}>{formatInvoiceAmount(inst.amount, invoice.invoiceInfo.currency)}</td>
                      <td>
                        <span className={`badge ${inst.status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>
                          {inst.status}
                        </span>
                      </td>
                      <td>
                        {inst.status !== 'PAID' && canEdit && (
                          <button className="btn btn-sm btn-success" onClick={() => handlePayInstallment(inst.id)}>Mark Paid</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}


          {/* CONTACT DETAILS FOOTER */}
          <div style={{ marginTop: '30px', fontSize: '13px' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>
              CONTACT DETAILS
            </p>
            {editMode === 'edit' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input className="form-control" placeholder="Mailing Address" value={editedInvoice.contactDetails?.mailingAddress || DEFAULT_CONTACT_DETAILS.mailingAddress} onChange={e => handleContactDetailsChange('mailingAddress', e.target.value)} />
                <input className="form-control" placeholder="Email Address" value={editedInvoice.contactDetails?.email || DEFAULT_CONTACT_DETAILS.email} onChange={e => handleContactDetailsChange('email', e.target.value)} />
                <input className="form-control" placeholder="Contact AUS" value={editedInvoice.contactDetails?.contacts?.AUS || DEFAULT_CONTACT_DETAILS.contacts.AUS} onChange={e => handleContactDetailsContactChange('AUS', e.target.value)} />
                <input className="form-control" placeholder="Contact IRE" value={editedInvoice.contactDetails?.contacts?.IRE || DEFAULT_CONTACT_DETAILS.contacts.IRE} onChange={e => handleContactDetailsContactChange('IRE', e.target.value)} />
                <input className="form-control" placeholder="Contact IND" value={editedInvoice.contactDetails?.contacts?.IND || DEFAULT_CONTACT_DETAILS.contacts.IND} onChange={e => handleContactDetailsContactChange('IND', e.target.value)} />
              </div>
            ) : (
              <>
                <p style={{ margin: 0 }}>
                  <strong>Mailing Address:</strong> {invoice.contactDetails?.mailingAddress || DEFAULT_CONTACT_DETAILS.mailingAddress},{" "}
                  <strong>Email Address:</strong> {invoice.contactDetails?.email || DEFAULT_CONTACT_DETAILS.email}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Contact:</strong> AUS: {invoice.contactDetails?.contacts?.AUS || DEFAULT_CONTACT_DETAILS.contacts.AUS}; 
                  IRE: {invoice.contactDetails?.contacts?.IRE || DEFAULT_CONTACT_DETAILS.contacts.IRE}; 
                  IND: {invoice.contactDetails?.contacts?.IND || DEFAULT_CONTACT_DETAILS.contacts.IND}
                </p>
              </>
            )}
          </div>

        </div>

        {/* Audit Log (Internal Only) */}
        {isAccounts && auditLog.length > 0 && (
          <div style={{ padding: '0 24px 24px' }}>
            <div style={{ marginTop: 24, paddingTop: 24, borderTop: '2px dashed var(--border-color)' }}>
              <h4 style={{ marginBottom: 12 }}>📋 Audit Log (Internal Only)</h4>
              <div style={{ maxHeight: 150, overflow: 'auto', fontSize: 11 }}>
                {auditLog.map(log => (
                  <div key={log.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{new Date(log.changedAt).toLocaleString('en-IN')}</span>
                    {' - '}
                    <span style={{ fontWeight: 600 }}>{log.changedBy}</span>
                    {' - '}
                    {log.action === 'UPDATE' ? `${log.field}: ${JSON.stringify(log.oldValue)} → ${JSON.stringify(log.newValue)}` : log.action}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          {isAccounts && invoice.status !== 'CANCELLED' && (
            <button className="btn btn-danger" onClick={handleCancelInvoice}>Cancel Invoice</button>
          )}
        </div>
      </div>

      {/* Add Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay">
          <div className="modal modal-sm">
            <div className="modal-header">
              <div className="modal-title">💰 Add Payment</div>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowPaymentModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input className="form-control" type="number" value={newPayment.amount} onChange={e => setNewPayment(p => ({ ...p, amount: parseFloat(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select className="form-control" value={newPayment.method} onChange={e => setNewPayment(p => ({ ...p, method: e.target.value }))}>
                  {PAYMENT_METHODS.map(m => (
                    <option key={m.id} value={m.id}>{m.icon} {m.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-control" value={newPayment.notes} onChange={e => setNewPayment(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowPaymentModal(false)}>Cancel</button>
              <button className="btn btn-success" onClick={handleAddPayment}>Add Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Installment Modal */}
      {showInstallmentModal && (
        <div className="modal-overlay">
          <div className="modal modal-sm">
            <div className="modal-header">
              <div className="modal-title">📅 Add Installment</div>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowInstallmentModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input className="form-control" type="date" value={newInstallment.dueDate} onChange={e => setNewInstallment(p => ({ ...p, dueDate: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input className="form-control" type="number" value={newInstallment.amount} onChange={e => setNewInstallment(p => ({ ...p, amount: parseFloat(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select className="form-control" value={newInstallment.method} onChange={e => setNewInstallment(p => ({ ...p, method: e.target.value }))}>
                  {PAYMENT_METHODS.map(m => (
                    <option key={m.id} value={m.id}>{m.icon} {m.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowInstallmentModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddInstallment}>Add Installment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceView;
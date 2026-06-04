import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatInvoiceAmount, PAYMENT_METHODS, COMPANY_INFO, getInvoice, updateInvoice, addServiceItem, updateServiceItem, removeServiceItem, addPayment, addInstallment, markInstallmentPaid, getInvoiceAuditLog, cancelInvoice, getCustomerInvoice, DEFAULT_CONTACT_DETAILS, buildInvoiceEmailHtml } from '../services/invoiceService';
import { CURRENCIES } from '../services/currencyService';
import { ROLES } from '../data/mockData';
import html2pdf from 'html2pdf.js';
import { encrypt, decrypt } from '../services/cryptoService';
import { getActiveBackendUsers, getProjectClientDetails } from '../services/assignmentService';
import EmailComposer from './EmailComposer';
import MultiAssignTeamMember from './MultiAssignTeamMember';

const InvoiceView = ({ invoiceId, onClose, initialEditMode = false, initialShowAssign = false }) => {
  const { currentUser, allProjects, allSales, allLeads, createProject, updateProject, addNotification, allUsers, refreshInvoices, updateSale } = useApp();
  const [invoice, setInvoice] = useState(null);
  const [editedInvoice, setEditedInvoice] = useState(null);
  const [editMode, setEditMode] = useState(initialEditMode ? 'edit' : 'view');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [auditLog, setAuditLog] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [showAssignProject, setShowAssignProject] = useState(initialShowAssign);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [invoicePdfBase64, setInvoicePdfBase64] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [newService, setNewService] = useState({ name: '', description: '', duration: 'Monthly', quantity: 1, unitPrice: 0 });
  const [newPayment, setNewPayment] = useState({ amount: 0, method: 'stripe', notes: '' });
  const [newInstallment, setNewInstallment] = useState({ dueDate: '', amount: 0, method: 'stripe' });
  const [alertModal, setAlertModal] = useState(null);

  // Assignment states
  const [availableBackendUsers, setAvailableBackendUsers] = useState([]);
  const [isFetchingBackend, setIsFetchingBackend] = useState(false);
  const [clientDetails, setClientDetails] = useState(null);
  const [isFetchingClient, setIsFetchingClient] = useState(false);
  const [assignmentSuccess, setAssignmentSuccess] = useState('');

  const [assignForm, setAssignForm] = useState({
    assignedMembers: [],
    assignedTo: '',
    assignedToName: '',
    googleProfileLink: '',
    websiteLink: '',
    wpUrl: '',
    wpUsername: '',
    wpPassword: '',
    domainProvider: '',
    domainUsername: '',
    domainPassword: '',
    cpanelUser: '',
    cpanelPass: '',
    facebookPage: '',
    fbUsername: '',
    fbPassword: '',
    instagramUsername: '',
    instagramPassword: '',
    youtubeChannel: '',
    ytUsername: '',
    ytPassword: '',
    gmailAcc: '',
    gmailPassword: '',
  });
  const [showPassword, setShowPassword] = useState({});

  useEffect(() => {
    if (showAssignProject && invoice) {
      setAssignmentSuccess('');
      setIsFetchingBackend(true);
      setIsFetchingClient(true);

      getActiveBackendUsers()
        .then(users => {
          setAvailableBackendUsers(users);
          setIsFetchingBackend(false);
        })
        .catch(err => {
          console.error('Failed to fetch backend users', err);
          setIsFetchingBackend(false);
        });

      getProjectClientDetails(invoice.id)
        .then(details => {
          setClientDetails(details);
          setIsFetchingClient(false);
        })
        .catch(err => {
          console.error('Failed to fetch client details', err);
          setIsFetchingClient(false);
        });

      const existingProject = allProjects?.find(p => p.saleId === invoice.saleId);
      if (existingProject) {
        setAssignForm({
          assignedMembers: existingProject.assignedMembers || (existingProject.assignedTo ? [existingProject.assignedTo] : []),
          assignedTo: existingProject.assignedTo || '',
          assignedToName: existingProject.assignedToName || '',
          googleProfileLink: existingProject.googleProfileLink || '',
          websiteLink: existingProject.websiteLink || '',
          wpUrl: existingProject.wpUrl || '',
          wpUsername: existingProject.wpUsername || '',
          wpPassword: existingProject.wpPassword ? decrypt(existingProject.wpPassword) : '',
          domainProvider: existingProject.domainRegistrar || '',
          domainUsername: existingProject.domainUsername || '',
          domainPassword: existingProject.domainPassword ? decrypt(existingProject.domainPassword) : '',
          cpanelUser: existingProject.cpanelUser || '',
          cpanelPass: existingProject.cpanelPass ? decrypt(existingProject.cpanelPass) : '',
          facebookPage: existingProject.facebookPage || '',
          fbUsername: existingProject.fbUsername || '',
          fbPassword: existingProject.fbPassword ? decrypt(existingProject.fbPassword) : '',
          instagramUsername: existingProject.instagramUsername || '',
          instagramPassword: existingProject.instagramPassword ? decrypt(existingProject.instagramPassword) : '',
          youtubeChannel: existingProject.youtubeChannel || '',
          ytUsername: existingProject.ytUsername || '',
          ytPassword: existingProject.ytPassword ? decrypt(existingProject.ytPassword) : '',
          gmailAcc: existingProject.gmailAcc || '',
          gmailPassword: existingProject.gmailPassword ? decrypt(existingProject.gmailPassword) : '',
        });
      }
    }
  }, [showAssignProject, invoice, allProjects]);

  const canEdit = ['Accounts', 'Admin', 'Sales Agent'].includes(currentUser?.role);
  const isAccounts = ['Accounts', 'Admin'].includes(currentUser?.role);

  useEffect(() => {
    const inv = getInvoice(invoiceId);
    setInvoice(inv);
    if (inv) {
      setAuditLog(getInvoiceAuditLog(invoiceId));
      if (initialEditMode) {
        setEditedInvoice(JSON.parse(JSON.stringify(inv)));
      }
    }
  }, [invoiceId, initialEditMode]);

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
    const subtotal = Number(invoiceCopy.services.reduce((sum, s) => sum + ((parseFloat(s.quantity) || 0) * (parseFloat(s.unitPrice) || 0)), 0).toFixed(2));
    const taxAmount = Number(invoiceCopy.services.reduce((sum, s) => sum + (((parseFloat(s.quantity) || 0) * (parseFloat(s.unitPrice) || 0) * (parseFloat(s.taxRate) || 0)) / 100), 0).toFixed(2));
    const discountAmount = Number((parseFloat(invoiceCopy.amountSummary?.discountAmount) || 0).toFixed(2));
    const additionalChargesTotal = Number((invoiceCopy.amountSummary?.additionalCharges || []).reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0).toFixed(2));
    
    const grandTotal = Number(Math.max(0, subtotal + taxAmount + additionalChargesTotal - discountAmount).toFixed(2));

    invoiceCopy.amountSummary = {
      ...invoiceCopy.amountSummary,
      subtotal,
      discountAmount,
      taxAmount,
      additionalChargesTotal,
      grandTotal,
    };
    invoiceCopy.totalAmount = grandTotal;
    invoiceCopy.dueAmount = Math.max(0, grandTotal - (invoiceCopy.paidAmount || 0));
    
    if (invoiceCopy.dueAmount <= 0) {
      invoiceCopy.stripe_payment_link_url = null;
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
    if (!invoice.client?.email) {
      setAlertModal({ title: '⚠️ Missing Email', message: 'Client has no BILL TO email address specified.' });
      return;
    }
    
    setIsGeneratingPdf(true);
    const element = document.getElementById('invoice-print-area');
    if (!element) {
      console.error('Invoice print area element not found!');
      setIsGeneratingPdf(false);
      setShowEmailComposer(true);
      return;
    }

    const opt = {
      margin: 0.5,
      filename: `Invoice_${invoice.invoiceNumber || invoice.id}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    html2pdf()
      .set(opt)
      .from(element)
      .outputPdf('datauristring')
      .then((pdfDataUri) => {
        const base64String = pdfDataUri.split(',')[1];
        setInvoicePdfBase64(base64String);
        setShowEmailComposer(true);
        setIsGeneratingPdf(false);
      })
      .catch((err) => {
        console.error('PDF generation failed:', err);
        setShowEmailComposer(true);
        setIsGeneratingPdf(false);
      });
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
        if (['quantity', 'unitPrice', 'taxRate'].includes(field)) {
          const qty = parseFloat(updated.quantity) || 0;
          const price = parseFloat(updated.unitPrice) || 0;
          const tax = parseFloat(updated.taxRate) || 0;
          updated.total = qty * price * (1 + tax / 100);
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
    const qty = parseFloat(newService.quantity) || 0;
    const price = parseFloat(newService.unitPrice) || 0;
    const tax = parseFloat(newService.taxRate) || 0;
    const service = { ...newService, id: `svc_${Date.now()}`, total: qty * price * (1 + tax / 100) };
    const updatedServices = [...editedInvoice.services, service];
    setEditedInvoice(prev => recalculateLocalTotals({ ...prev, services: updatedServices }));
    setNewService({ name: '', description: '', duration: 'Monthly', quantity: 1, unitPrice: 0, taxRate: 0 });
  };

  const handleSave = () => {
    if (!editedInvoice.client.businessName) {
      setAlertModal({ title: '⚠️ Validation', message: 'Business name is required' });
      return;
    }
    
    setIsSaving(true);
    setTimeout(() => {
      try {
        const updated = updateInvoice(invoice.id, editedInvoice, currentUser?.name);
        if (updated) {
          if (invoice.saleId && editedInvoice.lockedTotal !== undefined) {
            updateSale(invoice.saleId, { amount: editedInvoice.lockedTotal, totalAmount: editedInvoice.lockedTotal });
          }
          setInvoice(updated);
          setAuditLog(getInvoiceAuditLog(invoice.id));
          setEditMode('view');
          setSaveSuccess('Invoice saved successfully!');
          setTimeout(() => setSaveSuccess(''), 3000);
        }
      } catch (err) {
        setAlertModal({ title: '❌ Save Failed', message: 'Save failed: ' + err.message });
      } finally {
        setIsSaving(false);
      }
    }, 600);
  };

  const handleAddPayment = () => {
    if (!newPayment.amount || newPayment.amount <= 0) return;
    
    let updated;
    if (invoice.installments && invoice.installments.length > 0) {
      const currentInst = invoice.installments[0];
      updated = markInstallmentPaid(invoice.id, currentInst.id, newPayment, currentUser?.name);
    } else {
      updated = addPayment(invoice.id, newPayment, currentUser?.name);
    }

    if (updated) {
      if (invoice.saleId) {
        updateSale(invoice.saleId, {
          amount: updated.paidAmount,
          totalAmount: updated.paidAmount,
          saleStatus: updated.dueAmount <= 0 ? 'Closed' : 'Pending',
        });
      }
      setInvoice(updated);
      setAuditLog(getInvoiceAuditLog(invoice.id));
      setShowPaymentModal(false);
      setNewPayment({ amount: 0, method: 'stripe', notes: '' });
      if (refreshInvoices) refreshInvoices();
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

  // Installment progress calculation
  const installmentProgress = (() => {
    if (invoice.installments.length === 0) return null;
    const saleTotal = invoice.saleTotalAmount || invoice.totalAmount;
    const paidAmount = invoice.installments
      .filter(i => i.status === 'PAID')
      .reduce((sum, i) => sum + (i.paidAmount || i.amount), 0);
    const remainingAmount = Math.max(0, saleTotal - paidAmount);
    const paidCount = invoice.installments.filter(i => i.status === 'PAID').length;
    const totalCount = invoice.installments.length;
    const nextDue = invoice.installments.find(i => i.status !== 'PAID');
    const progressPercent = saleTotal > 0 ? (paidAmount / saleTotal) * 100 : 0;
    return { saleTotal, paidAmount, remainingAmount, paidCount, totalCount, nextDue, progressPercent };
  })();

  const handlePayInstallment = (installmentId) => {
    const inst = invoice.installments.find(i => i.id === installmentId);
    if (!inst) return;
    
    // Use a default method if newInstallment.method is not set
    const method = newInstallment.method || 'stripe';
    
    const updated = markInstallmentPaid(invoice.id, installmentId, { amount: inst.amount, method }, currentUser?.name);
    if (updated) {
      setInvoice(updated);
      setAuditLog(getInvoiceAuditLog(invoice.id));
      setSaveSuccess(`Installment ${inst.installment_number} marked as paid!`);
      setTimeout(() => setSaveSuccess(''), 3000);
      if (refreshInvoices) refreshInvoices();
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
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center' }}>
            🧾 Invoice 
            {editMode === 'edit' ? (
              <input className="form-control" style={{ marginLeft: 8, width: 120, fontSize: 16, fontWeight: 'bold' }} value={editedInvoice.invoiceNumber || editedInvoice.id} onChange={e => setEditedInvoice(p => ({ ...p, invoiceNumber: e.target.value }))} />
            ) : (
              <span style={{ marginLeft: 8 }}>{invoice.invoiceNumber || invoice.id}</span>
            )}
            {editMode !== 'edit' && (
              <span className={`badge ${getStatusBadge(invoice.status)}`} style={{ marginLeft: 12 }}>
                {invoice.status}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {canEdit && invoice.status !== 'CANCELLED' && (
              <>
                {editMode === 'edit' ? (
                  <>
                    <button className="btn btn-sm btn-success" onClick={handleSave} disabled={isSaving}>
                      {isSaving ? <span className="spinner" style={{ marginRight: 8 }}>🔄</span> : '💾 '}
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditMode('view')} disabled={isSaving}>✕ Cancel</button>
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
            {!['FULL', 'CANCELLED', 'Paid'].includes(invoice.status) && invoice.dueAmount > 0 && invoice.stripe_payment_link_url && (
              <a href={invoice.stripe_payment_link_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                <button className="btn btn-sm" style={{ background: '#635BFF', color: 'white', border: 'none' }}>💳 Pay Now</button>
              </a>
            )}
            {['FULL', 'PARTIAL', 'Paid'].includes(invoice.status) && (() => {
              const sale = allSales?.find(s => s.id === invoice.saleId);
              const project = allProjects?.find(p => p.saleId === invoice.saleId);
              const isAssigned = (project?.assignedTo && project.assignedTo !== null && project.assignedToName !== 'Unassigned') || (project?.assignedMembers && project.assignedMembers.length > 0);
              return (
                <button className="btn btn-sm btn-primary" onClick={() => setShowAssignProject(true)}>
                  {isAssigned ? '✏️ Manage Assignment' : '👨‍💻 Assign Project'}
                </button>
              );
            })()}
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

            {saveSuccess && (
            <div style={{ padding: 12, background: 'var(--success-light)', color: 'var(--success)', borderRadius: 8, marginBottom: 16, fontWeight: 600 }}>
              ✅ {saveSuccess}
            </div>
          )}

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
                    <input className="form-control" style={{ fontSize: 12 }} placeholder="Province / State" value={editedInvoice.client.state} onChange={e => handleClientChange('state', e.target.value)} />
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

          {/* Sales Information */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24, padding: 16, background: 'var(--bg-secondary)', borderRadius: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Linked Sale</div>
              {editMode === 'edit' ? (
                <select className="form-control" style={{ fontSize: 13 }} value={editedInvoice.saleId || ''} onChange={e => setEditedInvoice(p => ({ ...p, saleId: parseInt(e.target.value) || null }))}>
                  <option value="">No Linked Sale</option>
                  {allSales?.map(s => <option key={s.id} value={s.id}>#{s.id} - {s.businessName}</option>)}
                </select>
              ) : (
                <div style={{ fontWeight: 600 }}>{invoice.saleId ? `#${invoice.saleId} - ${allSales?.find(s => s.id === invoice.saleId)?.businessName || 'Unknown'}` : 'None'}</div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sales Agent</div>
              {editMode === 'edit' ? (
                <select className="form-control" style={{ fontSize: 13 }} value={editedInvoice.createdBy || ''} onChange={e => setEditedInvoice(p => ({ ...p, createdBy: parseInt(e.target.value) || null }))}>
                  <option value="">Unassigned</option>
                  {allUsers?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              ) : (
                <div style={{ fontWeight: 600 }}>{allUsers?.find(u => u.id === invoice.createdBy)?.name || 'System / Unassigned'}</div>
              )}
            </div>
          </div>

          {/* Invoice Info */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24, padding: 16, background: 'var(--bg-secondary)', borderRadius: 8 }}>
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
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Status</div>
              {editMode === 'edit' ? (
                <select className="form-control" style={{ fontSize: 13 }} value={editedInvoice.status} onChange={e => setEditedInvoice(p => ({ ...p, status: e.target.value }))}>
                  {['PENDING', 'PARTIAL', 'FULL', 'CANCELLED'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <div style={{ fontWeight: 600 }}>{invoice.status}</div>
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
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Tax %</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                  {canEdit && editMode === 'edit' && <th style={{ padding: '8px 12px', width: 50 }}></th>}
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
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      {editMode === 'edit' ? (
                        <input className="form-control" type="number" style={{ textAlign: 'right' }} value={service.taxRate || 0} onChange={e => handleServiceChange(service.id, 'taxRate', e.target.value)} />
                      ) : (
                        `${service.taxRate || 0}%`
                      )}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>
                      {formatInvoiceAmount(service.total, (editMode === 'edit' ? editedInvoice : invoice).invoiceInfo.currency)}
                    </td>
                    {canEdit && editMode === 'edit' && (
                      <td style={{ padding: '12px' }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => handleServiceRemove(service.id)}>🗑️</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Add Service Form */}
            {canEdit && editMode === 'edit' && (
              <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                  <input className="form-control" placeholder="Service name" value={newService.name} onChange={e => setNewService(p => ({ ...p, name: e.target.value }))} />
                  <input className="form-control" placeholder="Duration" value={newService.duration} onChange={e => setNewService(p => ({ ...p, duration: e.target.value }))} />
                  <input className="form-control" type="number" placeholder="Qty" value={newService.quantity} onChange={e => setNewService(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} />
                  <input className="form-control" type="number" placeholder="Price" value={newService.unitPrice} onChange={e => setNewService(p => ({ ...p, unitPrice: parseFloat(e.target.value) || 0 }))} />
                  <input className="form-control" type="number" placeholder="Tax %" value={newService.taxRate || ''} onChange={e => setNewService(p => ({ ...p, taxRate: parseFloat(e.target.value) || 0 }))} />
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
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                <span>Tax</span>
                <span>{formatInvoiceAmount((editMode === 'edit' ? editedInvoice : invoice).amountSummary.taxAmount, (editMode === 'edit' ? editedInvoice : invoice).invoiceInfo.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                <span>Discount</span>
                {editMode === 'edit' ? (
                  <input className="form-control" type="number" style={{ width: 100, textAlign: 'right' }} value={editedInvoice.amountSummary.discountAmount || 0} onChange={e => handleAmountSummaryChange('discountAmount', parseFloat(e.target.value) || 0)} />
                ) : (
                  <span style={{ color: 'var(--danger)' }}>-{formatInvoiceAmount(invoice.amountSummary.discountAmount || 0, invoice.invoiceInfo.currency)}</span>
                )}
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
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Notes</div>
                <textarea className="form-control remark-textarea" style={{ width: '100%', minHeight: 60 }} value={editedInvoice.notes} onChange={e => setEditedInvoice(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Terms</div>
                <textarea className="form-control remark-textarea" style={{ width: '100%', minHeight: 40 }} value={editedInvoice.terms} onChange={e => setEditedInvoice(p => ({ ...p, terms: e.target.value }))} />
              </div>
            </>
          ) : (
            <>
              {invoice.notes && (
                <div className="remark-item">
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Notes</div>
                  <div className="remark-text">{invoice.notes}</div>
                </div>
              )}
              {invoice.terms && (
                <div style={{ marginBottom: 16, fontSize: 11, color: 'var(--text-muted)' }}>
                  <strong>Terms:</strong> {invoice.terms}
                </div>
              )}
            </>
          )}

          {/* Installment Info Block */}
          {!['edit'].includes(editMode) && invoice.saleId && invoice.installments?.length > 0 && (
            (() => {
              const sale = allSales?.find(s => s.id === invoice.saleId);
              if (!sale || !sale.installmentPlan || sale.installmentPlan.length <= 1) return null;
              
              const currentInst = invoice.installments[0];
              const nextInst = sale.installmentPlan.find(i => i.installment_number === currentInst.installment_number + 1);
              
              const totalPaid = sale.installmentPlan.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
              const remaining = Math.max(0, sale.totalAmount - totalPaid);
              
              return (
                <div style={{ marginTop: '20px', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-secondary)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--primary)' }}>💳 Installment Details</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Progress</div>
                      <div style={{ fontWeight: 600 }}>{currentInst.installment_number} of {sale.installmentPlan.length}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Current Due</div>
                      <div style={{ fontWeight: 600 }}>{formatInvoiceAmount(currentInst.amount, invoice.invoiceInfo.currency)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Next Due Date</div>
                      <div style={{ fontWeight: 600 }}>{nextInst ? nextInst.due_date : 'None'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Remaining Balance</div>
                      <div style={{ fontWeight: 600, color: remaining > 0 ? 'var(--danger)' : 'var(--success)' }}>{formatInvoiceAmount(remaining, invoice.invoiceInfo.currency)}</div>
                    </div>
                  </div>
                </div>
              );
            })()
          )}

          {/* Amount Due Highlight Block */}
          {editMode !== 'edit' && invoice.dueAmount > 0 && (
            (() => {
              const hasInstallments = invoice.installments && invoice.installments.length > 0;
              const isFirstInstDue = hasInstallments && invoice.installments[0].status !== 'PAID';
              
              if (isFirstInstDue) {
                return (
                  <div style={{ 
                    marginTop: '20px', 
                    padding: '16px 20px', 
                    border: '1.5px solid var(--primary)', 
                    background: 'linear-gradient(135deg, rgba(14, 84, 145, 0.08), rgba(26, 107, 181, 0.04))', 
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(14, 84, 145, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>⭐</span>
                      <span style={{ 
                        fontSize: '11px', 
                        background: 'var(--primary)', 
                        color: '#ffffff', 
                        padding: '3px 10px', 
                        borderRadius: '20px', 
                        fontWeight: '800',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase'
                      }}>
                        First Installment Due
                      </span>
                    </div>
                    <p style={{ fontSize: '20px', fontWeight: '800', color: 'var(--primary-dark)', margin: '4px 0 0 0' }}>
                      Amount Due: {formatInvoiceAmount(invoice.installments[0].amount, invoice.invoiceInfo.currency)}
                    </p>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', margin: '0' }}>
                      📅 Due Date: <span style={{ color: 'var(--primary)', fontWeight: '700' }}>{invoice.installments[0].dueDate}</span>
                    </p>
                  </div>
                );
              }
              
              return (
                <div style={{ marginTop: '20px', padding: '12px', border: '2px solid #f0c040', background: '#fff8e5', borderRadius: '8px' }}>
                  <p style={{ fontSize: '16px', fontWeight: 'bold', margin: '0' }}>
                    Amount Due: {formatInvoiceAmount(invoice.dueAmount, invoice.invoiceInfo.currency)}
                  </p>
                  <p style={{ fontSize: '14px', fontWeight: 'bold', margin: '5px 0 0 0' }}>
                    Due Date: {invoice.invoiceInfo.dueDate}
                  </p>
                </div>
              );
            })()
          )}

          {/* Clickable PDF Payment Link (Only active in View Mode if Due Amount > 0) */}
          {editMode !== 'edit' && invoice.dueAmount > 0 && (
            <div style={{ 
              marginTop: 24, 
              padding: 20, 
              background: '#fcfdfe', 
              borderRadius: 12, 
              textAlign: 'center', 
              border: '1.5px dashed rgba(14, 84, 145, 0.25)',
              boxShadow: '0 8px 16px rgba(14, 84, 145, 0.04)'
            }}>
              {invoice.stripe_payment_link_url ? (
                <>
                  <p style={{ margin: '0 0 10px 0', fontSize: 15, fontWeight: '700', color: 'var(--primary-dark)' }}>
                    💳 Pay Outstanding Due (${formatInvoiceAmount(invoice.dueAmount, invoice.invoiceInfo?.currency)}) via Stripe:
                  </p>
                  <div style={{ marginBottom: 16 }}>
                    <a 
                      href={invoice.stripe_payment_link_url} 
                      target="_blank" 
                      rel="noreferrer" 
                      style={{ 
                        color: '#0E5491', 
                        fontWeight: 'bold', 
                        fontSize: 14, 
                        wordBreak: 'break-all',
                        textDecoration: 'underline'
                      }}
                    >
                      {invoice.stripe_payment_link_url}
                    </a>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                    <a 
                      href={invoice.stripe_payment_link_url} 
                      target="_blank" 
                      rel="noreferrer" 
                      style={{ textDecoration: 'none' }}
                    >
                      <button className="btn btn-sm btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        🚀 Pay Securely Now
                      </button>
                    </a>
                    <button 
                      className="btn btn-sm btn-outline" 
                      onClick={() => {
                        navigator.clipboard.writeText(invoice.stripe_payment_link_url);
                        alert('Stripe Payment Link copied to clipboard!');
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      📋 Copy Link
                    </button>
                    <button 
                      className="btn btn-sm btn-outline" 
                      onClick={async () => {
                        if (!window.confirm('Are you sure you want to regenerate this link? It will update the payment amount to the current outstanding due.')) return;
                        try {
                          const res = await fetch('/api/stripe/payment-link', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              invoiceId: invoice.id,
                              amount: invoice.dueAmount,
                              currency: invoice.invoiceInfo?.currency || 'USD',
                              customerName: invoice.client?.businessName || invoice.leadName || 'Customer',
                              customerEmail: invoice.client?.email || ''
                            })
                          });
                          const data = await res.json();
                          if (data.success) {
                            const updated = updateInvoice(invoice.id, { stripe_payment_link_url: data.url, stripe_payment_link_id: data.id });
                            setInvoice(updated);
                            if (refreshInvoices) refreshInvoices();
                          } else {
                            alert('Failed to regenerate: ' + data.message);
                          }
                        } catch (e) {
                          alert('Failed to regenerate link');
                        }
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      🔄 Update/Regenerate Link
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ margin: '0 0 10px 0', fontSize: 14, color: 'var(--text-secondary)', fontWeight: '600' }}>
                    No active Stripe Payment Link is registered for this invoice's outstanding due balance.
                  </p>
                  <button 
                    className="btn btn-sm btn-primary" 
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/stripe/payment-link', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            invoiceId: invoice.id,
                            amount: invoice.dueAmount,
                            currency: invoice.invoiceInfo?.currency || 'USD',
                            customerName: invoice.client?.businessName || invoice.leadName || 'Customer',
                            customerEmail: invoice.client?.email || ''
                          })
                        });
                        const data = await res.json();
                        if (data.success) {
                          const updated = updateInvoice(invoice.id, { stripe_payment_link_url: data.url, stripe_payment_link_id: data.id });
                          setInvoice(updated);
                          if (refreshInvoices) refreshInvoices();
                        } else {
                          alert('Failed to generate link: ' + data.message);
                        }
                      } catch (e) {
                        alert('Failed to generate link');
                      }
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto' }}
                  >
                    💳 Generate Stripe Payment Link
                  </button>
                </>
              )}
            </div>
          )}

          {/* Payment History */}
          {invoice.payments && invoice.payments.length > 0 && (
            <div style={{ marginBottom: 24, marginTop: 24 }}>
              <h4 style={{ marginBottom: 12 }}>💳 Payment History</h4>
              <table style={{ width: '100%', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Transaction ID</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.payments.map(payment => (
                    <tr key={payment.id}>
                      <td>{new Date(payment.paidAt || payment.date).toLocaleDateString('en-IN')}</td>
                      <td style={{ fontWeight: 600, color: 'var(--success)' }}>{formatInvoiceAmount(payment.amount, invoice.invoiceInfo.currency)}</td>
                      <td>{PAYMENT_METHODS.find(m => m.id === payment.method)?.name || payment.method}</td>
                      <td>{payment.stripe_transaction_id || payment.transactionId || '—'}</td>
                      <td>{payment.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}


          {/* Installments */}
          {invoice.installments.length > 0 && installmentProgress && (
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ marginBottom: 12 }}>📅 Installment Plan</h4>

              {/* Progress Bar */}
              <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span><strong>Paid:</strong> {formatInvoiceAmount(installmentProgress.paidAmount, invoice.invoiceInfo.currency)} / {formatInvoiceAmount(installmentProgress.saleTotal, invoice.invoiceInfo.currency)}</span>
                  <span><strong>Remaining:</strong> {formatInvoiceAmount(installmentProgress.remainingAmount, invoice.invoiceInfo.currency)}</span>
                </div>
                <div style={{ width: '100%', height: 8, background: '#e0e0e0', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(installmentProgress.progressPercent, 100)}%`, height: '100%', background: 'var(--success)', transition: 'width 0.3s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>Progress: {installmentProgress.paidCount}/{installmentProgress.totalCount} installments paid</span>
                  {installmentProgress.nextDue && (
                    <span><strong>Next Due:</strong> {installmentProgress.nextDue.dueDate}</span>
                  )}
                </div>
              </div>

              <h4 style={{ marginBottom: 12 }}>Installment Schedule</h4>
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
                  {invoice.installments.map(inst => {
                    const isFirst = inst.installment_number === 1;
                    return (
                      <tr 
                        key={inst.id}
                        style={{
                          background: isFirst ? 'rgba(14, 84, 145, 0.08)' : 'transparent',
                          borderLeft: isFirst ? '4px solid var(--primary)' : 'none',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <td style={{ padding: isFirst ? '10px 8px' : '8px', fontWeight: isFirst ? 'bold' : 'normal' }}>{inst.dueDate}</td>
                        <td style={{ padding: isFirst ? '10px 8px' : '8px', fontWeight: 800, color: isFirst ? 'var(--primary-dark)' : 'inherit' }}>
                          {formatInvoiceAmount(inst.amount, invoice.invoiceInfo.currency)}
                          {isFirst && (
                            <span style={{ 
                              fontSize: '10px', 
                              background: 'var(--primary)', 
                              color: '#ffffff', 
                              padding: '2px 8px', 
                              borderRadius: '12px', 
                              marginLeft: '8px',
                              fontWeight: '700',
                              letterSpacing: '0.3px',
                              textTransform: 'uppercase',
                              display: 'inline-block',
                              verticalAlign: 'middle'
                            }}>
                              First Due
                            </span>
                          )}
                        </td>
                        <td style={{ padding: isFirst ? '10px 8px' : '8px' }}>
                          <span className={`badge ${inst.status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>
                            {inst.status}
                          </span>
                        </td>
                        <td style={{ padding: isFirst ? '10px 8px' : '8px' }}>
                          {inst.status !== 'PAID' && canEdit && (
                            <button className="btn btn-sm btn-success" onClick={() => handlePayInstallment(inst.id)}>Mark Paid</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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

      {showAssignProject && (() => {
        const existingProject = allProjects?.find(p => p.saleId === invoice.saleId);
        
        const toggleShowPassword = (field) => {
          setShowPassword(prev => ({ ...prev, [field]: !prev[field] }));
        };

        const handleAssignee = (userId) => {
          const user = availableBackendUsers.find(u => u.id === parseInt(userId));
          setAssignForm(p => ({ ...p, assignedTo: parseInt(userId), assignedToName: user?.name || '' }));
        };

        const handleSubmit = (e) => {
          e.preventDefault();
          if (!assignForm.assignedTo) {
            setAlertModal({ title: '⚠️ Validation', message: 'Please select a Backend Staff' });
            return;
          }

          const projectData = {
            ...existingProject,
            assignedMembers: assignForm.assignedMembers || (assignForm.assignedTo ? [assignForm.assignedTo] : []),
            assignedTo: assignForm.assignedTo,
            assignedToName: assignForm.assignedToName,
            status: 'In Progress',
            // Pass full structured client snapshot as requested
            client: clientDetails?.client || { name: 'N/A', phone: 'N/A', email: 'N/A' },
            company: clientDetails?.company || { businessName: 'N/A', address: 'N/A', country: 'N/A', state: 'N/A' },
            projectValue: clientDetails?.projectValue || 0,
            assignedSalesAgent: clientDetails?.assignedSalesAgent || currentUser.id,
            
            googleProfileLink: assignForm.googleProfileLink,
            websiteLink: assignForm.websiteLink,
            wpUrl: assignForm.wpUrl,
            wpUsername: assignForm.wpUsername,
            wpPassword: assignForm.wpPassword ? encrypt(assignForm.wpPassword) : '',
            domainRegistrar: assignForm.domainProvider,
            domainUsername: assignForm.domainUsername,
            domainPassword: assignForm.domainPassword ? encrypt(assignForm.domainPassword) : '',
            cpanelUser: assignForm.cpanelUser,
            cpanelPass: assignForm.cpanelPass ? encrypt(assignForm.cpanelPass) : '',
            facebookPage: assignForm.facebookPage,
            fbUsername: assignForm.fbUsername,
            fbPassword: assignForm.fbPassword ? encrypt(assignForm.fbPassword) : '',
            instagramUsername: assignForm.instagramUsername,
            instagramPassword: assignForm.instagramPassword ? encrypt(assignForm.instagramPassword) : '',
            youtubeChannel: assignForm.youtubeChannel,
            ytUsername: assignForm.ytUsername,
            ytPassword: assignForm.ytPassword ? encrypt(assignForm.ytPassword) : '',
            gmailAcc: assignForm.gmailAcc,
            gmailPassword: assignForm.gmailPassword ? encrypt(assignForm.gmailPassword) : '',
          };

          if (existingProject?.id) {
            updateProject(existingProject.id, projectData);
            
            // Create notification for backend users
            const members = assignForm.assignedMembers && assignForm.assignedMembers.length > 0
              ? assignForm.assignedMembers
              : [assignForm.assignedTo];

            members.forEach(userId => {
              addNotification(
                userId,
                'Project Updated/Reassigned',
                `Project updated: ${clientDetails?.businessName || 'Client Project'}`,
                'project_assigned',
                existingProject.id
              );
            });
            
            setAssignmentSuccess('Project assignment updated successfully!');
            setTimeout(() => setShowAssignProject(false), 2000);
          } else {
            // Auto-create project if missing
            const newProject = createProject({
              ...projectData,
              saleId: invoice.saleId,
              leadId: invoice.leadId,
              invoiceId: invoice.id,
              projectName: `${clientDetails?.businessName || 'Client'} - ${invoice.proposalType || 'Project'}`,
              startDate: new Date().toISOString().split('T')[0],
              reports: [],
            });

            // Create notification for backend users
            const members = assignForm.assignedMembers && assignForm.assignedMembers.length > 0
              ? assignForm.assignedMembers
              : [assignForm.assignedTo];

            members.forEach(userId => {
              addNotification(
                userId,
                'New Project Assigned',
                `You have been assigned a new project: ${clientDetails?.businessName || 'Client Project'}`,
                'project_assigned',
                newProject.id
              );
            });

            setAssignmentSuccess('Project created and assigned to backend successfully!');
            setTimeout(() => setShowAssignProject(false), 2000);
          }
        };

        const PasswordField = ({ field, label, value }) => (
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword[field] ? 'text' : 'password'}
              className="form-control"
              value={value || ''}
              onChange={e => setAssignForm(p => ({ ...p, [field]: e.target.value }))}
              style={{ paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => toggleShowPassword(field)}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              {showPassword[field] ? '🙈' : '👁️'}
            </button>
          </div>
        );

        return (
          <div className="modal-overlay" onClick={() => setShowAssignProject(false)}>
            <div className="modal modal-lg" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">👨‍💻 Assign Project</div>
                <button className="btn btn-icon btn-ghost" onClick={() => setShowAssignProject(false)}>✕</button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body" style={{ maxHeight: '70vh', overflow: 'auto' }}>
                  {assignmentSuccess && (
                    <div style={{ padding: 12, background: 'var(--success-light)', color: 'var(--success)', borderRadius: 8, marginBottom: 16, fontWeight: 600 }}>
                      ✅ {assignmentSuccess}
                    </div>
                  )}
                  
                  <div style={{ background: 'var(--bg-secondary)', padding: 15, borderRadius: 8, marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 10 }}>👤 Client Details (Auto-fetched)</div>
                    {isFetchingClient ? (
                      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                        <span className="spinner" style={{ marginRight: 8 }}>🔄</span> Fetching client data...
                      </div>
                    ) : clientDetails ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                        <div><strong>Business:</strong> {clientDetails.businessName}</div>
                        <div><strong>Contact:</strong> {clientDetails.clientName}</div>
                        <div><strong>Email:</strong> {clientDetails.email}</div>
                        <div><strong>Phone:</strong> {clientDetails.phone}</div>
                        <div><strong>Country:</strong> {clientDetails.country}</div>
                        <div><strong>Address:</strong> {clientDetails.address}</div>
                        <div><strong>Lead Source:</strong> {clientDetails.leadSource}</div>
                        <div><strong>Project Value:</strong> {formatInvoiceAmount(clientDetails.projectValue, invoice.invoiceInfo.currency)}</div>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--danger)', fontSize: 13 }}>⚠️ Unable to load client details. Proceed with caution.</div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>Assign To Team Member *</label>
                    <MultiAssignTeamMember
                      value={assignForm.assignedMembers}
                      onChange={(ids, users) => {
                        setAssignForm(p => ({
                          ...p,
                          assignedMembers: ids,
                          assignedTo: ids[0] || '',
                          assignedToName: users.length ? users.map(u => u.name || u.full_name).join(', ') : 'Unassigned'
                        }));
                      }}
                    />
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', padding: 15, borderRadius: 8, marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 10 }}>🌐 Basic Links</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>Google Profile Link</label>
                        <input className="form-control" value={assignForm.googleProfileLink} onChange={e => setAssignForm(p => ({ ...p, googleProfileLink: e.target.value }))} placeholder="https://..." />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>Website Link</label>
                        <input className="form-control" value={assignForm.websiteLink} onChange={e => setAssignForm(p => ({ ...p, websiteLink: e.target.value }))} placeholder="https://..." />
                      </div>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', padding: 15, borderRadius: 8, marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 10 }}>🌐 Website Details (WordPress)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>WP URL</label>
                        <input className="form-control" value={assignForm.wpUrl} onChange={e => setAssignForm(p => ({ ...p, wpUrl: e.target.value }))} placeholder="https://example.com/wp-admin" />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600 }}>WP Username</label>
                          <input className="form-control" value={assignForm.wpUsername} onChange={e => setAssignForm(p => ({ ...p, wpUsername: e.target.value }))} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600 }}>WP Password</label>
                          <PasswordField field="wpPassword" label="WP Password" value={assignForm.wpPassword} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', padding: 15, borderRadius: 8, marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 10 }}>📡 Domain Details</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>Provider</label>
                        <input className="form-control" value={assignForm.domainProvider} onChange={e => setAssignForm(p => ({ ...p, domainProvider: e.target.value }))} placeholder="GoDaddy, Namecheap, etc." />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>Username</label>
                        <input className="form-control" value={assignForm.domainUsername} onChange={e => setAssignForm(p => ({ ...p, domainUsername: e.target.value }))} />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>Password</label>
                        <PasswordField field="domainPassword" label="Domain Password" value={assignForm.domainPassword} />
                      </div>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', padding: 15, borderRadius: 8, marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 10 }}>🖥️ Hosting (cPanel)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>Username</label>
                        <input className="form-control" value={assignForm.cpanelUser} onChange={e => setAssignForm(p => ({ ...p, cpanelUser: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>Password</label>
                        <PasswordField field="cpanelPass" label="cPanel Password" value={assignForm.cpanelPass} />
                      </div>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', padding: 15, borderRadius: 8, marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 10 }}>📱 Social Media Credentials</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>Facebook Page URL</label>
                        <input className="form-control" value={assignForm.facebookPage} onChange={e => setAssignForm(p => ({ ...p, facebookPage: e.target.value }))} placeholder="fb.com/..." />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>FB Username</label>
                        <input className="form-control" value={assignForm.fbUsername} onChange={e => setAssignForm(p => ({ ...p, fbUsername: e.target.value }))} />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>FB Password</label>
                        <PasswordField field="fbPassword" label="FB Password" value={assignForm.fbPassword} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>Instagram Username</label>
                        <input className="form-control" value={assignForm.instagramUsername} onChange={e => setAssignForm(p => ({ ...p, instagramUsername: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>Instagram Password</label>
                        <PasswordField field="instagramPassword" label="Instagram Password" value={assignForm.instagramPassword} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>YouTube Channel</label>
                        <input className="form-control" value={assignForm.youtubeChannel} onChange={e => setAssignForm(p => ({ ...p, youtubeChannel: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>YT Username</label>
                        <input className="form-control" value={assignForm.ytUsername} onChange={e => setAssignForm(p => ({ ...p, ytUsername: e.target.value }))} />
                      </div>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', padding: 15, borderRadius: 8, marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 10 }}>📧 Google Access</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>Gmail ID</label>
                        <input className="form-control" type="email" value={assignForm.gmailAcc} onChange={e => setAssignForm(p => ({ ...p, gmailAcc: e.target.value }))} placeholder="@gmail.com" />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>Gmail Password</label>
                        <PasswordField field="gmailPassword" label="Gmail Password" value={assignForm.gmailPassword} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAssignProject(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">💾 Save Project Assignment</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {showEmailComposer && (
        <div className="modal-overlay" style={{ background: 'rgba(14, 30, 54, 0.65)', backdropFilter: 'blur(8px)', zIndex: 1050 }}>
          <div className="modal modal-lg" style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '850px', height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <EmailComposer 
              currentUser={currentUser}
              onClose={() => setShowEmailComposer(false)}
              onSend={async (emailData) => {
                if (!emailData.to || !emailData.to.includes('@')) {
                  setAlertModal({ title: '⚠️ Invalid Email', message: 'Customer email not found or invalid. Please update the customer record.' });
                  return;
                }
                try {
                  const { getEmailByUserId, getMailConfig } = await import('../services/emailService');
                  const accounts = getEmailByUserId(currentUser?.id, currentUser?.email);
                  const emailConfig = accounts && accounts.length > 0 ? accounts[0] : null;

                  if (!emailConfig || !emailConfig.email) {
                    setAlertModal({ title: '⚠️ Email Not Configured', message: 'Email not configured. Please configure your email in Profile → Email Settings.' });
                    return;
                  }

                  const systemConfig = getMailConfig();

                  const response = await fetch('/api/mail/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      config: {
                        user: emailConfig.email,
                        pass: decrypt(emailConfig.password),
                        name: currentUser?.name || 'ZSM Team',
                        host: emailConfig.smtpHost || systemConfig.smtpHost || systemConfig.host,
                        port: emailConfig.smtpPort || systemConfig.smtpPort || 465
                      },
                      mailOptions: {
                        from: emailConfig.email,
                        to: emailData.to,
                        subject: emailData.subject,
                        html: emailData.body,
                        text: emailData.body.replace(/<[^>]*>/g, ''),
                        attachments: (emailData.attachments || []).map(att => ({
                          filename: att.name,
                          content: att.content || att.file,
                        }))
                      },
                      userId: currentUser?.id
                    })
                  });
                  const resData = await response.json();
                  if (resData.success) {
                    // Update status to 'Sent' and record it in log
                    const updatedInv = updateInvoice(invoice.id, { status: 'Sent', sentAt: new Date().toISOString() });
                    if (updatedInv) setInvoice(updatedInv);
                    if (refreshInvoices) refreshInvoices();
                    setShowEmailComposer(false);
                    setAlertModal({ title: '✅ Sent', message: 'Invoice email sent successfully!' });
                  } else {
                    setAlertModal({ title: '❌ Send Failed', message: 'Failed to send invoice email: ' + resData.message });
                  }
                } catch (error) {
                  setAlertModal({ title: '❌ Error', message: 'Failed to send invoice email: ' + error.message });
                }
              }}
              initialData={{
                to: invoice.client?.email || invoice.customerEmail || invoice.leadEmail || '',
                subject: `Invoice #${invoice.invoiceNumber || invoice.id} from ${invoice.from?.name || 'ZSM e-Services'}`,
                body: buildInvoiceEmailHtml(invoice),
                attachments: [
                  {
                    name: `Invoice_${invoice.invoiceNumber || invoice.id}.pdf`,
                    size: invoicePdfBase64 ? Math.round((invoicePdfBase64.length * 3) / 4) : 15420,
                    type: 'application/pdf',
                    file: null,
                    content: invoicePdfBase64
                  }
                ]
              }}
            />
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

export default InvoiceView;

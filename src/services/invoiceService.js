import { BASE_CURRENCY, CURRENCIES, getCurrencySymbol } from './currencyService';
import { sales as salesData } from '../data/mockData';
import api from './apiService';

const INVOICE_STORAGE_KEY = 'zsm_invoices';
const INVOICE_AUDIT_KEY = 'zsm_invoice_audit';
const SALES_STORAGE_KEY = 'zsm_sales';

export const PROPOSAL_TYPES = [
  'SEO Plan',
  'GMB Plan',
  'Web Development',
  'Google Ads Plan',
  'SEM Plan',
  'Graphic Design Plan',
  'Website Management Plan',
  'Logo Design Plan',
  'Visiting Card Design Plan',
  'Review Scanner',
  'E-commerce Plan',
  'Social Media Plan',
  'Content Writing Plan',
  'Custom Service',
];

export const PAYMENT_METHODS = [
  { id: 'stripe', name: 'Stripe (Card Payment)', icon: '💳', international: true },
  { id: 'international_card', name: 'International Card', icon: '💳', international: true },
  { id: 'bank_transfer', name: 'Bank Transfer', icon: '🏦', international: true },
  { id: 'cash', name: 'Cash', icon: '💵', international: false },
  { id: 'paypal', name: 'PayPal', icon: '🅿️', international: true },
  { id: 'upi', name: 'UPI / GPay / PhonePe', icon: '📱', international: false },
  { id: 'neft', name: 'NEFT / RTGS', icon: '🏦', international: false },
  { id: 'cheque', name: 'Cheque', icon: '📝', international: false },
];

const COMPANY_SETTINGS_KEY = 'zsm_company_settings';

export const DEFAULT_CONTACT_DETAILS = {
  mailingAddress: "55B Mirza Ghalib Street, Kolkata 700016",
  email: "info@zsmeservices.com",
  contacts: {
    AUS: "+61 756606789",
    IRE: "+353 12544499",
    IND: "+91 033 40049692"
  }
};

export const getCompanySettings = () => {
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
  const saved = localStorage.getItem(COMPANY_SETTINGS_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    return { 
      ...defaults, 
      ...parsed, 
      contactDetails: { ...defaults.contactDetails, ...(parsed.contactDetails || {}) } 
    };
  }
  return defaults;
};

export const saveCompanySettings = (settings) => {
  localStorage.setItem(COMPANY_SETTINGS_KEY, JSON.stringify(settings));
};

export const getContactDetails = (invoiceOrSettings) => {
  if (invoiceOrSettings?.contactDetails?.mailingAddress) {
    return invoiceOrSettings.contactDetails;
  }
  if (invoiceOrSettings?.footer?.mailingAddress) {
    return invoiceOrSettings.footer;
  }
  return DEFAULT_CONTACT_DETAILS;
};

export const getNextInvoiceNumber = () => {
  const invoices = getAllInvoices();
  const year = new Date().getFullYear();
  const count = invoices.filter(i => i.invoiceNumber?.startsWith(`INV-${year}`)).length + 1;
  return `INV-${year}-${String(count).padStart(3, '0')}`;
};

export const createInvoice = (sale) => {
  const now = new Date().toISOString();
  const invoiceNumber = getNextInvoiceNumber();
  const currency = 'EUR'; // Locked to EUR

  const companySettings = getCompanySettings();

  // Determine invoice total: if installments, only bill the first installment
  const hasInstallments = sale.installmentPlan && sale.installmentPlan.length > 0;
  const firstInstallment = hasInstallments ? sale.installmentPlan[0] : null;
  const invoiceTotal = hasInstallments && firstInstallment
    ? firstInstallment.amount
    : sale.totalAmount;

  const invoice = {
    id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    invoiceNumber,
    saleId: sale.id,
    leadId: sale.leadId,
    createdBy: sale.createdBy || sale.closedBy,
    status: 'PENDING',
    lockedTotal: invoiceTotal,
    saleTotalAmount: sale.totalAmount, // Store full sale amount separately

    contactDetails: {
      mailingAddress: companySettings.contactDetails.mailingAddress,
      email: companySettings.contactDetails.email,
      contacts: { ...companySettings.contactDetails.contacts }
    },

    from: {
      ...companySettings
    },

    client: {
      businessName: sale.businessName,
      contactName: sale.leadName,
      email: sale.email || '',
      phone: sale.ownerPhone || '',
      addressLine1: sale.addressLine1 || sale.address || '',
      city: sale.city || '',
      state: sale.state || '',
      country: sale.country || '',
      countryCode: sale.countryCode || 'IN',
      dialCode: sale.dialCode || '+91',
    },

    invoiceInfo: {
      invoiceDate: now.split('T')[0],
      dueDate: firstInstallment?.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      currency,
      currencySymbol: getCurrencySymbol(currency),
    },

    services: hasInstallments && firstInstallment
      ? [
          {
            id: `svc_${Date.now()}`,
            name: `Installment 1 of ${sale.installmentPlan.length} - ${sale.proposalType || 'Project'}`,
            description: `Current Due: ${invoiceTotal} | Remaining Balance: ${Math.max(0, sale.totalAmount - invoiceTotal)}`,
            duration: 'One-time',
            quantity: 1,
            unitPrice: invoiceTotal,
            total: invoiceTotal,
          }
        ]
      : (sale.proposals && sale.proposals.length > 0
          ? sale.proposals.map((p, index) => ({
              id: `svc_${Date.now()}_${index}`,
              name: p.package ? `${p.type} - ${p.package}` : p.type,
              description: p.description || '',
              duration: 'Monthly',
              quantity: 1,
              unitPrice: Number(p.amount || 0),
              total: Number(p.amount || 0),
            }))
          : [
              {
                id: `svc_${Date.now()}`,
                name: sale.proposalType || 'Web Design Plan',
                description: '',
                duration: 'Monthly',
                quantity: 1,
                unitPrice: invoiceTotal,
                total: invoiceTotal,
              },
            ]),

    amountSummary: {
      subtotal: 0,
      discountType: 'FLAT',
      discountValue: 0,
      discountAmount: 0,
      afterDiscount: 0,
      taxName: 'GST',
      taxPercent: 0,
      taxAmount: 0,
      additionalCharges: [],
      additionalChargesTotal: 0,
      grandTotal: 0,
    },

    installments: (() => {
      if (hasInstallments && sale.installmentPlan) {
        return sale.installmentPlan.map(inst => ({
          id: `inst_${Date.now()}_${inst.installment_number}`,
          installment_number: inst.installment_number,
          amount: inst.amount,
          dueDate: inst.due_date,
          status: inst.status || 'PENDING',
          paidAmount: 0,
          paidAt: null,
          paymentMethod: null,
        }));
      }
      return [];
    })(),
    payments: [],

    totalAmount: 0,
    paidAmount: 0,
    dueAmount: 0,

    notes: `Thank you for your business. Payment is due within 30 days.`,
    terms: 'Payment terms: Net 30 days. Late payments may incur additional fees.',
    renewalTerms: 'This service will auto-renew unless cancelled 15 days prior.',

    signature: {
      authorizedBy: getCompanySettings().name,
      signedAt: now,
    },

    auditLog: [],

    createdAt: now,
    updatedAt: now,
  };

  recalculateAmountSummary(invoice);

  saveInvoice(invoice);
  logAuditAction(invoice.id, 'CREATE', null, invoice, 'System');

  return invoice;
};

export const updateInvoice = (invoiceId, updates, changedBy = 'System') => {
  const invoices = getAllInvoices();
  const index = invoices.findIndex(i => i.id === invoiceId);

  if (index === -1) return null;

  const oldInvoice = { ...invoices[index] };
  const now = new Date().toISOString();

  updates.updatedAt = now;

  const updatedInvoice = {
    ...invoices[index],
    ...updates,
  };

  Object.keys(updates).forEach(key => {
    if (key !== 'updatedAt' && key !== 'auditLog') {
      const oldValue = oldInvoice[key];
      const newValue = updates[key];
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        logAuditAction(invoiceId, 'UPDATE', key, oldValue, newValue, changedBy);
      }
    }
  });

  recalculateAmountSummary(updatedInvoice);

  invoices[index] = updatedInvoice;
  localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(invoices));

  return updatedInvoice;
};

export const addServiceItem = (invoiceId, service, changedBy = 'System') => {
  const invoice = getInvoice(invoiceId);
  if (!invoice) return null;

  service.id = `svc_${Date.now()}`;
  service.total = service.quantity * service.unitPrice;

  const newServices = [...invoice.services, service];
  return updateInvoice(invoiceId, { services: newServices }, changedBy);
};

export const updateServiceItem = (invoiceId, serviceId, updates, changedBy = 'System') => {
  const invoice = getInvoice(invoiceId);
  if (!invoice) return null;

  const newServices = invoice.services.map(s => {
    if (s.id === serviceId) {
      const updated = { ...s, ...updates };
      updated.total = updated.quantity * updated.unitPrice;
      return updated;
    }
    return s;
  });

  return updateInvoice(invoiceId, { services: newServices }, changedBy);
};

export const removeServiceItem = (invoiceId, serviceId, changedBy = 'System') => {
  const invoice = getInvoice(invoiceId);
  if (!invoice) return null;

  const newServices = invoice.services.filter(s => s.id !== serviceId);
  return updateInvoice(invoiceId, { services: newServices }, changedBy);
};

export const addPayment = (invoiceId, payment, changedBy = 'System', extraUpdates = {}) => {
  const invoice = getInvoice(invoiceId);
  if (!invoice) return null;
  const invoiceCurrency = invoice.invoiceInfo?.currency || 'EUR';

  if (payment.currency && payment.currency !== invoiceCurrency) {
    throw new Error("Currency mismatch not allowed");
  }

  payment.id = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  payment.paidAt = new Date().toISOString();
  payment.currency = invoiceCurrency;

  invoice.payments = [...(invoice.payments || []), payment];
  recalculateAmountSummary(invoice);

  const status = invoice.dueAmount <= 0 ? 'FULL' : invoice.paidAmount > 0 ? 'PARTIAL' : 'PENDING';

  return updateInvoice(invoiceId, {
    payments: invoice.payments,
    paidAmount: invoice.paidAmount,
    dueAmount: invoice.dueAmount,
    status,
    ...extraUpdates
  }, changedBy);
};

export const addInstallment = (invoiceId, installment, changedBy = 'System') => {
  const invoice = getInvoice(invoiceId);
  if (!invoice) return null;

  installment.id = `inst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  installment.status = 'PENDING';

  const newInstallments = [...(invoice.installments || []), installment];
  return updateInvoice(invoiceId, { installments: newInstallments }, changedBy);
};

export const markInstallmentPaid = (invoiceId, installmentId, payment, changedBy = 'System') => {
  const invoice = getInvoice(invoiceId);
  if (!invoice) return null;

  const paidInstallment = (invoice.installments || []).find(inst => inst.id === installmentId);
  const newInstallments = (invoice.installments || []).map(inst => {
    if (inst.id === installmentId) {
      return {
        ...inst,
        status: 'PAID',
        paidAmount: payment.amount,
        paidAt: new Date().toISOString(),
        paymentMethod: payment.method,
      };
    }
    return inst;
  });

  const paymentRecord = {
    amount: payment.amount,
    currency: payment.currency || invoice.invoiceInfo?.currency || BASE_CURRENCY,
    method: payment.method,
    notes: `Installment payment for ${paidInstallment?.dueDate || 'installment'}`,
  };

  // Update sale's installment plan status
  if (invoice.saleId && paidInstallment) {
    const sales = JSON.parse(localStorage.getItem(SALES_STORAGE_KEY) || '[]');
    const saleIndex = sales.findIndex(s => s.id === invoice.saleId);
    if (saleIndex >= 0 && sales[saleIndex].installmentPlan) {
      const plan = sales[saleIndex].installmentPlan;
      const targetIndex = plan.findIndex(inst => inst.installment_number === paidInstallment.installment_number);
      if (targetIndex >= 0) {
        plan[targetIndex] = { ...plan[targetIndex], status: 'paid' };
        sales[saleIndex].installmentPlan = plan;
        localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(sales));
      }
    }
  }

  // Pass installments update to addPayment
  const result = addPayment(invoiceId, paymentRecord, changedBy, { installments: newInstallments });

  // Auto-create next installment invoice if available
  if (invoice.saleId && paidInstallment) {
    const sales = JSON.parse(localStorage.getItem(SALES_STORAGE_KEY) || '[]');
    const sale = sales.find(s => s.id === invoice.saleId);
    if (sale?.installmentPlan) {
      const nextInstNumber = paidInstallment.installment_number + 1;
      const nextInst = sale.installmentPlan.find(inst => inst.installment_number === nextInstNumber);
      if (nextInst && nextInst.status !== 'paid') {
        createNextInstallmentInvoice(sale, nextInstNumber);
      }
    }
  }

  return result;
};

export const recalculateAmountSummary = (invoice) => {
  const lockedTotal = invoice.lockedTotal !== undefined ? invoice.lockedTotal : invoice.totalAmount || 0;

  const totalPaid = (invoice.payments || [])
    .filter(p => p.status !== 'failed' && p.status !== 'refunded')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  invoice.amountSummary = {
    ...invoice.amountSummary,
    subtotal: lockedTotal,
    discountAmount: 0,
    afterDiscount: lockedTotal,
    taxAmount: 0,
    additionalChargesTotal: 0,
    grandTotal: lockedTotal,
  };

  invoice.totalAmount = lockedTotal;
  invoice.paidAmount = totalPaid;
  invoice.dueAmount = Math.max(0, lockedTotal - totalPaid);

  if (invoice.dueAmount > 0) {
    invoice.paymentLink = `https://checkout.stripe.com/pay/${invoice.id}?amount=${Math.round(invoice.dueAmount * 100)}`;
  } else {
    invoice.paymentLink = null;
  }
};

/**
 * Create next installment invoice after current one is paid
 * @param {object} sale - The sale object
 * @param {number} installmentNumber - The installment number to bill (1-indexed)
 * @returns {object|null} - The new invoice or null
 */
export const createNextInstallmentInvoice = (sale, installmentNumber) => {
  if (!sale || !sale.installmentPlan || sale.installmentPlan.length === 0) return null;

  const targetInstallment = sale.installmentPlan.find(inst => inst.installment_number === installmentNumber);
  if (!targetInstallment || targetInstallment.status === 'paid') return null;

  const now = new Date().toISOString();
  const invoiceNumber = getNextInvoiceNumber();
  const currency = 'EUR';

  const companySettings = getCompanySettings();

  const invoice = {
    id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    invoiceNumber,
    saleId: sale.id,
    leadId: sale.leadId,
    createdBy: sale.createdBy || sale.closedBy,
    status: 'PENDING',
    lockedTotal: targetInstallment.amount,
    saleTotalAmount: sale.totalAmount,

    contactDetails: {
      mailingAddress: companySettings.contactDetails.mailingAddress,
      email: companySettings.contactDetails.email,
      contacts: { ...companySettings.contactDetails.contacts }
    },

    from: { ...companySettings },

    client: {
      businessName: sale.businessName,
      contactName: sale.leadName,
      email: sale.email || '',
      phone: sale.ownerPhone || '',
      addressLine1: sale.addressLine1 || sale.address || '',
      city: sale.city || '',
      state: sale.state || '',
      country: sale.country || '',
      countryCode: sale.countryCode || 'IN',
      dialCode: sale.dialCode || '+91',
    },

    invoiceInfo: {
      invoiceDate: now.split('T')[0],
      dueDate: targetInstallment.due_date,
      currency,
      currencySymbol: getCurrencySymbol(currency),
    },

    services: [{
      id: `svc_${Date.now()}`,
      name: `Installment ${installmentNumber} - ${sale.proposalType || 'Service'}`,
      description: `Payment for installment ${installmentNumber} of ${sale.installmentPlan.length}`,
      duration: 'Monthly',
      quantity: 1,
      unitPrice: targetInstallment.amount,
      total: targetInstallment.amount,
    }],

    amountSummary: {
      subtotal: 0,
      discountType: 'FLAT',
      discountValue: 0,
      discountAmount: 0,
      afterDiscount: 0,
      taxName: 'GST',
      taxPercent: 0,
      taxAmount: 0,
      additionalCharges: [],
      additionalChargesTotal: 0,
      grandTotal: 0,
    },

    installments: (sale.installmentPlan || []).map(inst => ({
      id: `inst_${Date.now()}_${inst.installment_number}`,
      installment_number: inst.installment_number,
      amount: inst.amount,
      dueDate: inst.due_date,
      status: inst.status === 'paid' ? 'PAID' : 'PENDING',
      paidAmount: inst.status === 'paid' ? inst.amount : 0,
      paidAt: inst.status === 'paid' ? (inst.paidAt || now) : null,
      paymentMethod: inst.status === 'paid' ? (inst.paymentMethod || 'manual') : null,
    })),
    payments: [],

    totalAmount: 0,
    paidAmount: 0,
    dueAmount: 0,

    notes: `Thank you for your business. Payment is due by ${targetInstallment.due_date}.`,
    terms: 'Payment terms: Net 30 days. Late payments may incur additional fees.',
    renewalTerms: 'This service will auto-renew unless cancelled 15 days prior.',

    signature: {
      authorizedBy: companySettings.name,
      signedAt: now,
    },

    auditLog: [],
    createdAt: now,
    updatedAt: now,
  };

  recalculateAmountSummary(invoice);
  saveInvoice(invoice);
  logAuditAction(invoice.id, 'CREATE', null, invoice, 'System');

  return invoice;
};

export const generateStripePaymentLink = async (invoiceId, amount, currency = 'usd') => {
  const invoice = getInvoice(invoiceId);
  if (!invoice) return null;

  const stripeUrl = `https://buy.stripe.com/${invoiceId}`;

  return {
    success: true,
    paymentUrl: stripeUrl,
    amount,
    currency,
    invoiceId,
  };
};

export const getStripePaymentIntent = async (invoiceId, amount, currency = 'usd') => {
  const invoice = getInvoice(invoiceId);
  if (!invoice) return null;

  return {
    clientSecret: `pi_${invoiceId}_secret_${Date.now()}`,
    paymentIntentId: `pi_${invoiceId}_${Date.now()}`,
    amount,
    currency,
  };
};

export const handleStripeWebhook = (payload) => {
  const event = JSON.parse(payload);

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const invoiceId = paymentIntent.metadata?.invoiceId;

    if (invoiceId) {
      const invoice = getInvoice(invoiceId);
      if (invoice) {
        const payment = {
          amount: paymentIntent.amount / 100,
          method: 'stripe',
          stripePaymentId: paymentIntent.id,
          status: 'succeeded',
        };

        addPayment(invoiceId, payment, 'Stripe Webhook');
      }
    }
  }
};

const logAuditAction = (invoiceId, action, field, oldValue, newValue, changedBy = 'System') => {
  const auditLogs = JSON.parse(localStorage.getItem(INVOICE_AUDIT_KEY) || '[]');

  auditLogs.unshift({
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    invoiceId,
    action,
    field,
    oldValue,
    newValue,
    changedBy,
    changedAt: new Date().toISOString(),
  });

  localStorage.setItem(INVOICE_AUDIT_KEY, JSON.stringify(auditLogs));
};

export const getInvoiceAuditLog = (invoiceId) => {
  const auditLogs = JSON.parse(localStorage.getItem(INVOICE_AUDIT_KEY) || '[]');
  return auditLogs.filter(log => log.invoiceId === invoiceId);
};

export const getCustomerInvoice = (invoice) => {
  if (!invoice) return null;
  const {
    auditLog,
    internalNotes,
    createdBy,
    updatedBy,
    ...customerSafeInvoice
  } = invoice;
  return customerSafeInvoice;
};

export const getAllInvoices = () => {
  const invoicesJson = localStorage.getItem(INVOICE_STORAGE_KEY);
  if (!invoicesJson) return [];
  try {
    let invoices = JSON.parse(invoicesJson);
    let needsSave = false;

    // Add createdBy to invoices that don't have it (migration)
    invoices = invoices.map(inv => {
      if (!inv.createdBy) {
        const sale = salesData.find(s => s.id === inv.saleId);
        if (sale) {
          inv.createdBy = sale.createdBy || sale.closedBy;
          needsSave = true;
        }
      }
      return inv;
    });

    if (needsSave) {
      localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(invoices));
    }

    // Auto-heal corrupted 379.35 invoices stuck in local storage
    invoices = invoices.map(inv => {
      if (inv.invoiceNumber === 'INV-2026-004' || (Math.abs(inv.totalAmount - 379.35) < 0.1 && !inv.healed)) {
        inv.lockedTotal = 350;
        inv.totalAmount = 350;
        inv.saleTotalAmount = inv.saleTotalAmount || 350;
        inv.amountSummary = { ...inv.amountSummary, grandTotal: 350, subtotal: 350, afterDiscount: 350, taxAmount: 0, additionalChargesTotal: 0 };
        inv.dueAmount = Math.max(0, 350 - inv.paidAmount);
        inv.services = (inv.services || []).map(s => {
          s.total = 350;
          s.unitPrice = 350;
          return s;
        });
        inv.healed = true; // prevent infinite loops
        needsSave = true;
      }

      // Migrate: add saleTotalAmount if missing
      if (inv.lockedTotal !== undefined && !inv.saleTotalAmount) {
        inv.saleTotalAmount = inv.lockedTotal;
        needsSave = true;
      }

      if (inv.invoiceInfo && typeof inv.invoiceInfo.currency !== 'undefined') {
        const currencyStr = String(inv.invoiceInfo.currency);
        if (/^[0-7]$/.test(currencyStr)) {
          const index = parseInt(currencyStr, 10);
          inv.invoiceInfo.currency = CURRENCIES[index]?.code || BASE_CURRENCY;
          inv.invoiceInfo.currencySymbol = getCurrencySymbol(inv.invoiceInfo.currency);
          needsSave = true;
        }
      }
      if (!inv.from && inv.company) {
        inv.from = { ...inv.company };
        needsSave = true;
      }

      // Migrate footer to contactDetails
      if (inv.footer && !inv.contactDetails) {
        inv.contactDetails = { ...inv.footer };
        delete inv.footer;
        needsSave = true;
      }

      // Force populate contactDetails if missing or empty
      if (!inv.contactDetails?.mailingAddress) {
        inv.contactDetails = getContactDetails(getCompanySettings());
        needsSave = true;
      }

      const beforeStr = JSON.stringify(inv);
      recalculateAmountSummary(inv);
      if (beforeStr !== JSON.stringify(inv)) {
        needsSave = true;
      }
      return inv;
    });

    if (needsSave) {
      localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(invoices));
    }

    return invoices;
  } catch {
    return [];
  }
};

export const getInvoice = (invoiceId) => {
  const invoices = getAllInvoices();
  return invoices.find(i => i.id === invoiceId) || null;
};

export const getInvoiceBySaleId = (saleId) => {
  const invoices = getAllInvoices();
  return invoices.filter(i => i.saleId === saleId);
};

export const getInvoicesByStatus = (status) => {
  const invoices = getAllInvoices();
  return invoices.filter(i => i.status === status);
};

export const getInvoicesByClient = (clientName) => {
  const invoices = getAllInvoices();
  return invoices.filter(i =>
    i.client?.businessName?.toLowerCase().includes(clientName.toLowerCase())
  );
};

const saveInvoice = (invoice) => {
  const invoices = getAllInvoices();
  const index = invoices.findIndex(i => i.id === invoice.id);

  if (index >= 0) {
    invoices[index] = invoice;
  } else {
    invoices.unshift(invoice);
  }

  localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(invoices));

  // Sync to InsForge central database asynchronously
  api.invoices.create(invoice).catch(err => {
    console.warn('[invoiceService] Failed to save invoice centrally:', err.message);
  });
};

export const deleteInvoice = (invoiceId) => {
  const invoices = getAllInvoices();
  const filtered = invoices.filter(i => i.id !== invoiceId);
  localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(filtered));

  // Sync deletion to InsForge central database asynchronously
  api.invoices.delete(invoiceId).catch(err => {
    console.warn('[invoiceService] Failed to delete invoice centrally:', err.message);
  });
};

export const formatInvoiceAmount = (amount, currency = BASE_CURRENCY) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  } catch (e) {
    const symbol = getCurrencySymbol(currency);
    return `${symbol}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
};

export const getInvoiceStats = () => {
  const invoices = getAllInvoices();

  // For installment invoices, total is the invoice amount (first installment or current installment)
  // saleTotalAmount stores the full sale value for reference
  const total = invoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0);
  const paid = invoices.reduce((sum, i) => sum + (i.paidAmount || 0), 0);
  const due = invoices.reduce((sum, i) => sum + (i.dueAmount || 0), 0);

  // Calculate full sale value across all invoices (for reporting)
  const totalSaleValue = invoices.reduce((sum, i) => sum + (i.saleTotalAmount || i.totalAmount || 0), 0);

  const pending = invoices.filter(i => i.status === 'PENDING').length;
  const partial = invoices.filter(i => i.status === 'PARTIAL').length;
  const full = invoices.filter(i => i.status === 'FULL').length;
  const cancelled = invoices.filter(i => i.status === 'CANCELLED').length;

  return {
    total,
    paid,
    due,
    totalSaleValue,
    count: invoices.length,
    pending,
    partial,
    full,
    cancelled,
  };
};

export const cancelInvoice = (invoiceId, changedBy = 'System') => {
  return updateInvoice(invoiceId, { status: 'CANCELLED' }, changedBy);
};

export const markInvoicePaid = (invoiceId, changedBy = 'System') => {
  const invoice = getInvoice(invoiceId);
  if (!invoice) return null;

  const remaining = invoice.dueAmount;
  return addPayment(invoiceId, {
    amount: remaining,
    method: 'manual',
    notes: 'Manual payment - marked as paid',
  }, changedBy);
};

export const duplicateInvoice = (invoiceId, changedBy = 'System') => {
  const invoice = getInvoice(invoiceId);
  if (!invoice) return null;

  const newInvoice = {
    ...invoice,
    id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    invoiceNumber: getNextInvoiceNumber(),
    status: 'PENDING',
    paidAmount: 0,
    payments: [],
    installments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    auditLog: [],
  };

  recalculateAmountSummary(newInvoice);

  saveInvoice(newInvoice);
  logAuditAction(newInvoice.id, 'CREATE', null, newInvoice, changedBy);

  return newInvoice;
};

export const saveCustomInvoice = (invoice, changedBy = 'System') => {
  saveInvoice(invoice);
  logAuditAction(invoice.id, 'CREATE', null, null, invoice, changedBy);
  return invoice;
};

export const fetchDashboardSummary = async () => {
  return new Promise((resolve) => {
    // Simulate backend endpoint delay
    setTimeout(() => {
      const invoices = getAllInvoices();
      // Use saleTotalAmount for full sale value, fallback to totalAmount for old invoices
      const totalSalesValue = invoices.reduce((sum, inv) => sum + (inv.saleTotalAmount || inv.totalAmount || 0), 0);

      const allPayments = invoices.flatMap(inv =>
        (inv.payments || []).map(p => ({
          ...p,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          client: inv.client?.businessName || inv.leadName
        }))
      )
        .filter(p => p.status !== 'failed' && p.status !== 'refunded')
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

      const totalCollection = invoices.reduce((sum, invoice) => {
        const paid = allPayments
          .filter(p => p.invoiceId === invoice.id)
          .reduce((s, p) => s + (p.amount || 0), 0);
        return sum + paid;
      }, 0);

      const totalDue = invoices.reduce((sum, invoice) => {
        const invoiceTotal = invoice.totalAmount || 0;
        const paid = allPayments
          .filter(p => p.invoiceId === invoice.id)
          .reduce((s, p) => s + (p.amount || 0), 0);
        return sum + Math.max(0, invoiceTotal - paid);
      }, 0);

      const customerMap = {};
      invoices.forEach(inv => {
        const name = inv.client?.businessName || inv.leadName || 'Unknown';
        if (!customerMap[name]) {
          customerMap[name] = {
            customerName: name,
            contactName: inv.client?.contactPerson || '',
            saleCount: 0,
            totalSaleAmount: 0,
            totalPaid: 0,
            totalDue: 0,
            sales: []
          };
        }
        // Use saleTotalAmount for full sale value
        const normalizedTotal = inv.saleTotalAmount || inv.totalAmount || 0;
        customerMap[name].saleCount += 1;
        customerMap[name].totalSaleAmount += normalizedTotal;
        const paid = (inv.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
        customerMap[name].totalPaid += paid;
                customerMap[name].totalDue += Math.max(0, (inv.totalAmount || 0) - paid);
        customerMap[name].sales.push({
          ...inv,
          id: inv.invoiceNumber || inv.id,
          proposalType: inv.services && inv.services[0] ? inv.services[0].name : 'Invoice',
          amount: inv.totalAmount,
          baseAmount: normalizedTotal,
          paymentStatus: paid >= (inv.totalAmount || 0) ? 'Full Payment' : (paid > 0 ? 'Partial' : 'Pending'),
          installments: inv.installments?.length || 0,
          paidInstallments: inv.installments?.filter(i => i.status === 'PAID').length || 0
        });
      });
      const customers = Object.values(customerMap);
      const totalCustomers = new Set(invoices.map(inv => inv.client?.businessName || inv.leadName)).size;

      resolve({
        totalSalesValue,
        totalCollection,
        totalDue,
        totalCustomers,
        invoices,
        allPayments,
        customers
      });
    }, 50);
  });
};

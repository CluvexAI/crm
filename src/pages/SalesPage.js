import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { BASE_CURRENCY, formatCurrencyAmount, getCurrencySymbol } from '../services/currencyService';
import { aggregateCustomerPayments, getOverallPaymentStats, calculateAgingBuckets, getAgingSummary } from '../services/paymentService';
import { fetchDashboardSummary, markInvoicePaid, getCompanySettings, saveCompanySettings } from '../services/invoiceService';
import InvoiceView from '../components/InvoiceView';

const SalesPage = () => {
  const { allInvoices, updateInvoice, refreshInvoices, currentUser } = useApp();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [companySettings, setCompanySettings] = useState(() => getCompanySettings());

  const handleSaveCompanySettings = () => {
    saveCompanySettings(companySettings);
    window.alert('Company settings saved successfully! They will apply to all new invoices.');
  };

  const formatCurrency = (n) => formatCurrencyAmount(n || 0, 'EUR');

  const formatDual = (amount) => {
    return (
      <div style={{ fontWeight: 700 }}>{formatCurrency(amount)}</div>
    );
  };

  const [stats, setStats] = useState({
    totalSalesValue: 0,
    totalCollection: 0,
    totalDue: 0,
    totalCustomers: 0,
    invoices: [],
    allPayments: [],
    customers: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchDashboardSummary().then(data => {
      setStats(data);
      setLoading(false);
    });
  }, [allInvoices]); // Recalculate whenever invoices change

  const totalSalesValueEUR = stats.totalSalesValue;
  const totalCollectedEUR = stats.totalCollection;
  const totalDueEUR = stats.totalDue;

  const getFilteredInvoices = () => {
    let filtered = stats.invoices;
    if (filter === 'due') {
      filtered = filtered.filter(inv => inv.dueAmount > 0);
    }
    if (search) {
      filtered = filtered.filter(inv =>
        (inv.invoiceNumber || '').toLowerCase().includes(search.toLowerCase()) ||
        (inv.client?.businessName || inv.leadName || '').toLowerCase().includes(search.toLowerCase())
      );
    }
    return filtered;
  };

  const getFilteredPayments = () => {
    if (!search) return stats.allPayments;
    return stats.allPayments.filter(p =>
      (p.client || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.invoiceNumber || '').toLowerCase().includes(search.toLowerCase())
    );
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {currentUser?.role === 'Admin' && (
        <div className="card" style={{ marginBottom: 24, padding: 16, background: 'var(--bg-secondary)' }}>
          <h4 style={{ marginBottom: 12 }}>🏢 Default Invoice Sender Settings</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 'bold' }}>Company Name</label>
              <input className="form-control" value={companySettings.name} onChange={e => setCompanySettings({ ...companySettings, name: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 'bold' }}>Address</label>
              <input className="form-control" value={companySettings.address} onChange={e => setCompanySettings({ ...companySettings, address: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 'bold' }}>Email</label>
              <input className="form-control" value={companySettings.email} onChange={e => setCompanySettings({ ...companySettings, email: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 'bold' }}>Phone</label>
              <input className="form-control" value={companySettings.phone} onChange={e => setCompanySettings({ ...companySettings, phone: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 'bold' }}>CONTACT DETAILS - Mailing Address</label>
              <input className="form-control" value={companySettings.contactDetails?.mailingAddress || ''} onChange={e => setCompanySettings({ ...companySettings, contactDetails: { ...companySettings.contactDetails, mailingAddress: e.target.value } })} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 'bold' }}>CONTACT DETAILS - Email Address</label>
              <input className="form-control" value={companySettings.contactDetails?.email || ''} onChange={e => setCompanySettings({ ...companySettings, contactDetails: { ...companySettings.contactDetails, email: e.target.value } })} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 'bold' }}>CONTACT DETAILS - Contact AUS</label>
              <input className="form-control" value={companySettings.contactDetails?.contacts?.AUS || ''} onChange={e => setCompanySettings({ ...companySettings, contactDetails: { ...companySettings.contactDetails, contacts: { ...companySettings.contactDetails?.contacts, AUS: e.target.value } } })} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 'bold' }}>CONTACT DETAILS - Contact IRE</label>
              <input className="form-control" value={companySettings.contactDetails?.contacts?.IRE || ''} onChange={e => setCompanySettings({ ...companySettings, contactDetails: { ...companySettings.contactDetails, contacts: { ...companySettings.contactDetails?.contacts, IRE: e.target.value } } })} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 'bold' }}>CONTACT DETAILS - Contact IND</label>
              <input className="form-control" value={companySettings.contactDetails?.contacts?.IND || ''} onChange={e => setCompanySettings({ ...companySettings, contactDetails: { ...companySettings.contactDetails, contacts: { ...companySettings.contactDetails?.contacts, IND: e.target.value } } })} />
            </div>
          </div>
          <button className="btn btn-sm btn-primary" style={{ marginTop: 16 }} onClick={handleSaveCompanySettings}>Save Settings</button>
        </div>
      )}

      {/* Revenue Summary (Drill-Down KPI Cards) */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card" style={{ cursor: 'pointer', outline: ['sales', 'all'].includes(filter) ? '2px solid var(--primary)' : 'none' }} onClick={() => setFilter('sales')}>
          <div className="stat-icon green">💰</div>
          <div className="stat-info">
            <div className="stat-value">{formatCurrency(totalSalesValueEUR)}</div>
            <div className="stat-label">Total Sales Value</div>
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer', outline: filter === 'collected' ? '2px solid var(--primary)' : 'none' }} onClick={() => setFilter('collected')}>
          <div className="stat-icon teal">✅</div>
          <div className="stat-info">
            <div className="stat-value">{formatCurrency(totalCollectedEUR)}</div>
            <div className="stat-label">Total Collected</div>
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer', outline: filter === 'due' ? '2px solid var(--primary)' : 'none' }} onClick={() => setFilter('due')}>
          <div className="stat-icon red">⏳</div>
          <div className="stat-info">
            <div className="stat-value">{formatCurrency(totalDueEUR)}</div>
            <div className="stat-label">Total Due</div>
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer', outline: filter === 'customers' ? '2px solid var(--primary)' : 'none' }} onClick={() => setFilter('customers')}>
          <div className="stat-icon blue">👥</div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalCustomers}</div>
            <div className="stat-label">Total Customers</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Syncing with invoice records...
        </div>
      ) : (
        <>
          <div className="toolbar" style={{ marginBottom: 16 }}>
            <div className="search-bar">
              🔍 <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records..." />
            </div>
          </div>

          {filter === 'customers' && (
            <CustomersTab customers={stats.customers} formatCurrency={formatDual} />
          )}

          {filter === 'collected' && (
            <PaymentsTab payments={getFilteredPayments()} formatCurrency={formatDual} />
          )}

          {['sales', 'due', 'all'].includes(filter) && (
            <InvoicesTab allInvoices={getFilteredInvoices()} updateInvoice={updateInvoice} formatCurrency={formatDual} refreshInvoices={refreshInvoices} title={filter === 'due' ? '🧾 Unpaid Invoices' : '🧾 All Invoices'} currentUser={currentUser} />
          )}
        </>
      )}
    </div>
  );
};

const PaymentsTab = ({ payments, formatCurrency }) => (
  <div className="card">
    <div className="card-header">
      <div className="card-title">💵 Payment Transactions ({payments.length})</div>
    </div>
    <div className="table-container">
      {payments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💵</div>
          <div className="empty-state-title">No payments yet</div>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Invoice Number</th>
              <th>Customer</th>
              <th>Method</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p, idx) => (
              <tr key={idx}>
                <td>{new Date(p.date || Date.now()).toLocaleDateString('en-IN')}</td>
                <td><span className="badge badge-primary">{p.invoiceNumber}</span></td>
                <td style={{ fontWeight: 600 }}>{p.client}</td>
                <td><span className="badge badge-info">{p.method || 'stripe'}</span></td>
                <td style={{ color: 'var(--success)' }}>{formatCurrency(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </div>
);

const CustomersTab = ({ customers, formatCurrency }) => {
  const [viewCustomer, setViewCustomer] = useState(null);

  const getStatusBadge = (customer) => {
    if (customer.totalDue === 0) return 'badge-success';
    if (customer.totalDue === customer.totalSaleAmount) return 'badge-danger';
    return 'badge-warning';
  };

  const getStatusText = (customer) => {
    if (customer.totalDue === 0) return '🟢 Paid';
    if (customer.totalDue === customer.totalSaleAmount) return '🔴 Due';
    return '🟡 Partial';
  };

  const getDueBadge = (customer) => {
    if (customer.totalDue === 0) return 'badge-success';
    if (customer.totalDue === customer.totalSaleAmount) return 'badge-danger';
    return 'badge-warning';
  };

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div className="card-title">👥 Customer Payment Summary ({customers.length})</div>
        </div>
        <div className="table-container">
          {customers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <div className="empty-state-title">No customers yet</div>
              <div className="empty-state-text">Convert leads to generate customer records.</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Sales</th>
                  <th>Total Amount</th>
                  <th>Paid Amount</th>
                  <th>Due Amount</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(customer => (
                  <tr
                    key={customer.customerName}
                    style={{
                      cursor: 'pointer',
                      background: viewCustomer === customer.customerName ? 'var(--bg-secondary)' : ''
                    }}
                    onClick={() => setViewCustomer(viewCustomer === customer.customerName ? null : customer.customerName)}
                  >
                    <td>
                      <div style={{ fontWeight: 600 }}>{customer.customerName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{customer.contactName}</div>
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(customer)}`}>
                        {getStatusText(customer)}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-primary">{customer.saleCount}</span>
                    </td>
                    <td>
                      {formatCurrency(customer.totalSaleAmount)}
                    </td>
                    <td style={{ color: 'var(--success)' }}>
                      {formatCurrency(customer.totalPaid)}
                    </td>
                    <td style={{ color: getDueBadge(customer) === 'badge-danger' ? 'var(--danger)' : '' }}>
                      {formatCurrency(customer.totalDue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {viewCustomer && (
        <CustomerDetailView
          customer={customers.find(c => c.customerName === viewCustomer)}
          formatCurrency={formatCurrency}
          onClose={() => setViewCustomer(null)}
        />
      )}
    </>
  );
};

const AgingTab = ({ sales, formatCurrency }) => {
  const agingSummary = getAgingSummary(sales);
  const agingBuckets = calculateAgingBuckets(sales);

  const getBucketBadge = (amount, bucket) => {
    if (bucket === 'current') return 'badge-success';
    if (bucket === 'aging30') return 'badge-warning';
    if (bucket === 'aging60') return 'badge-secondary';
    return 'badge-danger';
  };

  return (
    <>
      {/* Aging Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon green">🟢</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: 'var(--success)' }}>{formatCurrency(agingSummary.current.amount)}</div>
            <div className="stat-label">Current (0-30 days)</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{agingSummary.current.count} sales</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">🟡</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: 'var(--warning)' }}>{formatCurrency(agingSummary.aging30.amount)}</div>
            <div className="stat-label">31-60 days overdue</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{agingSummary.aging30.count} sales</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">🔴</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: agingSummary.aging60.amount + agingSummary.aging90plus.amount > 0 ? 'var(--danger)' : 'var(--success)' }}>{formatCurrency(agingSummary.aging60.amount + agingSummary.aging90plus.amount)}</div>
            <div className="stat-label">60+ days overdue</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{agingSummary.aging60.count + agingSummary.aging90plus.count} sales</div>
          </div>
        </div>
        <div className="stat-card" style={{ background: agingSummary.totalOverdue > 0 ? 'var(--danger-light)' : 'var(--bg-secondary)' }}>
          <div className="stat-icon" style={{ color: agingSummary.totalOverdue > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>⏳</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: agingSummary.totalOverdue > 0 ? 'var(--danger)' : 'var(--success)' }}>{formatCurrency(agingSummary.totalOverdue)}</div>
            <div className="stat-label">Total Overdue</div>
          </div>
        </div>
      </div>

      {/* Aging Details by Bucket */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">⏳ Payment Aging Details</div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Sale Date</th>
                <th>Due Amount</th>
                <th>Days Overdue</th>
                <th>Aging Status</th>
              </tr>
            </thead>
            <tbody>
              {[...agingBuckets.aging30.sales, ...agingBuckets.aging60.sales, ...agingBuckets.aging90plus.sales]
                .sort((a, b) => b.daysOverdue - a.daysOverdue)
                .map((sale, idx) => (
                  <tr key={idx} style={{ background: sale.daysOverdue > 60 ? 'var(--danger-light)' : sale.daysOverdue > 30 ? 'var(--warning-light)' : '' }}>
                    <td style={{ fontWeight: 600 }}>{sale.businessName}</td>
                    <td style={{ fontSize: 12 }}>{new Date(sale.createdAt).toLocaleDateString('en-IN')}</td>
                    <td style={{ fontWeight: 700, color: 'var(--danger)' }}>{formatCurrency(sale.baseAmount || sale.amount)}</td>
                    <td>
                      <span className={`badge ${sale.daysOverdue > 60 ? 'badge-danger' : sale.daysOverdue > 30 ? 'badge-warning' : 'badge-info'}`}>
                        {sale.daysOverdue} days
                      </span>
                    </td>
                    <td>
                      {sale.daysOverdue > 60 ? '🔴 Critical' : sale.daysOverdue > 30 ? '🟡 Overdue' : '🟢 Attention'}
                    </td>
                  </tr>
                ))}
              {agingBuckets.aging30.sales.length + agingBuckets.aging60.sales.length + agingBuckets.aging90plus.sales.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
                    No overdue payments
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

const CustomerDetailView = ({ customer, formatCurrency, onClose }) => {
  if (!customer) return null;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header">
        <div className="card-title">📋 Customer Details: {customer.customerName}</div>
        <button className="btn btn-icon btn-ghost" onClick={onClose}>✕</button>
      </div>
      <div className="card-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Total Sales</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(customer.totalSaleAmount)}</div>
          </div>
          <div style={{ padding: 16, background: 'var(--success-light)', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Total Paid</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(customer.totalPaid)}</div>
          </div>
          <div style={{ padding: 16, background: customer.totalDue > 0 ? 'var(--danger-light)' : 'var(--success-light)', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Total Due</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: customer.totalDue > 0 ? 'var(--danger)' : 'var(--success)' }}>{formatCurrency(customer.totalDue)}</div>
          </div>
          <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Sales Count</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>{customer.saleCount}</div>
          </div>
        </div>
        <h4 style={{ marginBottom: 12 }}>📋 Sales Breakdown</h4>
        <table>
          <thead>
            <tr>
              <th>Sale ID</th>
              <th>Proposal</th>
              <th>Amount</th>
              <th>Paid</th>
              <th>Due</th>
              <th>Payment</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {customer.sales.map(sale => {
              const saleAmount = sale.baseAmount || sale.amount || 0;
              const salePaid = sale.paymentStatus === 'Full Payment'
                ? saleAmount
                : sale.paymentStatus === 'Installments' && sale.installments > 0
                  ? saleAmount * (sale.paidInstallments || 0) / sale.installments
                  : 0;
              const saleDue = saleAmount - salePaid;
              return (
                <tr key={sale.id}>
                  <td><span style={{ fontFamily: 'monospace' }}>#{sale.id}</span></td>
                  <td>{sale.proposalType || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(saleAmount)}</td>
                  <td style={{ color: 'var(--success)' }}>{formatCurrency(salePaid)}</td>
                  <td style={{ color: saleDue > 0 ? 'var(--danger)' : 'var(--success)' }}>{formatCurrency(saleDue)}</td>
                  <td>
                    <span className={`badge ${sale.paymentStatus === 'Full Payment' ? 'badge-success' : 'badge-warning'}`}>
                      {sale.paymentStatus}
                    </span>
                    {sale.paymentStatus === 'Installments' && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sale.paidInstallments}/{sale.installments} paid</div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${saleDue === 0 ? 'badge-success' : saleDue === saleAmount ? 'badge-danger' : 'badge-warning'}`}>
                      {saleDue === 0 ? 'Paid' : saleDue === saleAmount ? 'Due' : 'Partial'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div><span className="badge badge-success">{customer.fullyPaidSales} Fully Paid</span></div>
          <div><span className="badge badge-warning">{customer.partiallyPaidSales} Partial</span></div>
          <div><span className="badge badge-danger">{customer.unpaidSales} Pending</span></div>
        </div>
      </div>
    </div>
  );
};

const InvoicesTab = ({ allInvoices, updateInvoice, formatCurrency, refreshInvoices, title, currentUser }) => {
  const [viewInvoice, setViewInvoice] = useState(null);

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div className="card-title">{title || `🧾 Invoice Registry`} ({allInvoices.length})</div>
        </div>
        <div className="table-container">
          {allInvoices.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🧾</div>
              <div className="empty-state-title">No invoices yet</div>
              <div className="empty-state-text">Invoices are auto-generated when a sale is created.</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Invoice ID</th>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Generated</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{inv.invoiceNumber || inv.id}</span></td>
                    <td style={{ fontWeight: 600 }}>{inv.client?.businessName || inv.leadName}</td>
                    <td style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(inv.totalAmount || inv.amount)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{inv.invoiceInfo?.invoiceDate || inv.generatedDate}</td>
                    <td style={{ fontSize: 12, color: new Date(inv.invoiceInfo?.dueDate || inv.dueDate) < new Date() && !['Paid', 'FULL'].includes(inv.status) ? 'var(--danger)' : 'var(--text-muted)' }}>
                      {inv.invoiceInfo?.dueDate || inv.dueDate}
                    </td>
                    <td>
                      <span className={`badge ${['Paid', 'FULL'].includes(inv.status) ? 'badge-success' : ['Cancelled', 'CANCELLED'].includes(inv.status) ? 'badge-danger' : 'badge-warning'}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => setViewInvoice(inv)}>👁 View</button>
                        {['Pending', 'PENDING'].includes(inv.status) && (
                          <>
                            <button className="btn btn-sm btn-success" onClick={() => {
                              markInvoicePaid(inv.id, currentUser?.name);
                              if (refreshInvoices) refreshInvoices();
                            }}>✅ Mark Paid</button>
                            <button className="btn btn-sm btn-danger" onClick={() => updateInvoice(inv.id, { status: 'CANCELLED' })}>✕</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {viewInvoice && (
        <InvoiceView invoiceId={viewInvoice.id} onClose={() => { setViewInvoice(null); if (refreshInvoices) refreshInvoices(); }} />
      )}
    </>
  );
};

export default SalesPage;

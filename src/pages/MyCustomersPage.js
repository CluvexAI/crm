import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BASE_CURRENCY, formatCurrencyAmount } from '../services/currencyService';
import CreateProposal from '../components/CreateProposal';

const MyCustomersPage = () => {
  const { myCustomers, currentUser, myInvoices, myLeads, updateLead, deleteCustomer, sendEmail } = useApp();
  const [alertModal, setAlertModal] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [activeTab, setActiveTab] = useState('customers');
  const [buildingProposal, setBuildingProposal] = useState(null);

  const isAdmin = currentUser.role === 'Admin';
  
  const convertedCustomers = myCustomers;
  const assignedLeads = myLeads.filter(l => l.status !== 'Closed (Won)' && l.status !== 'Closed (Lost)');
  
  const customers = convertedCustomers;
  const leads = assignedLeads;

  const filtered = customers.filter(c => 
    !search || 
    c.businessName.toLowerCase().includes(search.toLowerCase()) ||
    c.leadName?.toLowerCase().includes(search.toLowerCase()) ||
    c.contactName?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredLeads = leads.filter(l => 
    !search || 
    l.businessName.toLowerCase().includes(search.toLowerCase()) ||
    l.contactName?.toLowerCase().includes(search.toLowerCase()) ||
    l.ownerPhone?.includes(search)
  );

  const getInvoicesByCustomerId = (customerId) => {
    return myInvoices.filter(inv => inv.saleId === customerId);
  };

  const getStatusBadge = (sale) => {
    if (sale.saleStatus === 'Closed') return 'badge-success';
    if (sale.saleStatus === 'Pending') return 'badge-warning';
    return 'badge-neutral';
  };

  const getPaymentBadge = (sale) => {
    if (sale.paymentStatus === 'Full Payment') return 'badge-success';
    if (sale.paymentStatus === 'Installments') {
      const plan = sale.installmentPlan || [];
      if (plan.length > 0) {
        const paidCount = plan.filter(i => i.status === 'paid').length;
        if (paidCount === plan.length) return 'badge-success';
        if (paidCount > 0) return 'badge-warning';
        return 'badge-danger';
      }
      if (sale.paidInstallments === sale.installments) return 'badge-success';
      if (sale.paidInstallments > 0) return 'badge-warning';
      return 'badge-danger';
    }
    return 'badge-neutral';
  };

  const formatCurrency = (n) => formatCurrencyAmount(n || 0, BASE_CURRENCY);

  const handleSendProposalEmail = async (customer, fmt) => {
    if (!customer.email) {
      setAlertModal({ title: '⚠️ No Email', message: 'Customer has no email address.' });
      return;
    }
    const proposals = customer.proposals || [{ type: customer.proposalType, amount: customer.amount }];
    const proposalList = proposals.map(p => `<li>${p.type || 'Service'}: ${fmt(p.amount)}</li>`).join('');
    const additionalNotes = proposals[0]?.additionalNotes || '';
    
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0E5491; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .proposal-box { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #0E5491; }
    .amount { font-size: 24px; font-weight: bold; color: #0E5491; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Quotation for ${customer.businessName}</h1>
    </div>
    <div class="content">
      <p>Dear ${customer.leadName || customer.contactName || 'Valued Customer'},</p>
      <p>Thank you for your interest in our services. Please find your proposal details below:</p>
      <div class="proposal-box">
        <ul>${proposalList}</ul>
        ${additionalNotes ? `<p><strong>Notes:</strong> ${additionalNotes}</p>` : ''}
        <p class="amount">Total: ${fmt(customer.amount)}</p>
      </div>
      <p>This quotation is valid for 30 days. Please feel free to reach out if you have any questions.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
    
    try {
      if (sendEmail) {
        await sendEmail({
          to: customer.email,
          subject: `Quotation for ${customer.businessName}`,
          html: emailHtml
        });
        setAlertModal({ title: '✅ Sent', message: `Proposal email sent successfully to ${customer.email}!` });
      } else {
        setAlertModal({ title: '⚠️ Email Service Error', message: 'sendEmail context is unavailable.' });
      }
    } catch (e) {
      setAlertModal({ title: '❌ Send Failed', message: 'Failed to send email: ' + e.message });
    }
  };

  const statusColor = (s) => {
    const map = {
      'New Lead': 'badge-info', 'Follow-Up': 'badge-warning', 'Pending': 'badge-secondary',
      'Closed (Won)': 'badge-success', 'Closed (Lost)': 'badge-danger', 'Expired': 'badge-neutral',
    };
    return map[s] || 'badge-neutral';
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="toolbar">
        <div className="search-bar">
          🔍 <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search customers..." 
          />
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 20, display: 'flex', gap: 8, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
        <button 
          className={`btn ${activeTab === 'customers' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('customers')}
        >
          🤝 Customers ({filtered.length})
        </button>
        <button 
          className={`btn ${activeTab === 'leads' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('leads')}
        >
          📋 Assigned Leads ({filteredLeads.length})
        </button>
      </div>

      {activeTab === 'customers' && (
        <div>
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-icon blue">👥</div>
              <div className="stat-info">
                <div className="stat-value">{filtered.length}</div>
                <div className="stat-label">Total Customers</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green">💰</div>
              <div className="stat-info">
                <div className="stat-value">{formatCurrency(filtered.reduce((sum, c) => sum + (c.amount || 0), 0))}</div>
                <div className="stat-label">Total Value</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon teal">✅</div>
              <div className="stat-info">
                <div className="stat-value">{filtered.filter(c => c.saleStatus === 'Closed').length}</div>
                <div className="stat-label">Closed Deals</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon orange">⏳</div>
              <div className="stat-info">
                <div className="stat-value">{filtered.filter(c => c.saleStatus === 'Pending').length}</div>
                <div className="stat-label">Pending</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">🤝 My Customers ({filtered.length})</div>
            </div>
            <div className="table-container">
              {filtered.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">👥</div>
                  <div className="empty-state-title">No customers yet</div>
                  <div className="empty-state-text">
                    {isAdmin ? 'No sales records found.' : 'Convert your leads to see your customers here.'}
                  </div>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Customer</th>
                      <th>Proposal</th>
                      <th>Amount</th>
                      <th>Sale Status</th>
                      <th>Payment</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((customer, idx) => (
                      <tr 
                        key={customer.id}
                        style={{
                          cursor: 'pointer',
                          background: selectedCustomer === customer.id ? 'var(--bg-secondary)' : ''
                        }}
                        onClick={() => setSelectedCustomer(selectedCustomer === customer.id ? null : customer.id)}
                      >
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{customer.businessName}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{customer.leadName}</div>
                        </td>
                        <td>
                          {customer.proposalType ? (
                            <span className="badge badge-primary" style={{ fontSize: 11 }}>{customer.proposalType}</span>
                          ) : '—'}
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                          {formatCurrency(customer.amount)}
                        </td>
                        <td>
                          <span className={`badge ${getStatusBadge(customer)}`}>
                            {customer.saleStatus}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${getPaymentBadge(customer)}`}>
                            {customer.paymentStatus === 'Installments' 
                              ? `${customer.paidInstallments}/${customer.installments} paid`
                              : customer.paymentStatus}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button 
                              className="btn btn-sm btn-ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCustomer(selectedCustomer === customer.id ? null : customer.id);
                              }}
                            >
                              {selectedCustomer === customer.id ? '👁 View' : '📋 Details'}
                            </button>
                            {isAdmin && (
                              <button 
                                className="btn btn-sm btn-danger"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const confirmed = window.confirm(
                                    `🗑 Permanently delete this customer?\n\n` +
                                    `Business: ${customer.businessName}\n` +
                                    `Amount: ${formatCurrency(customer.amount)}\n\n` +
                                    `⚠️ Warning: This action cannot be undone. All related sales and invoice data will be affected.`
                                  );
                                  if (confirmed) {
                                    try {
                                      await deleteCustomer(customer.id);
                                      alert('✅ Customer deleted successfully!');
                                    } catch (err) {
                                      alert('❌ Error: ' + err.message);
                                    }
                                  }
                                }}
                                title="Delete Customer"
                              >
                                🗑
                              </button>
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
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">📋 Assigned Leads ({filteredLeads.length})</div>
          </div>
          <div className="table-container">
            {filteredLeads.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-title">No assigned leads</div>
                <div className="empty-state-text">
                  {isAdmin ? 'No leads found.' : 'Leads assigned to you will appear here.'}
                </div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Client</th>
                    <th>Business</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead, idx) => (
                    <tr key={lead.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{lead.contactName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lead.email || '—'}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13 }}>{lead.businessName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lead.businessCategory}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12 }}>{lead.ownerPhone}</div>
                      </td>
                      <td>
                        <span className={`badge ${statusColor(lead.status)}`}>
                          {lead.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td>
                        <button className="btn btn-sm btn-primary" onClick={() => setBuildingProposal(lead)}>
                          📝 Create Proposal
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {selectedCustomer && (
        <CustomerDetailModal 
          customer={filtered.find(c => c.id === selectedCustomer)}
          invoices={getInvoicesByCustomerId(selectedCustomer)}
          formatCurrency={formatCurrency}
          onClose={() => setSelectedCustomer(null)}
          onSendProposalEmail={handleSendProposalEmail}
        />
      )}

      {buildingProposal && (
        <CreateProposal
          lead={buildingProposal}
          onClose={() => setBuildingProposal(null)}
          onSave={(proposalData) => {
            if (updateLead) {
              updateLead(buildingProposal.id, {
                status: proposalData.status === 'sent' ? 'Proposal Sent' : 'Draft',
                lastProposal: proposalData,
              });
            }
            setBuildingProposal(null);
          }}
        />
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

const CustomerDetailModal = ({ customer, invoices, formatCurrency, onClose, onSendProposalEmail }) => {
  if (!customer) return null;

  const getPaymentBadge = (sale) => {
    if (sale.paymentStatus === 'Full Payment') return 'badge-success';
    if (sale.paymentStatus === 'Installments') {
      if (sale.paidInstallments === sale.installments) return 'badge-success';
      if (sale.paidInstallments > 0) return 'badge-warning';
      return 'badge-danger';
    }
    return 'badge-neutral';
  };

  const getInvoiceStatusBadge = (status) => {
    if (['Paid', 'FULL'].includes(status)) return 'badge-success';
    if (['Cancelled', 'CANCELLED'].includes(status)) return 'badge-danger';
    return 'badge-warning';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{customer.businessName}</h2>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Contact</div>
              <div style={{ fontWeight: 600 }}>{customer.leadName}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Email</div>
              <div>{customer.email || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Phone</div>
              <div>{customer.phone || customer.ownerPhone || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Category</div>
              <div>{customer.businessCategory || customer.category || '—'}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{ padding: 16, background: 'var(--primary-light)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Total Amount</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>
                {formatCurrency(customer.amount)}
              </div>
            </div>
            <div style={{ padding: 16, background: 'var(--success-light)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Sale Status</div>
              <div style={{ fontWeight: 600 }}>{customer.saleStatus}</div>
            </div>
            <div style={{ padding: 16, background: 'var(--warning-light)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Payment</div>
              <div style={{ fontWeight: 600 }}>{customer.paymentStatus}</div>
            </div>
            <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Proposal</div>
              <div style={{ fontWeight: 600 }}>{customer.proposalType || '—'}</div>
            </div>
          </div>

          {customer.proposals && customer.proposals.length > 0 && (
            <>
              <h4 style={{ marginBottom: 12 }}>📄 Proposals</h4>
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.proposals.map((proposal, idx) => (
                    <tr key={idx}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{proposal.type || 'Unnamed Proposal'}</div>
                        {proposal.package && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Package: {proposal.package}</div>
                        )}
                        {proposal.description && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{proposal.description}</div>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(proposal.amount)}</td>
                      <td>
                        <span className="badge badge-success">Sent</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {invoices.length > 0 && (
            <>
              <h4 style={{ marginBottom: 12 }}>🧾 Invoices</h4>
              <table>
                <thead>
                  <tr>
                    <th>Invoice ID</th>
                    <th>Amount</th>
                    <th>Due Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id}>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{inv.id}</span></td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(inv.totalAmount || inv.amount)}</td>
                      <td>{inv.dueDate || '—'}</td>
                      <td>
                        <span className={`badge ${getInvoiceStatusBadge(inv.status)}`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
            <span className={`badge ${customer.saleStatus === 'Closed' ? 'badge-success' : 'badge-warning'}`}>
              {customer.saleStatus}
            </span>
            <span className={`badge ${getPaymentBadge(customer)}`}>
              {customer.paymentStatus}
            </span>
            <span className="badge badge-neutral">
              Closed by: {customer.closedByName}
            </span>
          </div>
        </div>
        <div className="modal-footer">
          {customer.email && (
            <button className="btn btn-primary" onClick={() => onSendProposalEmail(customer, formatCurrency)}>
              📧 Send Proposal Email
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default MyCustomersPage;

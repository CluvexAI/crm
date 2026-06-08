import React, { useState, useEffect } from 'react';

const DNSRecordsSetup = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formType, setFormType] = useState('A'); // A, CNAME or MX

  const [formData, setFormData] = useState({
    name: '',
    value: '',
    ttl: '3600',
    priority: '10'
  });

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch((process.env.REACT_APP_API_URL || '') + '/api/custom-dns-records');
      const json = await res.json();
      if (json.success) {
        setRecords(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleOpenModal = (type, record = null) => {
    setFormType(type);
    if (record) {
      setEditingRecord(record);
      setFormData({
        name: record.name,
        value: record.value,
        ttl: record.ttl || '3600',
        priority: record.priority || '10'
      });
    } else {
      setEditingRecord(null);
      if (type === 'A') {
        setFormData({
          name: 'crm.zsmeservices.com',
          value: '95.111.238.145',
          ttl: '14400',
          priority: '10'
        });
      } else if (type === 'CNAME') {
        setFormData({
          name: 'crm.zsmeservices.com',
          value: 'zsmeservices.com',
          ttl: '3600',
          priority: '10'
        });
      } else {
        setFormData({
          name: 'crm.zsmeservices.com',
          value: 'mail.zsmeservices.com',
          ttl: '14400',
          priority: '0'
        });
      }
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
  };

  const handleSave = async () => {
    try {
      const url = editingRecord
        ? `/api/custom-dns-records/${editingRecord.id}`
        : '/api/custom-dns-records';

      const method = editingRecord ? 'PUT' : 'POST';

      const payload = {
        name: formData.name,
        value: formData.value,
        ttl: parseInt(formData.ttl, 10),
        type: formType
      };

      if (formType === 'MX') {
        payload.priority = parseInt(formData.priority, 10);
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json.success) {
        showToast(editingRecord ? 'Record updated successfully.' : 'Record added successfully.');
        handleCloseModal();
        fetchRecords();
      } else {
        alert('Error saving record: ' + json.message);
      }
    } catch (err) {
      console.error(err);
      alert('Error saving record.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this DNS record?')) {
      try {
        const res = await fetch(`/api/custom-dns-records/${id}`, {
          method: 'DELETE'
        });
        const json = await res.json();
        if (json.success) {
          showToast('Record deleted successfully.');
          fetchRecords();
        } else {
          alert('Error deleting record: ' + json.message);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleVerify = async (id) => {
    try {
      const res = await fetch(`/api/custom-dns-records/${id}/verify`, {
        method: 'POST'
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message);
        fetchRecords();
      } else {
        alert('Error verifying record: ' + json.message);
      }
    } catch (err) {
      console.error(err);
      alert('Error verifying record.');
    }
  };

  const handleCopy = (record) => {
    let text = `Name: ${record.name}\nType: ${record.type}\nTTL: ${record.ttl}\n`;
    if (record.type === 'MX') {
      text += `Priority: ${record.priority}\nValue: ${record.value}`;
    } else {
      text += `Value: ${record.value}`;
    }

    navigator.clipboard.writeText(text).then(() => {
      showToast('DNS record copied successfully.');
    });
  };

  const aRecords = records.filter(r => r.type === 'A');
  const cnameRecords = records.filter(r => r.type === 'CNAME');
  const mxRecords = records.filter(r => r.type === 'MX');

  const getStatusBadge = (status) => {
    if (status === 'Verified') return <span className="badge badge-success">Verified</span>;
    if (status === 'Pending') return <span className="badge badge-warning" style={{ backgroundColor: '#f39c12', color: '#fff' }}>Pending Verification</span>;
    if (status === 'Failed') return <span className="badge badge-danger">Failed</span>;
    return <span className="badge badge-neutral">{status}</span>;
  };

  return (
    <div className="card-body">
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#2c3e50', color: 'white', padding: '12px 20px', borderRadius: 8, zIndex: 9999, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          {toast}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>DNS Records Setup & Verification</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={() => handleOpenModal('A')}>+ Add A Record</button>
          <button className="btn btn-secondary" onClick={() => handleOpenModal('MX')}>+ Add MX Record</button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}>Loading DNS records...</div>
      ) : (
        <>
          <div style={{ marginBottom: 30 }}>
            <h3>A Records</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 15 }}>Used for pointing subdomain to an IP address (e.g., crm.zsmeservices.com → 95.111.238.145)</p>
            <div className="table-container">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-light)', textAlign: 'left' }}>
                    <th style={{ padding: 10 }}>Name</th>
                    <th>Type</th>
                    <th>TTL</th>
                    <th>Value / Points To</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {aRecords.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: 10 }}>{r.name}</td>
                      <td>{r.type}</td>
                      <td>{r.ttl}</td>
                      <td>{r.value}</td>
                      <td>{getStatusBadge(r.status)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button className="btn btn-sm btn-outline" onClick={() => handleCopy(r)}>Copy</button>
                          <button className="btn btn-sm btn-success" onClick={() => handleVerify(r.id)}>Verify</button>
                          <button className="btn btn-sm btn-outline" onClick={() => handleOpenModal('A', r)}>Edit</button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r.id)}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {aRecords.length === 0 && (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: 20 }}>No A records configured.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginBottom: 30 }}>
            <h3>CNAME Records</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 15 }}>Used for adding a sub-domain (e.g., mail.zsmeservices.com)</p>
            <div className="table-container">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-light)', textAlign: 'left' }}>
                    <th style={{ padding: 10 }}>Name</th>
                    <th>Type</th>
                    <th>TTL</th>
                    <th>Value / Points To</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cnameRecords.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: 10 }}>{r.name}</td>
                      <td>{r.type}</td>
                      <td>{r.ttl}</td>
                      <td>{r.value}</td>
                      <td>{getStatusBadge(r.status)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button className="btn btn-sm btn-outline" onClick={() => handleCopy(r)}>Copy</button>
                          <button className="btn btn-sm btn-success" onClick={() => handleVerify(r.id)}>Verify</button>
                          <button className="btn btn-sm btn-outline" onClick={() => handleOpenModal('CNAME', r)}>Edit</button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r.id)}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {cnameRecords.length === 0 && (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: 20 }}>No CNAME records configured.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3>MX Records</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 15 }}>Used for mail routing and delivery setup</p>
            <div className="table-container">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-light)', textAlign: 'left' }}>
                    <th style={{ padding: 10 }}>Name</th>
                    <th>Type</th>
                    <th>Priority</th>
                    <th>TTL</th>
                    <th>Value / Mail Server</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mxRecords.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: 10 }}>{r.name}</td>
                      <td>{r.type}</td>
                      <td>{r.priority}</td>
                      <td>{r.ttl}</td>
                      <td>{r.value}</td>
                      <td>{getStatusBadge(r.status)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button className="btn btn-sm btn-outline" onClick={() => handleCopy(r)}>Copy</button>
                          <button className="btn btn-sm btn-success" onClick={() => handleVerify(r.id)}>Verify</button>
                          <button className="btn btn-sm btn-outline" onClick={() => handleOpenModal('MX', r)}>Edit</button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r.id)}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {mxRecords.length === 0 && (
                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: 20 }}>No MX records configured.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal for Add/Edit */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{
            background: 'var(--bg-primary, #fff)',
            padding: 30, borderRadius: 12, width: '100%', maxWidth: 500,
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: 20 }}>
              {editingRecord ? `Edit ${formType} Record` : `Add ${formType} Record`}
            </h3>

            <div className="form-group" style={{ marginBottom: 15 }}>
              <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Name</label>
              <input
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-light)', borderRadius: 6 }}
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder={formType === 'MX' ? '@' : 'mail'}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 15 }}>
              <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Type</label>
              <select
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-light)', borderRadius: 6 }}
                value={formType}
                onChange={e => {
                  const newType = e.target.value;
                  setFormType(newType);
                  if (!editingRecord) {
                    if (newType === 'A') {
                      setFormData({ ...formData, name: 'crm.zsmeservices.com', value: '95.111.238.145', ttl: '14400' });
                    } else if (newType === 'CNAME') {
                      setFormData({ ...formData, name: 'crm.zsmeservices.com', value: 'zsmeservices.com', ttl: '3600' });
                    } else {
                      setFormData({ ...formData, name: 'crm.zsmeservices.com', value: 'mail.zsmeservices.com', ttl: '14400', priority: '0' });
                    }
                  }
                }}
              >
                <option value="A">A</option>
                <option value="CNAME">CNAME</option>
                <option value="MX">MX</option>
              </select>
            </div>

            {formType === 'MX' && (
              <div className="form-group" style={{ marginBottom: 15 }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Priority</label>
                <input
                  className="form-control"
                  type="number"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-light)', borderRadius: 6 }}
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: e.target.value })}
                />
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 15 }}>
              <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>TTL</label>
              <input
                className="form-control"
                type="number"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-light)', borderRadius: 6 }}
                value={formData.ttl}
                onChange={e => setFormData({ ...formData, ttl: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 25 }}>
              <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>
                {formType === 'MX' ? 'Value / Mail Server' : 'Value / Points To'}
              </label>
              <input
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-light)', borderRadius: 6 }}
                value={formData.value}
                onChange={e => setFormData({ ...formData, value: e.target.value })}
                placeholder="mail.zsmeservices.com"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-outline" onClick={handleCloseModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save Record</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DNSRecordsSetup;

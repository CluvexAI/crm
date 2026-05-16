import React, { useState, useRef, useEffect } from 'react';
import RichTextEditor from './RichTextEditor';

const EMAIL_TEMPLATES = [
  { id: 1, name: 'Welcome Email', subject: 'Welcome to ZSM CRM', body: '<h3>Welcome aboard!</h3><p>We are thrilled to have you here.</p>' },
  { id: 2, name: 'Invoice Email', subject: 'Your Invoice is Ready', body: '<p>Dear Customer,</p><p>Please find your invoice attached.</p>' },
  { id: 3, name: 'Lead Follow-up', subject: 'Following up on our conversation', body: '<p>Hi,</p><p>I am following up regarding our recent discussion.</p>' },
  { id: 4, name: 'Meeting Reminder', subject: 'Reminder: Upcoming Meeting', body: '<p>This is a reminder for our upcoming meeting tomorrow.</p>' },
];

const EmailComposer = ({ currentUser, onClose, onSend, onSaveDraft, initialData = null }) => {
  const [to, setTo] = useState(initialData?.to || '');
  const [cc, setCc] = useState(initialData?.cc || '');
  const [bcc, setBcc] = useState(initialData?.bcc || '');
  const [showCc, setShowCc] = useState(!!initialData?.cc || !!initialData?.bcc);
  const [subject, setSubject] = useState(initialData?.subject || '');
  const [body, setBody] = useState(initialData?.body || '');
  
  const [attachments, setAttachments] = useState(initialData?.attachments || []);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [includeSignature, setIncludeSignature] = useState(true);
  
  const [previewMode, setPreviewMode] = useState(false);
  const [sending, setSending] = useState(false);

  const fileInputRef = useRef(null);

  const getSignature = () => {
    if (!currentUser) return '';
    return `<br><br><div style="color: #666; font-size: 13px; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 20px;">
      <b>Regards,</b><br>
      ${currentUser.name}<br>
      ${currentUser.role}<br>
      ${currentUser.department || 'ZSM CRM'}
    </div>`;
  };

  const handleTemplateChange = (e) => {
    const tplId = e.target.value;
    setSelectedTemplate(tplId);
    if (!tplId) return;
    
    const template = EMAIL_TEMPLATES.find(t => t.id === parseInt(tplId));
    if (template) {
      setSubject(template.subject);
      setBody(template.body);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
        file
      }));
      setAttachments([...attachments, ...newFiles]);
    }
  };

  const removeAttachment = (idx) => {
    setAttachments(attachments.filter((_, i) => i !== idx));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
        file
      }));
      setAttachments([...attachments, ...newFiles]);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const sanitizeHtml = (html) => {
    // Basic sanitization - a production app should use DOMPurify
    let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    clean = clean.replace(/on\w+="[^"]*"/g, ""); // Remove inline event handlers
    return clean;
  };

  const handleSend = async () => {
    if (!to) return alert("Please specify at least one recipient.");
    if (!subject) return alert("Please specify a subject.");
    
    setSending(true);
    let finalBody = body;
    if (includeSignature) {
      finalBody += getSignature();
    }
    
    finalBody = sanitizeHtml(finalBody);

    try {
      await onSend({
        to,
        cc,
        bcc,
        subject,
        body: finalBody,
        attachments
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = () => {
    if (onSaveDraft) {
      onSaveDraft({
        to, cc, bcc, subject, body, attachments
      });
    }
  };

  if (previewMode) {
    let finalBody = body;
    if (includeSignature) {
      finalBody += getSignature();
    }
    
    return (
      <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="card-title">👁️ Email Preview</div>
          <button className="btn btn-ghost" onClick={() => setPreviewMode(false)}>✕ Close Preview</button>
        </div>
        <div className="card-body" style={{ flex: 1, overflowY: 'auto', background: '#f5f7f9', padding: 20 }}>
          <div style={{ background: 'white', padding: 30, borderRadius: 8, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', maxWidth: 800, margin: '0 auto' }}>
            <div style={{ marginBottom: 20, borderBottom: '1px solid #eee', paddingBottom: 15 }}>
              <div style={{ marginBottom: 8 }}><b>To:</b> {to}</div>
              {cc && <div style={{ marginBottom: 8 }}><b>CC:</b> {cc}</div>}
              {bcc && <div style={{ marginBottom: 8 }}><b>BCC:</b> {bcc}</div>}
              <div style={{ fontSize: 20, fontWeight: 'bold', marginTop: 15 }}>{subject}</div>
            </div>
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(finalBody) }} style={{ minHeight: 200 }} />
            
            {attachments.length > 0 && (
              <div style={{ marginTop: 30, borderTop: '1px solid #eee', paddingTop: 15 }}>
                <b>Attachments:</b>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                  {attachments.map((att, i) => (
                    <div key={i} style={{ padding: '8px 12px', background: '#f0f0f0', borderRadius: 4, fontSize: 12 }}>
                      📎 {att.name} ({formatSize(att.size)})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.3s ease' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '10px 20px' }}>
        <div className="card-title" style={{ fontSize: 16 }}>✉️ Compose Message</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className="form-control" style={{ width: 150, height: 32 }} value={selectedTemplate} onChange={handleTemplateChange}>
            <option value="">Insert Template...</option>
            {EMAIL_TEMPLATES.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
      </div>

      <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflowY: 'auto' }}>
        <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ width: 60, color: 'var(--text-muted)', fontWeight: 600 }}>To:</span>
            <input className="form-control" style={{ flex: 1, border: 'none', background: 'transparent', boxShadow: 'none', borderBottom: '1px solid #eee', borderRadius: 0 }} placeholder="recipients (comma separated)" value={to} onChange={e => setTo(e.target.value)} />
            <span style={{ color: 'var(--primary)', cursor: 'pointer', fontSize: 12, marginLeft: 10 }} onClick={() => setShowCc(!showCc)}>Cc/Bcc</span>
          </div>
          
          {showCc && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, animation: 'slideDown 0.2s ease' }}>
                <span style={{ width: 60, color: 'var(--text-muted)', fontWeight: 600 }}>Cc:</span>
                <input className="form-control" style={{ flex: 1, border: 'none', background: 'transparent', boxShadow: 'none', borderBottom: '1px solid #eee', borderRadius: 0 }} value={cc} onChange={e => setCc(e.target.value)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, animation: 'slideDown 0.2s ease' }}>
                <span style={{ width: 60, color: 'var(--text-muted)', fontWeight: 600 }}>Bcc:</span>
                <input className="form-control" style={{ flex: 1, border: 'none', background: 'transparent', boxShadow: 'none', borderBottom: '1px solid #eee', borderRadius: 0 }} value={bcc} onChange={e => setBcc(e.target.value)} />
              </div>
            </>
          )}

          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ width: 60, color: 'var(--text-muted)', fontWeight: 600 }}>Subject:</span>
            <input className="form-control" style={{ flex: 1, border: 'none', background: 'transparent', boxShadow: 'none', borderBottom: '1px solid #eee', borderRadius: 0, fontWeight: 600 }} placeholder="Email subject" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <RichTextEditor value={body} onChange={setBody} placeholder="Write your email here..." />
        </div>

        <div 
          onDragOver={handleDragOver} 
          onDrop={handleDrop}
          style={{ padding: '15px 20px', borderTop: '1px solid var(--border-color)', background: '#fafafa' }}
        >
          {attachments.length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 15 }}>
              {attachments.map((att, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', background: 'white', border: '1px solid #ddd', padding: '5px 10px', borderRadius: 4, fontSize: 12 }}>
                  <span style={{ marginRight: 8 }}>📎 {att.name}</span>
                  <span style={{ color: '#999', marginRight: 10 }}>({formatSize(att.size)})</span>
                  <button className="btn btn-ghost btn-sm" style={{ padding: 0, width: 20, height: 20, minWidth: 20, color: '#e74c3c' }} onClick={() => removeAttachment(idx)}>✕</button>
                </div>
              ))}
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
              <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
              <button className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()}>
                📎 Attach Files
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Or drag and drop files here</span>
            </div>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={includeSignature} onChange={e => setIncludeSignature(e.target.checked)} />
              Include Signature
            </label>
          </div>
        </div>
      </div>

      <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-secondary)' }}>
        <button className="btn btn-outline" onClick={handleSaveDraft}>💾 Save Draft</button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={() => setPreviewMode(true)}>👁️ Preview</button>
          <button className="btn btn-primary" onClick={handleSend} disabled={sending}>
            {sending ? '⏳ Sending...' : '📤 Send Email'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailComposer;

import React, { useState, useRef } from 'react';
import {
  validateProfileImage,
  formatFileSize,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_LABEL,
} from '../services/uploadService';
import { useApp } from '../context/AppContext';

/**
 * ProfileImageUpload
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable component for displaying, uploading, and replacing an employee's
 * profile image.
 *
 * Props:
 *   targetUser   {object}  — the employee whose image is being managed
 *   size         {number}  — avatar circle diameter in px (default 96)
 *   showMeta     {boolean} — whether to show file size / type info below avatar
 *   readOnly     {boolean} — force read-only (e.g. HR viewer mode)
 * ─────────────────────────────────────────────────────────────────────────────
 */
const ProfileImageUpload = ({ targetUser, size = 96, showMeta = false, readOnly = false }) => {
  const { currentUser, uploadEmployeeProfileImage, deleteEmployeeProfileImage, rbac } = useApp();
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  if (!targetUser) return null;

  // ── RBAC Checks (mirrors server-side guards) ──────────────────────────────
  const canUpload = !readOnly && rbac.canUploadImageFor(targetUser.uuid);
  const canDelete = !readOnly && rbac.can('DELETE_PROFILE_IMAGE');
  const canView   = rbac.canUploadImageFor(targetUser.uuid) || rbac.can('VIEW_PROFILE_IMAGE');

  const displayUrl = previewUrl || targetUser.profileImageUrl;
  const initials   = targetUser.name
    ? targetUser.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const clearMessages = () => { setError(''); setSuccess(''); };

  // ── Pre-upload client-side validation ─────────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    clearMessages();

    // Client-side validation (mirrors server-side guard in uploadService)
    const validation = validateProfileImage(file);
    if (!validation.valid) {
      setError(validation.error);
      e.target.value = '';
      return;
    }

    // Instant preview so user sees the image before upload completes
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    // Upload via service (validates again server-side, returns URL + metadata)
    setUploading(true);
    try {
      await uploadEmployeeProfileImage(targetUser.uuid, file);
      setSuccess('✅ Profile image updated successfully.');
      setPreviewUrl(null); // clear preview; component will now use stored URL
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
      URL.revokeObjectURL(localPreview);
      setPreviewUrl(null);
    } finally {
      setUploading(false);
      e.target.value = '';
      setTimeout(clearMessages, 4000);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Remove this employee\'s profile image?')) return;
    clearMessages();
    setUploading(true);
    try {
      await deleteEmployeeProfileImage(targetUser.uuid);
      setSuccess('Profile image removed.');
      setPreviewUrl(null);
    } catch (err) {
      setError(err.message || 'Could not remove image.');
    } finally {
      setUploading(false);
      setTimeout(clearMessages, 3000);
    }
  };

  const fontSize = Math.max(14, Math.floor(size * 0.28));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>

      {/* Avatar / Image */}
      <div style={{ position: 'relative', width: size, height: size }}>
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            overflow: 'hidden',
            background: displayUrl
              ? 'transparent'
              : 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize,
            fontWeight: 800,
            color: 'white',
            border: displayUrl ? '3px solid var(--border-light)' : 'none',
            boxShadow: '0 4px 16px rgba(14,84,145,0.15)',
            cursor: canUpload ? 'pointer' : 'default',
            transition: 'var(--transition)',
          }}
          onClick={() => canUpload && !uploading && fileInputRef.current?.click()}
          title={canUpload ? 'Click to change photo' : undefined}
        >
          {displayUrl ? (
            <img
              src={displayUrl}
              alt={`${targetUser.name} profile`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() => setPreviewUrl(null)}
            />
          ) : (
            initials
          )}

          {/* Hover overlay when editable */}
          {canUpload && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(14,84,145,0.55)', opacity: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 20, fontWeight: 700,
              transition: 'opacity 0.2s',
            }}
              className="img-hover-overlay"
              onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = 0; }}
            >
              {uploading ? '⏳' : '📷'}
            </div>
          )}
        </div>

        {/* Uploading spinner badge */}
        {uploading && (
          <div style={{
            position: 'absolute', bottom: 2, right: 2,
            width: 22, height: 22, borderRadius: '50%',
            background: 'var(--primary)', border: '2px solid white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11,
          }}>
            ⏳
          </div>
        )}

        {/* Has-image indicator badge */}
        {!uploading && displayUrl && (
          <div style={{
            position: 'absolute', bottom: 2, right: 2,
            width: 18, height: 18, borderRadius: '50%',
            background: 'var(--success)', border: '2px solid white',
          }} title="Profile image set" />
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(',')}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        id={`profile-img-input-${targetUser.uuid}`}
      />

      {/* Action Buttons */}
      {canUpload && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn-sm btn-outline"
            style={{ fontSize: 11 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : displayUrl ? '🔄 Replace' : '📤 Upload'}
          </button>
          {canDelete && displayUrl && (
            <button
              className="btn btn-sm btn-danger"
              style={{ fontSize: 11 }}
              onClick={handleDelete}
              disabled={uploading}
            >
              🗑
            </button>
          )}
        </div>
      )}

      {/* File metadata */}
      {showMeta && targetUser.profileImageUrl && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
          <div>📁 {targetUser.profileImageName || 'profile image'}</div>
          <div>{formatFileSize(targetUser.profileImageSize)} · {targetUser.profileImageType?.split('/')[1]?.toUpperCase() || '—'}</div>
          {targetUser.profileImageUploadedAt && (
            <div>Uploaded {new Date(targetUser.profileImageUploadedAt).toLocaleDateString('en-IN')}</div>
          )}
        </div>
      )}

      {/* Constraint hint */}
      {canUpload && !uploading && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 160 }}>
          JPG · PNG · WEBP · Max {MAX_IMAGE_SIZE_LABEL}
        </div>
      )}

      {/* Status messages */}
      {error && (
        <div style={{
          fontSize: 12, color: 'var(--danger)', fontWeight: 600,
          background: 'var(--danger-light)', padding: '6px 10px', borderRadius: 6,
          maxWidth: 220, textAlign: 'center',
        }}>
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div style={{
          fontSize: 12, color: '#065f46', fontWeight: 600,
          background: 'var(--success-light)', padding: '6px 10px', borderRadius: 6,
          maxWidth: 220, textAlign: 'center',
        }}>
          {success}
        </div>
      )}
    </div>
  );
};

export default ProfileImageUpload;

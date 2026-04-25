/**
 * uploadService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Simulates a secure backend upload service.
 * In production this would call POST /api/employees/:uuid/profile-image
 * and stream the file to AWS S3 (or equivalent), returning a signed URL.
 *
 * Rules enforced here mirror what a real backend guard would enforce:
 *  - Allowed MIME types: image/jpeg, image/png, image/webp
 *  - Maximum file size: 5 MB
 *  - No video, PDF, or raw binary formats allowed
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_IMAGE_SIZE_LABEL = '5MB';

/**
 * Validates a File object against profile-image constraints.
 * Returns { valid: true } or { valid: false, error: string }
 */
export const validateProfileImage = (file) => {
  if (!file) return { valid: false, error: 'No file selected.' };

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type "${file.type}". Only JPG, PNG, and WEBP are allowed.`,
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File is too large (${sizeMB} MB). Maximum allowed size is ${MAX_IMAGE_SIZE_LABEL}.`,
    };
  }

  return { valid: true };
};

/**
 * Simulates uploading a profile image to cloud storage.
 *
 * Real implementation:
 *   const formData = new FormData();
 *   formData.append('file', file);
 *   const res = await fetch(`/api/employees/${uuid}/profile-image`, {
 *     method: 'POST',
 *     headers: { Authorization: `Bearer ${token}` },
 *     body: formData,
 *   });
 *   const { url, size, type } = await res.json();
 *
 * Simulated: uses URL.createObjectURL() so the image is viewable in-session.
 * Returns the same shape that the real S3 response would return.
 *
 * @param {File} file
 * @param {string} employeeUuid  - UUID of the target employee
 * @returns {Promise<{ url: string, size: number, type: string, name: string }>}
 */
export const uploadProfileImage = async (file, employeeUuid) => {
  // Step 1 – validate (this also runs server-side in production)
  const validation = validateProfileImage(file);
  if (!validation.valid) throw new Error(validation.error);

  // Step 2 – simulate network latency (300–700ms)
  await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));

  // Step 3 – create an object URL (replaces previous blob URLs automatically
  //           when the old one is revoked — mirrors S3 "replace not duplicate")
  const objectUrl = URL.createObjectURL(file);

  return {
    url: objectUrl,                    // In production: the S3 signed URL
    size: file.size,                   // bytes
    type: file.type,                   // MIME type
    name: file.name,                   // original file name
    uploadedAt: new Date().toISOString(),
    storagePath: `employees/${employeeUuid}/profile/${Date.now()}_${file.name}`,
  };
};

/**
 * Simulates revoking / deleting the old profile image from storage.
 * In production: DELETE /api/employees/:uuid/profile-image  →  S3 object delete.
 */
export const deleteProfileImage = async (url) => {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
  await new Promise((r) => setTimeout(r, 150));
  return { success: true };
};

/**
 * Returns a human-readable file size string.
 */
export const formatFileSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

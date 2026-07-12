// VoiceInsights v186 Download Infrastructure
// Signed download descriptors and audit records for rendered artifacts.

export const V186_DOWNLOAD_INFRA_VERSION = 'v186-enterprise-download-infrastructure';

function base64Url(input) {
  if (typeof btoa === 'function') return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return Buffer.from(input).toString('base64url');
}

export function buildSignedDownloadDescriptor({ objectKey, reportId, tenantId, format, expiresInSeconds = 900, actor = 'system', checksum = null } = {}) {
  if (!objectKey) throw new Error('objectKey is required');
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + expiresInSeconds;
  const payload = { objectKey, reportId, tenantId, format, issuedAt, expiresAt, actor };
  return {
    download_infrastructure_version: V186_DOWNLOAD_INFRA_VERSION,
    object_key: objectKey,
    report_id: reportId,
    tenant_id: tenantId,
    format,
    signed_download_url_required: true,
    signed_url_strategy: 'R2 signed URL or Worker-authenticated streaming endpoint',
    token_preview: base64Url(JSON.stringify(payload)).slice(0, 32),
    expires_at: new Date(expiresAt * 1000).toISOString(),
    cache_control: 'private, max-age=0, no-store',
    checksum,
    authorization: {
      require_same_tenant: true,
      public_demo_allowed_only_when_is_demo_and_published: true,
      deny_private_public_access: true,
    },
  };
}

export function buildDownloadAuditRecord({ job, descriptor, event = 'download_url_issued', actor = 'system' } = {}) {
  return {
    audit_version: V186_DOWNLOAD_INFRA_VERSION,
    event,
    actor,
    job_id: job?.id || null,
    report_id: job?.report_id || descriptor?.report_id || null,
    tenant_id: job?.tenant_id || descriptor?.tenant_id || null,
    format: job?.format || descriptor?.format || null,
    object_key: descriptor?.object_key || job?.object_key || null,
    at: new Date().toISOString(),
  };
}

export function validateDownloadAuthorization({ isPublicRoute = false, isDemo = false, status = null, userTenantId = null, artifactTenantId = null } = {}) {
  if (isPublicRoute) return { allowed: !!isDemo && status === 'published', reason: !!isDemo && status === 'published' ? 'published demo artifact' : 'public route can only serve published demo artifacts' };
  return { allowed: !!userTenantId && userTenantId === artifactTenantId, reason: userTenantId === artifactTenantId ? 'same tenant' : 'tenant mismatch' };
}

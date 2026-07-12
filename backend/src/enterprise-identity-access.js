// VoiceInsights v210.3A — Enterprise Identity & Access
// IAM, MFA, SSO, SCIM and scoped API-key control plane.

export const V2103A_VERSION = 'v210.3A.0';

export const ROLE_PERMISSIONS = Object.freeze({
  founder_executive: ['*'],
  super_admin: ['organization.read','organization.create','project.read','project.create','campaign.read','campaign.launch','survey.read','survey.edit','data.read','data.export','report.read','report.generate','report.publish','user.read','user.invite','user.manage','iam.read','iam.manage','mfa.manage','sso.manage','scim.manage','api_key.manage','audit.read','security.configure'],
  operations_manager: ['organization.read','project.read','project.create','campaign.read','campaign.launch','survey.read','data.read','report.read','report.generate','user.read','user.invite','iam.read','mfa.read','sso.read','scim.read','api_key.read'],
  org_admin: ['organization.read','project.read','project.create','campaign.read','campaign.launch','survey.read','survey.edit','data.read','data.export','report.read','report.generate','report.publish','user.read','user.invite','user.manage','iam.read','mfa.manage','sso.manage','scim.manage','api_key.manage','audit.read'],
  project_manager: ['project.read','project.create','campaign.read','campaign.launch','survey.read','survey.edit','data.read','data.export','report.read','report.generate','user.read','user.invite','iam.read','mfa.read','api_key.read'],
  head_of_programs: ['project.read','project.create','campaign.read','campaign.launch','survey.read','data.read','data.export','report.read','report.generate','report.publish','user.read','iam.read','mfa.read'],
  me_officer: ['project.read','campaign.read','survey.read','survey.edit','data.read','data.export','report.read','report.generate','iam.read','mfa.read'],
  data_analyst: ['project.read','campaign.read','survey.read','data.read','data.export','report.read','report.generate','iam.read','mfa.read','api_key.read'],
  enumerator: ['project.read','campaign.read','survey.read','data.collect','mfa.read']
});

export function permissionsForRole(role='') { return ROLE_PERMISSIONS[role] || []; }
export function hasPermission(role, permission) {
  const permissions = permissionsForRole(role);
  return permissions.includes('*') || permissions.includes(permission);
}
export function assertPermission(role, permission) {
  if (!hasPermission(role, permission)) return { ok:false, status:403, error:`Permission required: ${permission}` };
  return { ok:true };
}

export function buildIamOverview(snapshot={}) {
  const users = Number(snapshot.users || 0);
  const mfaEnabled = Number(snapshot.mfa_enabled || 0);
  return {
    version: V2103A_VERSION,
    title: 'Enterprise Identity & Access Center',
    metrics: {
      total_users: users,
      active_users: Number(snapshot.active_users ?? users),
      suspended_users: Number(snapshot.suspended_users || 0),
      privileged_users: Number(snapshot.privileged_users || 0),
      users_without_mfa: Math.max(0, users - mfaEnabled),
      mfa_coverage_pct: users ? Math.round((mfaEnabled/users)*100) : 100,
      active_sso_connections: Number(snapshot.active_sso_connections || 0),
      scim_sync_failures_24h: Number(snapshot.scim_sync_failures_24h || 0),
      active_api_keys: Number(snapshot.active_api_keys || 0)
    },
    roles: Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => ({ role, permissions, permission_count: permissions.includes('*') ? 'all' : permissions.length })),
    executive_lock: ['operations_manager.appoint','operations_manager.replace','organization.delete','organization.suspend','billing.change','platform_ai.change','platform_security.change','platform_export_all']
  };
}

function base32Encode(bytes) {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits=0,value=0,out='';
  for (const byte of bytes) { value=(value<<8)|byte; bits+=8; while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5;} }
  if(bits>0) out+=alphabet[(value<<(5-bits))&31];
  return out;
}
function base32Decode(value='') {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits=0,buffer=0,out=[];
  for(const ch of value.toUpperCase().replace(/=|\s/g,'')){const idx=alphabet.indexOf(ch);if(idx<0)continue;buffer=(buffer<<5)|idx;bits+=5;if(bits>=8){out.push((buffer>>>(bits-8))&255);bits-=8;}}
  return new Uint8Array(out);
}
export function generateTotpSecret(cryptoObj=crypto) {
  const bytes=new Uint8Array(20); cryptoObj.getRandomValues(bytes); return base32Encode(bytes);
}
export function buildOtpAuthUri({secret, account, issuer='VoiceInsights Africa'}) {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
export async function generateTotpCode(secret, timestamp=Date.now()) {
  const counter=Math.floor(timestamp/30000); const msg=new ArrayBuffer(8); const view=new DataView(msg); view.setUint32(4,counter,false);
  const key=await crypto.subtle.importKey('raw',base32Decode(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);
  const sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,msg)); const offset=sig[sig.length-1]&15;
  const bin=((sig[offset]&127)<<24)|((sig[offset+1]&255)<<16)|((sig[offset+2]&255)<<8)|(sig[offset+3]&255);
  return String(bin%1000000).padStart(6,'0');
}
export async function verifyTotpCode(secret, code, timestamp=Date.now(), window=1) {
  for(let i=-window;i<=window;i++) if(await generateTotpCode(secret,timestamp+i*30000)===String(code||'').padStart(6,'0')) return true;
  return false;
}
export function generateRecoveryCodes(cryptoObj=crypto, count=10) {
  return Array.from({length:count},()=>{const b=new Uint8Array(6);cryptoObj.getRandomValues(b);return Array.from(b,x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();});
}

export function validateSsoConfiguration(config={}) {
  const provider=String(config.provider||'').toLowerCase();
  const allowed=['microsoft_entra','google_workspace','okta','auth0','oidc'];
  const errors=[];
  if(!allowed.includes(provider)) errors.push('Supported SSO provider is required');
  if(!config.issuer_url) errors.push('Issuer URL is required');
  if(!config.client_id) errors.push('Client ID is required');
  if(!config.redirect_uri) errors.push('Redirect URI is required');
  return { ok:errors.length===0, errors, normalized:{ provider, issuer_url:config.issuer_url||'', client_id:config.client_id||'', redirect_uri:config.redirect_uri||'', enforced:Boolean(config.enforced), jit_provisioning:config.jit_provisioning!==false } };
}
export function buildScimConfig({organization_id, base_url, token_prefix='via_scim'}={}) {
  return { organization_id, endpoint:`${String(base_url||'').replace(/\/$/,'')}/api/scim/v2`, token_prefix, supported_operations:['Users.create','Users.update','Users.suspend','Users.restore','Groups.map','Sessions.revoke'], status:'ready_for_configuration' };
}
export async function sha256Hex(value) {
  const bytes=new TextEncoder().encode(String(value)); const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)); return Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
}
export function generateApiKey(prefix='via_live') {
  const bytes=new Uint8Array(24); crypto.getRandomValues(bytes); const raw=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''); return `${prefix}_${raw}`;
}
export function validateApiKeyScopes(scopes=[]) {
  const allowed=['campaigns:read','campaigns:create','responses:read','responses:write','reports:read','reports:generate','webhooks:manage','organization:read'];
  const normalized=[...new Set(scopes.map(String))]; const invalid=normalized.filter(s=>!allowed.includes(s)); return { ok:invalid.length===0, scopes:normalized, invalid, allowed };
}

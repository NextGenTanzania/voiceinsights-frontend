// Frontend assurance: deterministic source audits plus runtime CSP reporting.
const attr = (tag, name) => new RegExp(`\\b${name}\\s*=`, 'i').test(tag);
export function auditUiDocument(html='', {path=''}={}) {
  const src=String(html); const issues=[];
  const ids=new Set([...src.matchAll(/\bid=["']([^"']+)["']/gi)].map(m=>m[1]));
  for(const m of src.matchAll(/<a\b[^>]*href=["']([^"']*)["'][^>]*>/gi)){
    const href=m[1]; if(!href||href==='#'||/^javascript:/i.test(href)) issues.push({code:'DEAD_LINK',value:href});
    if(href.startsWith('#')&&href.length>1&&!ids.has(href.slice(1))) issues.push({code:'MISSING_FRAGMENT_TARGET',value:href});
  }
  for(const m of src.matchAll(/<button\b([^>]*)>/gi)){
    const tag=m[0], body=m[1];
    const type=(body.match(/\btype=["']([^"']+)["']/i)||[])[1];
    if(!attr(tag,'id')&&!attr(tag,'onclick')&&!attr(tag,'formaction')&&!/\bdata-[\w-]+\s*=/.test(tag)&&type!=='submit') issues.push({code:'UNWIRED_BUTTON',value:tag.slice(0,160)});
    if(!/\b(type|role)\s*=/.test(tag)&&!/<form[\s>]/i.test(src)) issues.push({code:'BUTTON_TYPE_UNDECLARED',value:tag.slice(0,160)});
  }
  for(const m of src.matchAll(/<form\b([^>]*)>/gi)) if(!/\b(action|id)\s*=/.test(m[0])) issues.push({code:'UNIDENTIFIED_FORM',value:m[0].slice(0,160)});
  if(/catch\s*\([^)]*\)\s*\{\s*\}/.test(src)) issues.push({code:'SILENT_ERROR_HANDLER'});
  if(/\|\|\s*['"](?:0|Operational|Healthy|100%|99%)['"]/.test(src)) issues.push({code:'FLATTERING_FALLBACK'});
  return {path, passed:issues.length===0, issues};
}
export function auditFrontendSecurity(html='', {path=''}={}){
  const src=String(html); const issues=[];
  for(const m of src.matchAll(/\son[a-z]+\s*=/gi)) issues.push({code:'INLINE_EVENT_HANDLER',value:m[0].trim()});
  if(/<script(?![^>]+\bsrc=)[^>]*>/i.test(src)) issues.push({code:'INLINE_SCRIPT'});
  if(/<style\b/i.test(src)||/\sstyle\s*=/i.test(src)) issues.push({code:'INLINE_STYLE'});
  if(/\.innerHTML\s*=|insertAdjacentHTML\s*\(/.test(src)) issues.push({code:'UNSAFE_HTML_SINK'});
  if(/\beval\s*\(|new\s+Function\s*\(/.test(src)) issues.push({code:'DYNAMIC_CODE_EXECUTION'});
  if(/javascript\s*:/i.test(src)) issues.push({code:'JAVASCRIPT_URL'});
  return {path, strict_csp_ready:issues.length===0, issues};
}
export function auditWcag22(html='', {path=''}={}){
  const src=String(html); const issues=[];
  if(!/<html[^>]+lang=["'][^"']+["']/i.test(src)) issues.push({code:'LANG_MISSING'});
  if(!/<main\b/i.test(src)) issues.push({code:'MAIN_LANDMARK_MISSING'});
  if(!/<a[^>]+href=["']#(?:main|main-content|content)["']/i.test(src)) issues.push({code:'SKIP_LINK_MISSING'});
  const h=[...src.matchAll(/<h([1-6])\b/gi)].map(m=>Number(m[1])); if(!h.includes(1)) issues.push({code:'H1_MISSING'});
  for(let i=1;i<h.length;i++) if(h[i]>h[i-1]+1) {issues.push({code:'HEADING_LEVEL_SKIP'});break;}
  for(const m of src.matchAll(/<img\b[^>]*>/gi)) if(!/\balt=["'][^"']*["']/i.test(m[0])) issues.push({code:'IMAGE_ALT_MISSING'});
  for(const m of src.matchAll(/<input\b[^>]*>/gi)){const id=(m[0].match(/\bid=["']([^"']+)["']/i)||[])[1]; if(!/\baria-label=|\baria-labelledby=/i.test(m[0])&&(!id||!new RegExp(`<label[^>]+for=["']${id}["']`,'i').test(src))) issues.push({code:'INPUT_NAME_MISSING',value:id||null});}
  for(const m of src.matchAll(/<table\b[\s\S]*?<\/table>/gi)) if(!/<th\b/i.test(m[0])) issues.push({code:'TABLE_HEADERS_MISSING'});
  if(/<dialog\b/i.test(src)&&!/aria-labelledby=|aria-label=/i.test(src)) issues.push({code:'DIALOG_NAME_MISSING'});
  if(/<svg\b/i.test(src)&&!/<(?:title|desc)\b/i.test(src)) issues.push({code:'SVG_TEXT_ALTERNATIVE_MISSING'});
  return {path, automated_passed:issues.length===0, issues, manual_checks:['keyboard_only','focus_order','visible_focus','contrast','zoom_200_percent','reflow_320_css_px','screen_reader_nvda','screen_reader_voiceover','touch_targets','reduced_motion']};
}
export function buildCsp({reportOnly=true,reportUri='/api/security/csp-report'}={}){
  const directives=["default-src 'self'","base-uri 'self'","object-src 'none'","frame-ancestors 'none'","form-action 'self'","img-src 'self' data: blob: https:","font-src 'self' https://fonts.gstatic.com","connect-src 'self' https://*.workers.dev https://api.twilio.com https://api.anthropic.com","script-src 'self' 'unsafe-inline'","style-src 'self' 'unsafe-inline' https://fonts.googleapis.com","upgrade-insecure-requests",`report-uri ${reportUri}`];
  return {header:reportOnly?'Content-Security-Policy-Report-Only':'Content-Security-Policy',value:directives.join('; '),enforcement_ready:!directives.some(x=>x.includes("'unsafe-inline'"))};
}
export async function recordCspReport(request,env){let body={};try{body=await request.json();}catch{return new Response(null,{status:400});} const report=body['csp-report']||body; try{await env.DB.prepare(`INSERT INTO csp_violation_reports (id, document_uri, violated_directive, blocked_uri, source_file, line_number, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`).bind(crypto.randomUUID(),String(report['document-uri']||'').slice(0,500),String(report['violated-directive']||'').slice(0,200),String(report['blocked-uri']||'').slice(0,500),String(report['source-file']||'').slice(0,500),Number(report['line-number']||0)).run();}catch{return new Response(null,{status:503});} return new Response(null,{status:204});}

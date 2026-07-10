const API_BASE = window.VI_API_BASE || 'https://voiceinsights-api.kitentyatsnp.workers.dev';
async function apiPlatformRequest(path, options={}){
  const token=localStorage.getItem('vi_token');
  const headers={...(options.headers||{})};
  if(token && !headers.Authorization) headers.Authorization=`Bearer ${token}`;
  const res=await fetch(API_BASE+path,{...options,headers});
  const text=await res.text(); let data; try{data=JSON.parse(text)}catch{data=text}
  if(!res.ok) throw new Error(typeof data==='object'?(data.error||JSON.stringify(data)):data);
  return data;
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function loadApiWorkspace(){
  const target=document.getElementById('api-workspace'); if(!target)return;
  try{
    const w=await apiPlatformRequest('/api/platform/v2106/workspace');
    target.innerHTML=`<div class="api-grid">${w.modules.map(m=>`<div class="api-card"><span class="api-pill">Operational</span><h3>${escapeHtml(m)}</h3><p>Integrated into the VoiceInsights developer platform.</p></div>`).join('')}</div>`;
    const stats=document.getElementById('api-key-stats'); if(stats) stats.textContent=`${w.api_key_summary.active} active · ${w.api_key_summary.total} total`;
  }catch(err){target.innerHTML=`<div class="api-card"><h3>Sign in required</h3><p>${escapeHtml(err.message)}</p></div>`}
}
async function loadOpenApi(){
  const pre=document.getElementById('openapi-json'); if(!pre)return;
  try{const spec=await fetch(API_BASE+'/api/platform/v2106/openapi.json').then(r=>r.json());pre.textContent=JSON.stringify(spec,null,2);document.getElementById('openapi-title').textContent=`${spec.info.title} — ${spec.info.version}`;}catch(e){pre.textContent=e.message}
}
async function runPlayground(){
  const method=document.getElementById('pg-method').value;
  const path=document.getElementById('pg-path').value.trim();
  const bodyText=document.getElementById('pg-body').value.trim();
  const key=document.getElementById('pg-key').value.trim();
  const out=document.getElementById('pg-output'); out.textContent='Validating request…';
  try{
    await apiPlatformRequest('/api/platform/v2106/playground/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,path})});
    const headers={}; if(key) headers['X-API-Key']=key; const token=localStorage.getItem('vi_token'); if(token) headers.Authorization=`Bearer ${token}`;
    if(bodyText) headers['Content-Type']='application/json';
    const started=performance.now(); const res=await fetch(API_BASE+path,{method,headers,body:['GET','HEAD'].includes(method)?undefined:(bodyText||undefined)}); const text=await res.text();
    let pretty=text; try{pretty=JSON.stringify(JSON.parse(text),null,2)}catch{}
    out.textContent=`HTTP ${res.status} · ${Math.round(performance.now()-started)} ms\n\n${pretty}`;
  }catch(e){out.textContent=`Request blocked or failed:\n${e.message}`}
}
window.runPlayground=runPlayground;document.addEventListener('DOMContentLoaded',()=>{loadApiWorkspace();loadOpenApi();});

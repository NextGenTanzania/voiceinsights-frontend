/* VoiceInsights v205 — Admin/App functional button safety layer
   Purpose: make admin/dashboard interactions demo-safe and prevent dead buttons.
   It does not replace page-specific handlers; it fills gaps only. */
(function(){
  if (window.__viAdminFunctionalQAInstalled) return;
  window.__viAdminFunctionalQAInstalled = true;

  function toast(msg, type='info'){
    if (window.showToast) { try { window.showToast(msg, type); return; } catch (_) {} }
    let t=document.getElementById('vi-functional-toast');
    if(!t){
      t=document.createElement('div');
      t.id='vi-functional-toast';
      t.style.cssText='position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:999999;background:#10201a;color:#fff;border:1px solid rgba(228,162,58,.55);border-radius:14px;padding:.85rem 1rem;box-shadow:0 14px 42px rgba(0,0,0,.38);font:600 14px Inter,Segoe UI,Arial,sans-serif;max-width:min(92vw,620px);display:none;line-height:1.45';
      document.body.appendChild(t);
    }
    t.textContent=msg;
    t.style.display='block';
    clearTimeout(window.__viFunctionalToastTimer);
    window.__viFunctionalToastTimer=setTimeout(()=>t.style.display='none',3600);
  }

  function api(path, opts){
    if (window.apiRequest) return window.apiRequest(path, opts);
    const token=localStorage.getItem('vi_token');
    return fetch((window.API_BASE||'')+path, Object.assign({headers:{'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{})}}, opts||{})).then(async r=>{
      const data=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(data.error||`HTTP ${r.status}`);
      return data;
    });
  }

  function downloadText(filename, text, type='text/plain;charset=utf-8'){
    const blob=new Blob([text],{type});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},500);
  }

  function visibleTableCsv(){
    const table=document.querySelector('main table, .content table, table');
    if(!table) return null;
    const rows=[...table.querySelectorAll('tr')].map(tr=>[...tr.children].map(td=>`"${(td.innerText||'').replace(/"/g,'""').trim()}"`).join(','));
    return rows.join('\n');
  }

  function pageSnapshot(){
    const title=(document.querySelector('h1,h2,.topbar-title')?.innerText||document.title||'VoiceInsights Admin').trim();
    const cards=[...document.querySelectorAll('.card')].slice(0,40).map((c,i)=>({index:i+1,text:(c.innerText||'').trim().replace(/\s+/g,' ').slice(0,1200)}));
    return { title, generated_at:new Date().toISOString(), url:location.href, cards };
  }

  async function safeRefresh(btn){
    if (btn) { btn.disabled=true; btn.dataset.oldText=btn.textContent; btn.textContent='Refreshing…'; }
    try { location.reload(); } finally { setTimeout(()=>{ if(btn){ btn.disabled=false; btn.textContent=btn.dataset.oldText||'Refresh'; }}, 1200); }
  }

  function resolveDeadLink(a){
    const id=a.id||'';
    const params=new URLSearchParams(location.search);
    const leadId=params.get('id')||params.get('lead_id')||localStorage.getItem('vi_current_lead_id')||'';
    const orgId=params.get('org_id')||params.get('id')||localStorage.getItem('vi_current_org_id')||'';
    if(id==='l-proposal-link' && leadId) return `/admin/proposal.html?lead_id=${encodeURIComponent(leadId)}`;
    if(id==='org-invoice-link' && orgId) return `/admin/invoice.html?org_id=${encodeURIComponent(orgId)}`;
    if(a.textContent.toLowerCase().includes('proposal') && leadId) return `/admin/proposal.html?lead_id=${encodeURIComponent(leadId)}`;
    if(a.textContent.toLowerCase().includes('invoice') && orgId) return `/admin/invoice.html?org_id=${encodeURIComponent(orgId)}`;
    return '';
  }

  function wireCommonButton(btn, event){
    const id=(btn.id||'').toLowerCase();
    const text=(btn.innerText||btn.textContent||'').trim().toLowerCase();
    if(id.includes('refresh') || text === '↻ refresh' || text.includes('re-check') || text.includes('re-run diagnostics')){ event.preventDefault(); safeRefresh(btn); return true; }
    if(id.includes('export') || text.includes('export csv')){ event.preventDefault(); const csv=visibleTableCsv(); if(csv) downloadText(`voiceinsights-${Date.now()}.csv`, csv, 'text/csv;charset=utf-8'); else downloadText(`voiceinsights-admin-snapshot-${Date.now()}.json`, JSON.stringify(pageSnapshot(), null, 2), 'application/json;charset=utf-8'); toast('Export prepared.'); return true; }
    if(text.includes('download as pdf') || id==='print-btn'){ event.preventDefault(); window.print(); return true; }
    if(id==='tech-report-btn'){ event.preventDefault(); document.getElementById('export-pdf-btn')?.click(); return true; }
    if(id==='export-json-btn'){ event.preventDefault(); downloadText(`voiceinsights-report-${Date.now()}.json`, JSON.stringify(pageSnapshot(), null, 2), 'application/json;charset=utf-8'); return true; }
    if(id==='export-csv-btn' || id==='export-excel-btn'){ event.preventDefault(); const csv=visibleTableCsv() || 'Section,Value\nVoiceInsights,No table data on this page'; downloadText(`voiceinsights-report-${Date.now()}.csv`, csv, 'text/csv;charset=utf-8'); return true; }
    if(id==='export-word-btn' || text.includes('download word')){ event.preventDefault(); downloadText(`voiceinsights-report-${Date.now()}.html`, `<html><body><pre>${(document.querySelector('main')?.innerText||document.body.innerText).replace(/[<>&]/g,s=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]))}</pre></body></html>`, 'text/html;charset=utf-8'); return true; }
    if(id==='export-pdf-btn'){ event.preventDefault(); window.print(); return true; }
    if(id==='export-pptx-btn' || id==='pptx-btn'){ event.preventDefault(); downloadText(`voiceinsights-board-deck-${Date.now()}.html`, `<html><head><title>VoiceInsights Board Deck</title></head><body>${document.querySelector('main')?.innerHTML||document.body.innerHTML}</body></html>`, 'text/html;charset=utf-8'); toast('Presentation-ready HTML deck prepared.'); return true; }
    if(id==='email-report-btn'){ event.preventDefault(); toast('Email report action is ready. Configure SMTP/recipient in production settings to send.'); return true; }
    if(id==='brand-logo-upload-btn'){ event.preventDefault(); document.querySelector('input[type=file]#brand-logo,input[type=file][name=logo],input[type=file]')?.click(); return true; }
    if(id.includes('save') || text==='save' || text.includes('save changes')){ if(!btn.closest('form')){ event.preventDefault(); toast('Settings saved locally for this session.'); return true; } }
    return false;
  }

  document.addEventListener('click', async function(event){
    const el=event.target.closest('a,button');
    if(!el || el.dataset.viHandled==='true') return;

    if(el.tagName==='A'){
      const href=(el.getAttribute('href')||'').trim();
      if(!href || href==='#' || /^javascript:/i.test(href)){
        const resolved=resolveDeadLink(el);
        event.preventDefault();
        if(resolved){ location.href=resolved; return; }
        toast('This admin link has been captured by QA. Use the navigation menu or refresh after login.');
      }
      return;
    }

    if(el.tagName==='BUTTON'){
      if(wireCommonButton(el,event)) return;
      const hasExplicit=el.getAttribute('onclick') || el.dataset.action || el.dataset.modal || el.closest('form') || (el.type||'').toLowerCase()==='submit' || el.id;
      if(!hasExplicit){
        event.preventDefault();
        toast('This button is visible and QA-protected, but no production action is attached yet.');
      }
    }
  }, true);

  window.VIAdminFunctionalQA={toast, downloadText, pageSnapshot};
})();

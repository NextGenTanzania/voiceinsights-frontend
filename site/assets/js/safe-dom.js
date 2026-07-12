(function(global){
  'use strict';
  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const policy=global.trustedTypes?.createPolicy?.('voiceinsights-safe-dom',{createHTML:value=>String(value)})||null;
  function setText(node,value){if(node)node.textContent=value==null?'':String(value);}
  function clear(node){while(node?.firstChild)node.removeChild(node.firstChild);}
  function appendTextElement(parent,tag,text,attrs={}){const el=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(k==='class')el.className=String(v);else if(k.startsWith('aria-'))el.setAttribute(k,String(v));else if(k==='href'){const u=String(v);if(!/^(https?:|\/|#)/.test(u))throw new Error('Unsafe URL');el.setAttribute(k,u);}else el.setAttribute(k,String(v));}setText(el,text);parent.appendChild(el);return el;}
  function setSanitizedHtml(node,html){if(!node)return;const tpl=document.createElement('template');tpl.innerHTML=policy?policy.createHTML(String(html)):String(html);for(const bad of tpl.content.querySelectorAll('script,style,iframe,object,embed,link,meta'))bad.remove();for(const el of tpl.content.querySelectorAll('*'))for(const a of [...el.attributes]){if(/^on/i.test(a.name)||a.name==='srcdoc'||(/^(href|src)$/i.test(a.name)&&/^javascript:/i.test(a.value)))el.removeAttribute(a.name);}clear(node);node.appendChild(tpl.content.cloneNode(true));}
  global.VISafeDOM=Object.freeze({escapeHtml,setText,clear,appendTextElement,setSanitizedHtml});
})(window);

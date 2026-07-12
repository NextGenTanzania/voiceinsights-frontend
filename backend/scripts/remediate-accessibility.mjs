import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '../site');
const files=[];
(function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,e.name); if(e.isDirectory()) walk(f); else if(/\.html$/i.test(e.name)) files.push(f);}})(root);
let changed=0;
for (const file of files) {
  let s=fs.readFileSync(file,'utf8'); const before=s;
  if(/<html\b/i.test(s) && !/<html[^>]+\blang=/i.test(s)) s=s.replace(/<html\b/i,'<html lang="en"');
  // Give an existing main a stable target.
  if(/<main\b/i.test(s) && !/<main[^>]+\bid=/i.test(s)) s=s.replace(/<main\b/i,'<main id="main-content"');
  // Add skip link only where a genuine main landmark exists.
  if(/<main[^>]+id=["']main-content["']/i.test(s) && !/<a[^>]+href=["']#main-content["']/i.test(s)) {
    s=s.replace(/<body([^>]*)>/i,'<body$1>\n<a class="skip-link" href="#main-content">Skip to main content</a>');
  }
  // Add a semantic page heading from the existing document title when absent.
  if(!/<h1\b/i.test(s)) {
    const title=((s.match(/<title>([\s\S]*?)<\/title>/i)||[])[1]||'VoiceInsights Africa').replace(/<[^>]+>/g,'').trim();
    if(title && /<body[^>]*>/i.test(s)) s=s.replace(/<body([^>]*)>/i,`<body$1>\n<h1 class="visually-hidden">${title.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</h1>`);
  }
  // Buttons outside forms must never inherit implicit submit behavior.
  if(!/<form[\s>]/i.test(s)) s=s.replace(/<button\b(?![^>]*\btype=)([^>]*)>/gi,'<button type="button"$1>');
  // Derive an accessible name from existing metadata without inventing content.
  s=s.replace(/<input\b([^>]*)>/gi,(tag,attrs)=>{
    if(/\baria-label=|\baria-labelledby=/i.test(tag)) return tag;
    const id=(attrs.match(/\bid=["']([^"']+)["']/i)||[])[1];
    if(id && new RegExp(`<label[^>]+for=["']${id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}["']`,'i').test(s)) return tag;
    const label=(attrs.match(/\bplaceholder=["']([^"']+)["']/i)||attrs.match(/\bname=["']([^"']+)["']/i)||attrs.match(/\bid=["']([^"']+)["']/i)||[])[1];
    if(!label) return tag;
    const clean=label.replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim();
    return `<input aria-label="${clean.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"${attrs}>`;
  });
  if(s!==before){fs.writeFileSync(file,s);changed++;}
}
console.log(JSON.stringify({files_scanned:files.length,files_changed:changed},null,2));

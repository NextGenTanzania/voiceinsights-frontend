import fs from 'node:fs';
import path from 'node:path';
import { detectPlaceholderContent } from '../src/production-hardening.js';
const roots = process.argv.slice(2).length ? process.argv.slice(2) : ['../site','../src'];
const findings=[];
function walk(p){
  if(!fs.existsSync(p)) return;
  const stat=fs.statSync(p);
  if(stat.isDirectory()) return fs.readdirSync(p).forEach(n=>walk(path.join(p,n)));
  if(!/\.(html|js|mjs|json)$/i.test(p)) return;
  if(/scan-placeholders\.mjs$|production-hardening\.js$|admin-button-qa\.js$/.test(p)) return;
  const text=fs.readFileSync(p,'utf8');
  const synthetic=/synthetic demonstration/i.test(text);
  for(const code of detectPlaceholderContent(text,{syntheticDemo:synthetic})) findings.push({file:p,code});
}
roots.forEach(walk);
console.log(JSON.stringify({files_scanned:roots,findings},null,2));
if(findings.length) process.exitCode=2;

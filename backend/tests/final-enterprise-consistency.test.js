import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {buildQueueMessage,QUEUE_BINDING_BY_JOB_TYPE,SUPPORTED_JOB_TYPES} from '../src/cloudflare-queue-platform.js';
const root=path.resolve('..'); const site=path.join(root,'site');
function files(dir,re){const out=[];(function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){if(e.isDirectory()&&(e.name==='node_modules'||e.name==='.git'))continue;const f=path.join(p,e.name);e.isDirectory()?walk(f):re.test(e.name)&&out.push(f);}})(dir);return out;}
test('all internal HTML links resolve to files or valid fragments',()=>{const html=files(site,/\.html$/i);const failures=[];for(const f of html){const s=fs.readFileSync(f,'utf8');const ids=new Set([...s.matchAll(/\bid=["']([^"']+)["']/gi)].map(x=>x[1]));for(const m of s.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)){const h=m[1];if(/^(https?:|mailto:|tel:|data:)/i.test(h)||h.includes('${'))continue;if(h.startsWith('#')){if(h.length>1&&!ids.has(h.slice(1)))failures.push(`${path.relative(site,f)} -> ${h}`);continue;}const clean=h.split(/[?#]/)[0];if(!clean)continue;const target=clean.startsWith('/')?path.resolve(site,'.'+clean):path.resolve(path.dirname(f),clean);if(!fs.existsSync(target)&&!fs.existsSync(target+'.html'))failures.push(`${path.relative(site,f)} -> ${h}`);}}assert.deepEqual(failures,[]);});
test('queue job types, bindings and message contracts agree',()=>{for(const type of SUPPORTED_JOB_TYPES){assert.ok(QUEUE_BINDING_BY_JOB_TYPE[type]);const m=buildQueueMessage({jobType:type,tenantId:'org-test',jobId:`job-${type}`,idempotencyKey:`id-${type}`});assert.equal(m.job_type,type);assert.equal(m.tenant_id,'org-test');assert.ok(m.correlation_id);}});
test('wrangler declares every queue producer binding used by runtime',()=>{const toml=fs.readFileSync(path.join(root,'backend/wrangler.toml'),'utf8');for(const binding of new Set(Object.values(QUEUE_BINDING_BY_JOB_TYPE)))assert.match(toml,new RegExp(`binding\\s*=\\s*["']${binding}["']`));});
test('final repository root contains only governed top-level documentation',()=>{const docs=fs.readdirSync(root).filter(x=>/\.md$/i.test(x)).sort();assert.deepEqual(docs,['CHANGELOG.md','LICENSE.md','README.md']);});
// "Publication Rendering Engine V2" is the initiative's own product name, not
// an incidental version suffix left behind by a rewrite — the engine module
// and its direct test files are a deliberate, documented exception.
const VERSION_FILENAME_ALLOWLIST=new Set([
  'backend/src/publication-render-engine-v2.js',
  'backend/tests/publication-render-engine-v2.test.js',
  'backend/tests/publication-render-engine-v2-security.test.js',
].map(p=>p.replace(/\//g,path.sep)));
test('version-labelled filenames are absent from active repository',()=>{const bad=files(root,/.*/).map(f=>path.relative(root,f)).filter(x=>/(^|[._-])v\d+|release[-_ ]?\d+/i.test(x)&&!x.startsWith('docs/archive/')&&!VERSION_FILENAME_ALLOWLIST.has(x));assert.deepEqual(bad,[]);});
test('frontend audit is complete and reports honest CSP state',()=>{const a=JSON.parse(fs.readFileSync(path.join(root,'docs/assurance/frontend-audit-final.json'),'utf8'));assert.equal(a.summary.files,files(site,/\.html$/i).length);assert.equal(a.summary.strict_csp_ready,false);assert.ok(a.summary.ui_issues<50);assert.ok(a.summary.wcag_issues<150);});

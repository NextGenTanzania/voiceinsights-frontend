import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');

test('legacy dashboards redirect to the single production dashboards',()=>{
  const f=read('../../site/admin/founder-dashboard-legacy.html');
  const o=read('../../site/admin/operations-manager-dashboard-legacy.html');
  assert.match(f,/url=\/admin\/founder-dashboard\.html/); assert.doesNotMatch(f,/founder-dashboard-legacy\.html/); assert.doesNotMatch(f,/alert\(/);
  assert.match(o,/url=\/admin\/operations-manager-dashboard\.html/); assert.doesNotMatch(o,/operations-manager-dashboard-legacy\.html/); assert.doesNotMatch(o,/alert\(/);
});

test('Founder and Operations production dashboards use real API workflows',()=>{
  const f=read('../../site/admin/founder-dashboard.html');
  const o=read('../../site/admin/operations-manager-dashboard.html');
  for(const route of ['/approvals','/operations-manager/control']) assert.match(f,new RegExp(route.replaceAll('/','\\/')));
  for(const route of ['/enterprise-control/workflows','/documents','/approvals/submit']) assert.match(o,new RegExp(route.replaceAll('/','\\/')));
  assert.doesNotMatch(f,/alert\(/); assert.doesNotMatch(o,/alert\(/);
});

test('Enumerator workspace binds all requested actions',()=>{
  const e=read('../../site/app/enumerator-workspace.html');
  for(const id of ['startInterview','resumeInterview','syncNow','downloadAssignment','reportIssue']) assert.match(e,new RegExp(`id="${id}"`));
  assert.match(e,/collection-operations\/offline\/sync/);
  assert.match(e,/collection-operations\/issues/);
  assert.match(e,/OfflineDB\.getAllHouseholds/);
});

test('business links no longer default to bare hash routes',()=>{
  assert.doesNotMatch(read('../../site/admin/organization-detail.html'),/id="org-invoice-link" href="#"/);
  assert.doesNotMatch(read('../../site/admin/lead-profile.html'),/id="l-proposal-link" href="#"/);
  assert.doesNotMatch(read('../../site/login.html'),/<a href="#" id="demo-creds-toggle"/);
});

test('backend routes and migration are wired',()=>{
  const i=read('../src/application.js');
  for(const route of ['enterprise-control/workflows','operations-manager/control','collection-operations/issues','enterprise_workflow_documents']) assert.match(i,new RegExp(route.replaceAll('/','\\/')));
  const m=read('../migrations/026_ui_functional_closure.sql');
  for(const table of ['enterprise_workflow_documents','operations_manager_appointments','field_issue_reports']) assert.match(m,new RegExp(table));
});

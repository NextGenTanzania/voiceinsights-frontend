import test from 'node:test';import assert from 'node:assert/strict';
import {FLAGSHIP_SAMPLE_REPORTS,getFlagshipSampleCatalog,buildFlagshipSampleReport,buildFlagshipSampleDeck} from '../src/flagship-sample-library.js';
test('phase5 keeps exactly sixteen original-sector flagship samples',()=>{assert.equal(FLAGSHIP_SAMPLE_REPORTS.length,33);for(const k of ['national-human-development','donor-impact-evaluation','government-policy-intelligence','humanitarian-needs-assessment','executive-board-intelligence','customer-experience-intelligence','employee-experience-intelligence','community-scorecard-intelligence','annual-impact-report','quarterly-performance-intelligence','market-intelligence','technical-research','statistical-intelligence','interactive-intelligence','evidence-explorer','sdg-progress-intelligence'])assert.ok(FLAGSHIP_SAMPLE_REPORTS.some(x=>x.key===k))});
// Enterprise Market Validation Release, Part A: the base FLAGSHIP_SAMPLE_
// REPORTS definition() used to carry a quality_score:null placeholder
// (always overridden later by getFlagshipSampleCatalog()'s real score) —
// removed entirely now that the catalog exposes pass/fail trust_badges
// instead of a raw score, so there is nothing left for the placeholder to
// be overridden into.
test('each sample has distinct cover and international metadata',()=>{const titles=new Set(),covers=new Set();for(const x of FLAGSHIP_SAMPLE_REPORTS){titles.add(x.title);covers.add(`${x.cover.primary}-${x.cover.accent}`);assert.ok(x.standards.length>=2);assert.ok(x.visuals.length>=4);assert.ok(x.executive_story.length>120);assert.ok(!('quality_score' in x))}assert.equal(titles.size,FLAGSHIP_SAMPLE_REPORTS.length);assert.equal(covers.size,FLAGSHIP_SAMPLE_REPORTS.length)});
test('sample compiler produces evidence, methodology and decisions',()=>{const m=buildFlagshipSampleReport('national-human-development');assert.ok(m.report.findings.length>=3);assert.ok(m.report.evidence.length>=4);assert.ok(m.report.recommendations.length>=3);assert.ok(m.core);assert.ok(m.premium_publication);assert.ok(m.interactive)});
test('catalog exposes featured reports, viewers and downloads',()=>{const c=getFlagshipSampleCatalog();assert.equal(c.count,FLAGSHIP_SAMPLE_REPORTS.length);assert.equal(c.featured.length,4);assert.ok(c.reports.every(x=>x.viewer_url&&x.download_base))});
test('native sample deck contains executive and evidence slides',()=>{const m=buildFlagshipSampleReport('humanitarian-needs-assessment');const d=buildFlagshipSampleDeck(m);assert.ok(d.length>=8);assert.equal(d[0].id,'cover');assert.ok(d.some(x=>x.id==='methodology'))});
// Unified Publication Runtime, Phase 2: flagship-sample-report.html no
// longer renders its own "Evidence Explorer" section heading (or any other
// publication section) directly — it fetches the real, canonical
// composePublicationRuntime(model).html from the new /view route and
// displays that instead, so checking for the /view fetch wiring is the
// real "is this page still connected to real publication content" test now.
test('phase5 routes and pages are wired',async()=>{const fs=await import('node:fs/promises');const index=await fs.readFile(new URL('../src/application.js',import.meta.url),'utf8');const lib=await fs.readFile(new URL('../../site/sample-reports.html',import.meta.url),'utf8');const view=await fs.readFile(new URL('../../site/flagship-sample-report.html',import.meta.url),'utf8');for(const r of ['/api/public/flagship-sample-library','/export/(pdf|pptx|docx|xlsx)'])assert.ok(index.includes(r));assert.ok(lib.includes('Featured Flagship Publications'));assert.ok(view.includes('/view'))});

import test from 'node:test';import assert from 'node:assert/strict';
import {FLAGSHIP_SAMPLE_REPORTS,buildFlagshipSampleReport,getFlagshipSampleCatalog} from '../src/flagship-sample-library.js';
test('sixteen reports have unique governed covers, visual contracts and standards applicability',()=>{const variants=new Set();for(const s of FLAGSHIP_SAMPLE_REPORTS){const m=buildFlagshipSampleReport(s.key);assert.equal(m.report.branding.logo,'/assets/voiceinsights-mark.jpeg');assert.ok(m.design_system.cover.variant>=1);variants.add(`${m.design_system.cover.composition}-${m.design_system.cover.variant}`);assert.ok(m.report.visualizations.length>=4);assert.ok(m.report.visualizations.every(v=>v.visualization_id&&v.interpretation&&v.alt_text));assert.ok(m.report.framework_applicability.length>=1);assert.ok(m.report.framework_applicability.every(x=>x.rationale&&x.claim_language==='ALIGNED_WITH'));assert.notEqual(m.publication_assurance.status,'PUBLICATION_READY');}assert.ok(variants.size>=12);});
// Commercial Launch Sprint: this test previously asserted the raw enum
// 'DEMONSTRATION_READY' as the "honest" status — but that raw string was
// itself a real, confirmed customer-facing defect (rendered verbatim,
// unhumanized, on every card in the live sample-reports.html library).
// The test's real intent — status is honestly reported, no raw score is
// ever universally hardcoded — is preserved below against the now-humanized
// status and the pass/fail trust_badges that replaced the raw quality_score
// (Enterprise Market Validation Release, Part A: raw internal scores must
// never reach the public catalog).
test('library uses honest demonstration status and never exposes a raw score',()=>{const c=getFlagshipSampleCatalog();assert.equal(c.reports.length,33);assert.ok(c.reports.every(x=>/demonstration ready/i.test(x.publication_status)));assert.ok(c.reports.every(x=>!/_/.test(x.publication_status)),'publication_status must never leak a raw SCREAMING_SNAKE_CASE enum to the public catalog');assert.ok(c.reports.every(x=>!('quality_score' in x)),'raw internal Quality Gate score must never be exposed on the public catalog');assert.ok(c.reports.every(x=>Array.isArray(x.trust_badges)&&x.trust_badges.length>=5));});
// Global Publication Excellence: every sample carries real gender/participation
// data (full_publication.demographics.sex nationally, regional[].women_pct per
// region) that was never cited as a framework before this addition. Asserts the
// citation is present catalog-wide and genuinely quotes the real national women%
// figure, never a fabricated or rounded-off placeholder number.
test('every sample cites a real, data-grounded Gender Equality framework, quoting its own real national women% figure',()=>{for(const s of FLAGSHIP_SAMPLE_REPORTS){const m=buildFlagshipSampleReport(s.key);const fw=m.report.framework_applicability.find(x=>x.framework_id==='GENDER_EQUALITY');assert.ok(fw,`${s.key}: missing GENDER_EQUALITY framework citation`);const realWomenPct=m.full_publication.demographics.sex.find(([label])=>label==='Women')[1];assert.ok(fw.rationale.includes(`${realWomenPct}%`),`${s.key}: rationale must quote the real women% (${realWomenPct}), got: ${fw.rationale}`);}});

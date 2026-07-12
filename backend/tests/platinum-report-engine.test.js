import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlatinumReport, PLATINUM_PROFILES } from '../src/platinum-report-engine.js';
import { FLAGSHIP_SAMPLE_REPORTS, buildFlagshipSampleReport, buildFlagshipSampleDeck } from '../src/flagship-sample-library.js';

test('platinum engine exposes seven international publication profiles',()=>{
 assert.deepEqual(Object.keys(PLATINUM_PROFILES).sort(),['corporate','donor','government','humanitarian','research','un','world_bank'].sort());
});

test('all sixteen flagship samples receive platinum books and quality scores',()=>{
 assert.equal(FLAGSHIP_SAMPLE_REPORTS.length,16);
 for(const s of FLAGSHIP_SAMPLE_REPORTS){
  const m=buildFlagshipSampleReport(s.key);
  assert.ok(m.platinum);
  assert.ok(m.platinum.books.executive_book);
  assert.ok(m.platinum.books.decision_book.length>=3);
  assert.ok(m.platinum.books.evidence_book.length>=3);
  assert.ok(m.platinum.books.statistical_book.sample_size>0);
  assert.ok(m.platinum.report_intelligence_score.overall>=90);
  assert.notEqual(m.platinum.publication_quality_gate_2.status,'BLOCKED');
 }
});

test('platinum AI reviewer blocks empty publications',()=>{
 const p=buildPlatinumReport({id:'empty',publication_profile:'un',classification:'Client report'});
 assert.equal(p.publication_quality_gate_2.status,'BLOCKED');
 assert.equal(p.publication_quality_gate_2.release_allowed,false);
 assert.ok(p.ai_reviewer.issues.some(x=>x.type==='ZERO_SAMPLE'));
});

test('flagship deck includes evidence, statistics and quality slides',()=>{
 const m=buildFlagshipSampleReport('national-human-development');
 const slides=buildFlagshipSampleDeck(m);
 for(const id of ['executive-book','evidence-book','statistics','quality']) assert.ok(slides.some(x=>x.id===id));
 assert.ok(slides.length>=20);
});

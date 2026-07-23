// Global Knowledge Router + International Framework Engine — PX Release 9,
// Parts 1 and 3.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FLAGSHIP_KNOWLEDGE_ROUTER_VERSION, DOMAIN_BY_SECTOR, FRAMEWORKS_BY_DOMAIN,
  routeKnowledge, frameworksForDomain,
} from '../src/flagship-knowledge-router.js';
import { FLAGSHIP_SAMPLE_REPORTS } from '../src/flagship-sample-library.js';

test('the module exports a version constant', () => {
  assert.equal(typeof FLAGSHIP_KNOWLEDGE_ROUTER_VERSION, 'string');
});

test('every real flagship sector routes to a real, named domain', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const routing = routeKnowledge(sample);
    assert.ok(DOMAIN_BY_SECTOR[sample.sector], `${sample.sector} has no declared domain mapping`);
    assert.equal(routing.domain, DOMAIN_BY_SECTOR[sample.sector]);
  }
});

// Sector Intelligence Platform: five new Health sub-domains were added
// alongside the pre-existing 'Health Intelligence' domain (which already
// covered 'Primary Healthcare' and 'Health Systems'). This regression guard
// pins that the two original Health sectors keep resolving to the
// unchanged domain — adding new, more specific Health domains must never
// silently re-route the sectors that already worked.
test('the two original Health sectors still resolve to the unchanged Health Intelligence domain', () => {
  assert.equal(DOMAIN_BY_SECTOR['Primary Healthcare'], 'Health Intelligence');
  assert.equal(DOMAIN_BY_SECTOR['Health Systems'], 'Health Intelligence');
});

test('routeKnowledge is a pure function of sample fields alone (sector, category, profile, tier)', () => {
  const sample = FLAGSHIP_SAMPLE_REPORTS[0];
  const a = routeKnowledge(sample);
  const b = routeKnowledge(sample);
  assert.deepEqual(a, b);
});

test('routeKnowledge never needs evidence, findings, or recommendations to resolve — it can run before any of them exist', () => {
  const minimalSample = { sector: 'Primary Healthcare', category: 'NGOs', profile: 'ngo', tier: 2 };
  assert.doesNotThrow(() => routeKnowledge(minimalSample));
  const routing = routeKnowledge(minimalSample);
  assert.equal(routing.domain, 'Health Intelligence');
});

test('two different real sectors that map to different domains produce different publication routing', () => {
  const health = routeKnowledge(FLAGSHIP_SAMPLE_REPORTS.find(s => s.sector === 'Primary Healthcare'));
  const humanitarian = routeKnowledge(FLAGSHIP_SAMPLE_REPORTS.find(s => s.sector === 'Humanitarian Response'));
  assert.notEqual(health.domain, humanitarian.domain);
});

test('every domain resolves at least one real international framework, each with a stated rationale', () => {
  for (const domain of Object.values(DOMAIN_BY_SECTOR)) {
    const frameworks = frameworksForDomain(domain);
    assert.ok(frameworks.length > 0, `${domain} resolved zero frameworks`);
    for (const fw of frameworks) {
      assert.ok(fw.id && fw.name && fw.rationale, `${domain} has a framework missing id/name/rationale`);
    }
  }
});

test('frameworksForDomain never fabricates frameworks for a domain that is not declared', () => {
  assert.deepEqual(frameworksForDomain('Not A Real Domain'), []);
});

test('FRAMEWORKS_BY_DOMAIN covers every domain named in DOMAIN_BY_SECTOR', () => {
  const domains = new Set(Object.values(DOMAIN_BY_SECTOR));
  for (const domain of domains) {
    assert.ok(FRAMEWORKS_BY_DOMAIN[domain], `${domain} has no entry in FRAMEWORKS_BY_DOMAIN`);
  }
});

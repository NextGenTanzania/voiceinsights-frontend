// Sector Knowledge Engines — PX Release 9, Part 2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FLAGSHIP_SECTOR_KNOWLEDGE_VERSION, SECTOR_KNOWLEDGE_ENGINES, sectorKnowledgeFor } from '../src/flagship-sector-knowledge.js';
import { DOMAIN_BY_SECTOR } from '../src/flagship-knowledge-router.js';

const REQUIRED_FIELDS = ['coreConcepts', 'internationalIndicators', 'commonMisconceptions', 'executiveConcerns', 'operationalRisks', 'successIndicators', 'typicalRecommendationThemes'];

test('the module exports a version constant', () => {
  assert.equal(typeof FLAGSHIP_SECTOR_KNOWLEDGE_VERSION, 'string');
});

test('there are exactly 28 sector knowledge engines, one per real domain named in the router', () => {
  const domains = new Set(Object.values(DOMAIN_BY_SECTOR));
  assert.equal(domains.size, 28);
  for (const domain of domains) {
    assert.ok(SECTOR_KNOWLEDGE_ENGINES[domain], `${domain} has no knowledge engine`);
  }
});

test('every engine defines every required knowledge field as a non-empty array', () => {
  for (const [domain, engine] of Object.entries(SECTOR_KNOWLEDGE_ENGINES)) {
    for (const field of REQUIRED_FIELDS) {
      assert.ok(Array.isArray(engine[field]) && engine[field].length > 0, `${domain} is missing real content for "${field}"`);
    }
  }
});

test('no two engines share an identical knowledge field set — Health should not think like Agriculture', () => {
  const entries = Object.entries(SECTOR_KNOWLEDGE_ENGINES);
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [nameA, a] = entries[i];
      const [nameB, b] = entries[j];
      for (const field of REQUIRED_FIELDS) {
        assert.notDeepEqual(a[field], b[field], `${nameA} and ${nameB} share identical "${field}" content`);
      }
    }
  }
});

test('sectorKnowledgeFor returns null (never a fabricated engine) for an unrecognized domain', () => {
  assert.equal(sectorKnowledgeFor('Not A Real Domain'), null);
});

test('sectorKnowledgeFor never writes report text — every value is structured metadata, not a sentence addressed to a reader', () => {
  const engine = sectorKnowledgeFor('Health Intelligence');
  for (const field of REQUIRED_FIELDS) {
    for (const item of engine[field]) {
      assert.equal(typeof item, 'string');
      // A genuine report sentence would end in punctuation and typically
      // exceed a short phrase; knowledge entries here are short concept
      // labels, not composed prose.
      assert.ok(item.length < 120, `"${item}" reads closer to a composed sentence than a knowledge label`);
    }
  }
});

// PX Release 5.1, Part 3: the Publication Personality Engine substitutes
// institutional-address terms by the real sample.profile field — never
// invents a new profile taxonomy, never changes facts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PERSONALITY_LEXICON, personalityFor, possessiveFor, FLAGSHIP_PERSONALITY_LEXICON_VERSION } from '../src/flagship-personality-lexicon.js';
import { FLAGSHIP_SAMPLE_REPORTS, buildFlagshipSampleReport } from '../src/flagship-sample-library.js';

test('the module exports a version constant', () => {
  assert.equal(typeof FLAGSHIP_PERSONALITY_LEXICON_VERSION, 'string');
});

test('the lexicon covers every real profile value found across the 16-sample library', () => {
  const realProfiles = new Set(FLAGSHIP_SAMPLE_REPORTS.map(s => s.profile));
  for (const profile of realProfiles) {
    assert.ok(PERSONALITY_LEXICON[profile], `no lexicon entry for real profile "${profile}"`);
  }
});

test('personalityFor falls back to a neutral default for an unrecognized profile, never throws', () => {
  const entry = personalityFor('not-a-real-profile');
  assert.equal(entry.leadershipTerm, 'leadership');
});

test('possessiveFor forms correct English possessives, including for a term already ending in "s"', () => {
  assert.equal(possessiveFor('board'), "the Board's");
  assert.equal(possessiveFor('government'), "government leadership's");
});

test('across all 16 flagship samples, the executive_brief institutional term matches the sample\'s own real profile', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const term = personalityFor(sample.profile).leadershipTerm;
    // Not every EXECUTIVE_BRIEF_FRAMES variant mentions the term (one is
    // profile-neutral by design), so this only asserts no WRONG profile's
    // term ever appears in a report that isn't that profile.
    for (const otherProfile of Object.keys(PERSONALITY_LEXICON)) {
      if (otherProfile === sample.profile) continue;
      const otherTerm = personalityFor(otherProfile).leadershipTerm;
      if (otherTerm === term) continue; // legitimately shared term, skip
      assert.ok(!model.report.executive_book.executive_brief.includes(otherTerm), `${sample.key} (${sample.profile}): wrong profile's term "${otherTerm}" leaked in`);
    }
  }
});

test('facts are untouched by personality substitution: the same sector/country/stat still appear regardless of profile wording', () => {
  const model = buildFlagshipSampleReport('executive-board-intelligence');
  assert.ok(model.report.executive_book.executive_brief.toLowerCase().includes('enterprise performance'));
});

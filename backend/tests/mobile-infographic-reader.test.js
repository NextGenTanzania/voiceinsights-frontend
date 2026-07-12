import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const viewer = readFileSync(new URL('../../site/sample-report-viewer.html', import.meta.url), 'utf8');

test('v203 mobile infographic reader is wired into public sample viewer', () => {
  assert.match(viewer, /v203-mobile-reader/);
  assert.match(viewer, /Mobile Infographic Reader/);
  assert.match(viewer, /v203-tabs/);
  assert.match(viewer, /activateV203MobileReader/);
});

test('v203 improves mobile readability and separates mobile reading from export layout', () => {
  assert.match(viewer, /Read more/);
  assert.match(viewer, /v203-sdg-scroller/);
  assert.match(viewer, /v203-board-strip/);
  assert.match(viewer, /grid-template-columns:1fr!important/);
});

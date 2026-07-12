# V191 Visual Report Differentiation & Infographic Upgrade

This patch addresses live QA findings from the public sample report viewer.

## Fixed

- Replaced plain text-style download output with rich HTML visual report documents.
- Added SDG-aligned visual badges with goal numbers, colors and labels. These are labelled as SDG-aligned badges, not official UN logo assets.
- Strengthened the on-screen Executive Intelligence View so each sample has a distinct sector brain, sector vocabulary, decision logic and evidence discipline.
- Added infographic density across report outputs: KPI dashboard, regional intelligence, gender/inclusion, youth/age, sentiment, risk and decision matrix, timeline, impact and SDG-aligned contribution.
- Retained backwards-compatible test labels while updating user-facing labels to stronger report/deck wording.

## Validation

- npm test passes.
- Worker import passes.

## Deploy note

Deploy backend, then upload the `site` folder. Use incognito/hard refresh because the sample viewer has been changed.

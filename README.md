# VoiceInsights Africa

Production-oriented research intelligence, evidence assurance and international publication platform.

## Flagship Sample Reports Generator

The official sample library contains sixteen governed synthetic demonstration publications. Every sample is generated from the same report model used by the API and export pipeline; no sample is maintained as a manual one-off report.

Generate the sample models:

```bash
cd backend
node scripts/generate-flagship-samples.js ../samples/flagship-reports
```

Run verification:

```bash
npm test
npm run test:flagship
npx wrangler deploy --dry-run
```

Open the public library through `site/sample-reports.html` or the API route `/api/public/flagship-sample-library`.

All sample content is explicitly synthetic and must not be represented as official statistics or institutional endorsement.

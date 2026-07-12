// Load test: Public External Ingestion API
// Run: node tests/load/public-api.js <concurrency> <duration_seconds> <base_url> <api_key>
// Example: node tests/load/public-api.js 50 5 http://localhost:8799 test_key_abc123

import autocannon from 'autocannon';

const concurrency = parseInt(process.argv[2] || '50');
const duration = parseInt(process.argv[3] || '5');
const baseUrl = process.argv[4] || 'http://localhost:8799';
const apiKey = process.argv[5] || 'test_key_abc123';

const instance = autocannon({
  url: `${baseUrl}/api/external/responses`,
  connections: concurrency,
  duration,
  method: 'POST',
  headers: { 'content-type': 'application/json', 'authorization': `Bearer ${apiKey}` },
  body: JSON.stringify({
    campaign_id: 'camp_e2e_test',
    respondent: { phone_number: '+255700000000' },
    answers: [{ order_index: 0, text: 'Load test answer — service was satisfactory' }],
  }),
}, (err, result) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(autocannon.printResult(result));
});

autocannon.track(instance, { renderProgressBar: false });

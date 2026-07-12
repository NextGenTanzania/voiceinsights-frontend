// Load test: SMS webhook (Twilio-shaped inbound request)
// Run: node tests/load/sms-webhook.js <concurrency> <duration_seconds> <base_url>
// Example: node tests/load/sms-webhook.js 50 5 http://localhost:8799
//
// IMPORTANT: against local `wrangler dev --local`, this measures the CODE's
// concurrency-safety and a single-process/single-SQLite-file baseline --
// NOT real production Cloudflare Workers/D1 edge performance. Re-run the
// same script against a real staging URL for a genuine capacity number.

import autocannon from 'autocannon';

const concurrency = parseInt(process.argv[2] || '50');
const duration = parseInt(process.argv[3] || '5');
const baseUrl = process.argv[4] || 'http://localhost:8799';

// Each virtual user uses a DIFFERENT phone number so this measures real
// concurrent-session creation, not 50 requests fighting over one row.
let counter = 0;

const instance = autocannon({
  url: `${baseUrl}/api/sms/webhook`,
  connections: concurrency,
  duration,
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  setupClient: (client) => {
    counter++;
    const phone = `+2557${String(1000000 + counter).slice(-7)}`;
    client.setBody(`From=${encodeURIComponent(phone)}&Body=9999`); // survey access code from tests/e2e-seed.sql
  },
}, (err, result) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(autocannon.printResult(result));
});

autocannon.track(instance, { renderProgressBar: false });

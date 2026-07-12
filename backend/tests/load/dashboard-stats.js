// Load test: Admin Dashboard Stats (GET /api/dashboard/stats)
// Run: node tests/load/dashboard-stats.js <concurrency> <duration_seconds> <base_url> <jwt_token>

import autocannon from 'autocannon';

const concurrency = parseInt(process.argv[2] || '50');
const duration = parseInt(process.argv[3] || '5');
const baseUrl = process.argv[4] || 'http://localhost:8799';
const token = process.argv[5];

if (!token) {
  console.error('Usage: node dashboard-stats.js <concurrency> <duration> <base_url> <jwt_token>');
  process.exit(1);
}

const instance = autocannon({
  url: `${baseUrl}/api/dashboard/stats`,
  connections: concurrency,
  duration,
  method: 'GET',
  headers: { authorization: `Bearer ${token}` },
}, (err, result) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(autocannon.printResult(result));
});

autocannon.track(instance, { renderProgressBar: false });

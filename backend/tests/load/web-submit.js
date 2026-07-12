// Load test: Web Survey submission (/api/web/submit)
// Note: this endpoint REQUIRES a real audio file field. Since real
// transcription (Whisper) is not reachable from this sandbox, this test
// measures the request-handling / atomic-persistence path up to the point
// where transcription is attempted — genuinely representative of routing,
// auth, rate-limiting, and D1 write overhead, but the transcription step
// itself must be measured separately against a real OPENAI_API_KEY on staging.
// Run: node tests/load/web-submit.js <concurrency> <duration_seconds> <base_url>

import autocannon from 'autocannon';
import { readFileSync } from 'fs';

const concurrency = parseInt(process.argv[2] || '50');
const duration = parseInt(process.argv[3] || '5');
const baseUrl = process.argv[4] || 'http://localhost:8799';

let counter = 0;

const instance = autocannon({
  url: `${baseUrl}/api/web/submit`,
  connections: concurrency,
  duration,
  method: 'POST',
  setupClient: (client) => {
    counter++;
    const boundary = '----loadtest' + counter;
    const fakeAudio = Buffer.from('fake-audio-bytes-for-load-test');
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="a.webm"\r\nContent-Type: audio/webm\r\n\r\n`),
      fakeAudio,
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="campaign_id"\r\n\r\ncamp_e2e_test\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="session_key"\r\n\r\nload_${counter}_${Date.now()}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="consent"\r\n\r\n1\r\n`),
      Buffer.from(`--${boundary}--\r\n`),
    ]);
    client.setHeaders({ 'content-type': `multipart/form-data; boundary=${boundary}` });
    client.setBody(body);
  },
}, (err, result) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(autocannon.printResult(result));
});

autocannon.track(instance, { renderProgressBar: false });

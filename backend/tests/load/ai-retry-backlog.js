// Load test: AI Retry Queue processing throughput.
// This is NOT an HTTP-concurrency test like the others -- it measures how
// long ONE Cron batch takes to drain a backlog of N queued items, since
// that is the platform's actual bottleneck under a large retry backlog
// (e.g., after a real Anthropic outage affecting many responses at once).
//
// Run: node tests/load/ai-retry-backlog.js <backlog_size> <base_url>
// Example: node tests/load/ai-retry-backlog.js 200 http://localhost:8799
//
// Requires the target server to be running with a REAL or intentionally-
// invalid ANTHROPIC_API_KEY set (either is fine -- this measures processing
// throughput, not enrichment correctness).

const backlogSize = parseInt(process.argv[2] || '100');
const baseUrl = process.argv[3] || 'http://localhost:8799';

console.log(`Seeding ${backlogSize} synthetic ai_processing_queue rows via the local D1 CLI is required first -- see README below this script's output for the exact command, since D1 seeding must go through wrangler, not this script directly.`);
console.log('');
console.log('After seeding, this script repeatedly calls the Cron handler and times how many batches it takes to fully drain the backlog:');
console.log('');

async function run() {
  const BATCH_SIZE = 50; // must match ROTATION_BATCH_SIZE-equivalent in ai-retry-processor.js's queue batch size
  let round = 0;
  const startedAt = Date.now();
  let remaining = backlogSize;

  while (remaining > 0 && round < 100) {
    round++;
    const roundStart = Date.now();
    const res = await fetch(`${baseUrl}/cdn-cgi/handler/scheduled`);
    const roundMs = Date.now() - roundStart;
    console.log(`Round ${round}: Cron tick took ${roundMs}ms (HTTP ${res.status})`);
    remaining -= BATCH_SIZE; // approximate -- actual count should be verified via a D1 query after this script finishes
    await new Promise(r => setTimeout(r, 200)); // small pause between rounds, not a real 5-minute Cron gap
  }

  const totalMs = Date.now() - startedAt;
  console.log('');
  console.log(`Total: ${round} round(s) to process an assumed ${backlogSize}-item backlog in ${totalMs}ms.`);
  console.log('IMPORTANT: verify the ACTUAL remaining queue count via:');
  console.log(`  wrangler d1 execute voiceinsights-db --local --command="SELECT status, COUNT(*) as n FROM ai_processing_queue GROUP BY status"`);
}

run();

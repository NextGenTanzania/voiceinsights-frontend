import { performance } from 'node:perf_hooks';
import { buildQueueMessage } from '../src/cloudflare-queue-platform.js';
const total=Number(process.env.EVENTS||100000);
const started=performance.now(); let bytes=0;
for(let i=0;i<total;i++){
  const m=buildQueueMessage({jobType:'ai.processing',tenantId:`org-${i%100}`,jobId:`job-${i}`,idempotencyKey:`bench-${i}`,payload:{record_id:i,text:'synthetic benchmark payload'}});
  bytes+=JSON.stringify(m).length;
}
const elapsed=performance.now()-started;
const result={kind:'local_cpu_serialization_benchmark',events:total,elapsed_ms:Number(elapsed.toFixed(2)),events_per_second:Number((total/(elapsed/1000)).toFixed(2)),serialized_megabytes:Number((bytes/1024/1024).toFixed(2)),live_cloudflare_load_test:false};
console.log(JSON.stringify(result,null,2));

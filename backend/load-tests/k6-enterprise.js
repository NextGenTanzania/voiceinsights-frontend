import http from 'k6/http';
import { check, sleep } from 'k6';
export const options={scenarios:{pilot:{executor:'ramping-arrival-rate',startRate:10,timeUnit:'1s',preAllocatedVUs:100,maxVUs:2000,stages:[{target:100,duration:'2m'},{target:500,duration:'5m'},{target:1000,duration:'5m'},{target:0,duration:'1m'}]}},thresholds:{http_req_failed:['rate<0.01'],http_req_duration:['p(95)<1500','p(99)<3000']}};
const base=__ENV.BASE_URL; const token=__ENV.ACCESS_TOKEN;
export default function(){const r=http.get(`${base}/api/ops/readiness`,{headers:{Authorization:`Bearer ${token}`}});check(r,{'status acceptable':x=>[200,503].includes(x.status),'json response':x=>(x.headers['Content-Type']||'').includes('application/json')});sleep(0.1);}

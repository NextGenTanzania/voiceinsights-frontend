// VoiceInsights v210.8 — Benchmark Cloud™
// Privacy-preserving organization, country, sector, regional and historical benchmarking.
export const BENCHMARK_CLOUD_V2108_VERSION = 'v210.8.0';

const METRIC_DEFINITIONS = {
  response_rate: {label:'Response Rate',unit:'%',higher_is_better:true},
  completion_rate: {label:'Completion Rate',unit:'%',higher_is_better:true},
  data_quality_score: {label:'Data Quality Score',unit:'/100',higher_is_better:true},
  average_interview_minutes: {label:'Average Interview Time',unit:' minutes',higher_is_better:false},
  cost_per_completion: {label:'Cost per Completion',unit:'',higher_is_better:false},
  report_quality_score: {label:'Report Quality Score',unit:'/10',higher_is_better:true},
  enumerator_productivity: {label:'Enumerator Productivity',unit:' interviews/day',higher_is_better:true},
  voice_transcription_confidence: {label:'Voice Transcription Confidence',unit:'%',higher_is_better:true}
};

export function percentileRank(value, peers=[], higherIsBetter=true) {
  const nums=peers.map(Number).filter(Number.isFinite);
  const v=Number(value);
  if(!Number.isFinite(v) || !nums.length) return null;
  const favorable=nums.filter(x=>higherIsBetter ? x<=v : x>=v).length;
  return Math.round((favorable/nums.length)*100);
}

export function benchmarkStatus(value, median, higherIsBetter=true) {
  const v=Number(value), m=Number(median);
  if(!Number.isFinite(v)||!Number.isFinite(m)) return 'insufficient_data';
  const delta=higherIsBetter ? v-m : m-v;
  const threshold=Math.max(Math.abs(m)*0.05, 0.5);
  if(delta>=threshold) return 'above_benchmark';
  if(delta<=-threshold) return 'below_benchmark';
  return 'in_line';
}

export function summarize(values=[]) {
  const nums=values.map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!nums.length) return {count:0,average:null,median:null,min:null,max:null};
  const mid=Math.floor(nums.length/2);
  const median=nums.length%2?nums[mid]:(nums[mid-1]+nums[mid])/2;
  return {count:nums.length,average:Number((nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(2)),median:Number(median.toFixed(2)),min:nums[0],max:nums[nums.length-1]};
}

export function buildComparison({metric='response_rate',organizationValue=null,peerValues=[],scope='sector',label='Peer Group'}={}) {
  const def=METRIC_DEFINITIONS[metric]||{label:metric,unit:'',higher_is_better:true};
  const stats=summarize(peerValues);
  const value=Number(organizationValue);
  const delta=Number.isFinite(value)&&Number.isFinite(stats.median)?Number((value-stats.median).toFixed(2)):null;
  return {metric,label:def.label,unit:def.unit,scope,peer_group:label,organization_value:Number.isFinite(value)?value:null,peer_statistics:stats,delta_from_median:delta,percentile:percentileRank(value,peerValues,def.higher_is_better),status:benchmarkStatus(value,stats.median,def.higher_is_better),higher_is_better:def.higher_is_better};
}

export function buildHistoricalTrend(records=[], metric='response_rate') {
  const points=records.filter(r=>r.metric===metric).map(r=>({period:r.period,value:Number(r.value),scope:r.scope||'organization'})).filter(x=>Number.isFinite(x.value)).sort((a,b)=>String(a.period).localeCompare(String(b.period)));
  if(!points.length) return {metric,points:[],direction:'no_data',change:null};
  const change=points.length>1?Number((points.at(-1).value-points[0].value).toFixed(2)):0;
  return {metric,points,direction:change>0?'improving':change<0?'declining':'stable',change};
}

export function buildBenchmarkWorkspace({organization={},snapshots=[],peerSnapshots=[]}={}) {
  const latestByMetric={};
  snapshots.forEach(s=>{ if(!latestByMetric[s.metric] || String(s.period)>String(latestByMetric[s.metric].period)) latestByMetric[s.metric]=s; });
  const comparisons=Object.entries(latestByMetric).map(([metric,row])=>buildComparison({metric,organizationValue:row.value,peerValues:peerSnapshots.filter(p=>p.metric===metric).map(p=>p.value),scope:row.scope||'sector',label:row.peer_group_label||'Privacy-safe peer group'}));
  const trendMetrics=[...new Set(snapshots.map(s=>s.metric))];
  const trends=trendMetrics.map(m=>buildHistoricalTrend(snapshots,m));
  return {
    version:BENCHMARK_CLOUD_V2108_VERSION,
    label:'VoiceInsights Benchmark Cloud',
    mission:'Compare performance without exposing another organization’s respondent-level or confidential data.',
    organization:{id:organization.id||null,name:organization.name||'Current Organization',country:organization.country||'Not set',sector:organization.sector||'Not set',region:organization.region||'Not set'},
    overview:{metrics_tracked:trendMetrics.length,snapshots:snapshots.length,peer_observations:peerSnapshots.length,benchmarks_available:comparisons.filter(c=>c.peer_statistics.count>=3).length},
    benchmark_views:[
      {key:'organization',label:'Organization Benchmark',description:'Compare projects, programmes and campaigns inside the current organization.'},
      {key:'country',label:'Country Benchmark',description:'Compare aggregated indicators with consented, privacy-safe country peer groups.'},
      {key:'sector',label:'Sector Benchmark',description:'Compare against organizations operating in the same sector.'},
      {key:'regional',label:'Regional Benchmark',description:'Compare East, West, Central, Southern and North Africa peer groups.'},
      {key:'historical',label:'Historical Trends',description:'Track the organization’s performance through time.'}
    ],
    comparisons,
    historical_trends:trends,
    privacy:{raw_cross_organization_data_exposed:false,minimum_peer_group_size:3,aggregation_required:true,organization_opt_in_required:true,respondent_identifiers_excluded:true},
    governance:{organization_scoped:true,founder_can_view_platform_aggregates:true,organization_admin_sees_own_org_only:true,benchmarks_must_be_labelled_when_sample_is_small:true}
  };
}

export function validateSnapshot(input={}) {
  const metric=String(input.metric||''); const value=Number(input.value); const period=String(input.period||'');
  if(!METRIC_DEFINITIONS[metric]) return {ok:false,error:'Unsupported benchmark metric'};
  if(!Number.isFinite(value)) return {ok:false,error:'A numeric value is required'};
  if(!/^\d{4}(-Q[1-4]|-\d{2})?$/.test(period)) return {ok:false,error:'period must be YYYY, YYYY-Q1..Q4, or YYYY-MM'};
  return {ok:true,record:{metric,value,period,scope:['organization','country','sector','regional'].includes(input.scope)?input.scope:'organization',country:input.country||null,sector:input.sector||null,region:input.region||null,peer_group_label:input.peer_group_label||null,source_reference:input.source_reference||null}};
}

export { METRIC_DEFINITIONS };

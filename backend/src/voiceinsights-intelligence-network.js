// VoiceInsights Intelligence Network™ (VIN™)
// Network-ready, privacy-preserving intelligence layer. Cross-organization
// aggregation remains disabled until founder activation and minimum thresholds.

export const VIN_PRODUCT_NAME = 'VoiceInsights Intelligence Network™ (VIN™)';
export const VIN_MINIMUMS = Object.freeze({ organizations: 20, countries: 5, regions: 2, opted_in_organizations: 15 });
export const VIN_CONSENT_FIELDS = Object.freeze([
  'anonymous_benchmarking', 'sector_benchmarking', 'country_benchmarking',
  'regional_intelligence', 'africa_intelligence', 'public_statistics'
]);

const pct=(n,d)=>d?Math.round((n/d)*100):0;
const clamp=n=>Math.max(0,Math.min(100,Number(n)||0));

export function normalizeVinConsent(input={}) {
  const out={};
  for (const key of VIN_CONSENT_FIELDS) out[key]=input[key]===true;
  return out;
}

export function validateVinConsent(input={}) {
  const consent=normalizeVinConsent(input);
  if (consent.public_statistics && !consent.africa_intelligence) {
    return {ok:false,error:'Public statistics require Africa intelligence opt-in.'};
  }
  if (consent.africa_intelligence && !consent.anonymous_benchmarking) {
    return {ok:false,error:'Africa intelligence requires anonymous benchmarking opt-in.'};
  }
  return {ok:true,consent};
}

export function buildVinReadiness(input={}) {
  const counts={
    organizations:Number(input.organizations||0),
    opted_in_organizations:Number(input.opted_in_organizations||0),
    countries:Number(input.countries||0),
    regions:Number(input.regions||0),
    sectors:Number(input.sectors||0),
    snapshots:Number(input.snapshots||0)
  };
  const requirements={
    organizations:counts.organizations>=VIN_MINIMUMS.organizations,
    opted_in_organizations:counts.opted_in_organizations>=VIN_MINIMUMS.opted_in_organizations,
    countries:counts.countries>=VIN_MINIMUMS.countries,
    regions:counts.regions>=VIN_MINIMUMS.regions,
    benchmark_cloud:Boolean(input.benchmark_cloud_ready),
    knowledge_cloud:Boolean(input.knowledge_cloud_ready),
    security:Boolean(input.security_ready),
    compliance:Boolean(input.compliance_ready)
  };
  const passed=Object.values(requirements).filter(Boolean).length;
  return {
    product_name:VIN_PRODUCT_NAME,
    counts, minimums:VIN_MINIMUMS, requirements,
    readiness_score:Math.round(passed/Object.keys(requirements).length*100),
    ready_for_activation:Object.values(requirements).every(Boolean),
    network_status:input.network_active?'ACTIVE':'PREPARING_NETWORK'
  };
}

export function canActivateVin({role,readiness,founder_confirmed=false}={}) {
  if (!['founder','super_admin'].includes(role)) return {ok:false,error:'Founder authorization required.'};
  if (!founder_confirmed) return {ok:false,error:'Explicit founder confirmation required.'};
  if (!readiness?.ready_for_activation) return {ok:false,error:'Network readiness requirements are not yet satisfied.'};
  return {ok:true};
}

export function aggregatePrivacySafeSnapshots(rows=[], options={}) {
  const minGroup=Math.max(5,Number(options.minimum_group_size||5));
  const grouped=new Map();
  for (const row of rows) {
    if (!row || row.opted_in !== 1 && row.opted_in !== true) continue;
    const country=row.country||'Unspecified';
    const region=row.region||'Unspecified';
    const sector=row.sector||'General';
    const metric=row.metric_key||'response_rate';
    const key=[country,region,sector,metric].join('|');
    if(!grouped.has(key)) grouped.set(key,[]);
    const value=Number(row.metric_value);
    if(Number.isFinite(value)) grouped.get(key).push({value,organization_id:row.organization_id,period:row.period||null});
  }
  const output=[];
  for (const [key,items] of grouped) {
    const orgs=new Set(items.map(i=>i.organization_id));
    if(orgs.size<minGroup) continue;
    const values=items.map(i=>i.value).sort((a,b)=>a-b);
    const avg=values.reduce((a,b)=>a+b,0)/values.length;
    const median=values[Math.floor(values.length/2)];
    const [country,region,sector,metric_key]=key.split('|');
    output.push({country,region,sector,metric_key,peer_organizations:orgs.size,observations:values.length,average:Number(avg.toFixed(2)),median:Number(median.toFixed(2)),minimum:Number(values[0].toFixed(2)),maximum:Number(values.at(-1).toFixed(2)),privacy_status:'AGGREGATED_MINIMUM_GROUP_SATISFIED'});
  }
  return output;
}

export function buildAfricaInsightsHub({readiness,aggregates=[],network_active=false}={}) {
  const sectors=[...new Set(aggregates.map(x=>x.sector))];
  const countries=[...new Set(aggregates.map(x=>x.country))];
  const regions=[...new Set(aggregates.map(x=>x.region))];
  return {
    product_name:VIN_PRODUCT_NAME,
    network_status:network_active?'ACTIVE':'PREPARING_NETWORK',
    activation_rule:'Founder activation only after readiness thresholds and organization opt-in.',
    readiness,
    coverage:{countries:countries.length,regions:regions.length,sectors:sectors.length,aggregated_indicators:aggregates.length},
    modules:[
      {key:'network_registry',label:'Network Registry',status:'available'},
      {key:'opt_in_governance',label:'Organization Opt-in Governance',status:'available'},
      {key:'country_intelligence',label:'Country Intelligence',status:network_active?'active':'preparing'},
      {key:'regional_intelligence',label:'Regional Intelligence',status:network_active?'active':'preparing'},
      {key:'sdg_intelligence',label:'SDG Intelligence',status:network_active?'active':'preparing'},
      {key:'policy_intelligence',label:'AI Policy Intelligence',status:network_active?'active':'preparing'},
      {key:'research_collaboration',label:'Research Collaboration Hub',status:'available'},
      {key:'public_intelligence',label:'Public Intelligence Portal',status:network_active?'controlled_release':'coming_soon'}
    ],
    aggregates:network_active?aggregates:[],
    privacy:{raw_cross_organization_data:false,respondent_identifiers:false,minimum_peer_group:5,organization_ownership_preserved:true}
  };
}

export function buildSdgIntelligence(aggregates=[]) {
  const sectorSdg={health:[3,5,10,17],education:[4,5,10,17],agriculture:[1,2,8,13],humanitarian:[1,2,3,6,11,16],governance:[10,16,17],climate:[6,7,11,12,13,15]};
  const map=new Map();
  for(const item of aggregates){
    for(const goal of sectorSdg[String(item.sector||'').toLowerCase()]||[17]){
      if(!map.has(goal)) map.set(goal,[]);
      map.get(goal).push(item.average);
    }
  }
  return [...map.entries()].map(([goal,values])=>({goal,signal:Number((values.reduce((a,b)=>a+b,0)/values.length).toFixed(2)),evidence_groups:values.length,classification:'AGGREGATED_NETWORK_SIGNAL'})).sort((a,b)=>a.goal-b.goal);
}

export function buildCollaborationOpportunity(input={}) {
  const required=['title','country','sector','opportunity_type'];
  for(const k of required) if(!String(input[k]||'').trim()) return {ok:false,error:`${k} is required`};
  return {ok:true,opportunity:{title:String(input.title).trim(),country:String(input.country).trim(),region:String(input.region||'').trim()||null,sector:String(input.sector).trim(),opportunity_type:String(input.opportunity_type).trim(),description:String(input.description||'').trim(),skills:Array.isArray(input.skills)?input.skills.slice(0,20):[],status:'open'}};
}

export function buildVinWorkspace(input={}) {
  const readiness=buildVinReadiness(input);
  const aggregates=aggregatePrivacySafeSnapshots(input.snapshots||[],{minimum_group_size:input.minimum_group_size||5});
  return {
    ...buildAfricaInsightsHub({readiness,aggregates,network_active:Boolean(input.network_active)}),
    sdg_intelligence:input.network_active?buildSdgIntelligence(aggregates):[],
    feature_flags:{network_registry:true,opt_in_governance:true,aggregation_engine:Boolean(input.network_active),public_portal:Boolean(input.public_portal_active),policy_assistant:Boolean(input.network_active),collaboration_hub:true},
    customer_label:VIN_PRODUCT_NAME
  };
}

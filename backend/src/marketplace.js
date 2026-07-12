// VoiceInsights v210.7 — Marketplace
export const MARKETPLACE_V2107_VERSION = 'v210.7.0';

export const MARKETPLACE_CATALOG = [
  {id:'survey-health-access',type:'survey_template',name:'Health Access & Service Readiness Survey',sector:'health',publisher:'VoiceInsights Africa',version:'1.0.0',rating:4.9,installs:128,price:'Included',description:'Multilingual health access, service readiness and patient-experience questionnaire.',features:['skip logic','voice-ready','offline-ready','consent block']},
  {id:'survey-post-activity',type:'survey_template',name:'Post-Activity Feedback Survey',sector:'cross-sector',publisher:'VoiceInsights Africa',version:'1.0.0',rating:4.9,installs:236,price:'Included',description:'Fast feedback template for trainings, workshops, programmes and community events.',features:['shareable link','QR-ready','SMS fallback','mobile-first']},
  {id:'prompt-executive-story',type:'ai_prompt',name:'Executive Storytelling Prompt Pack',sector:'cross-sector',publisher:'VoiceInsights Africa',version:'1.0.0',rating:4.8,installs:94,price:'Included',description:'Decision-first prompts for executive, donor, government and board narratives.',features:['grounded outputs','audience tone','risk framing','action prioritisation']},
  {id:'dashboard-campaign-ops',type:'dashboard',name:'Campaign Operations Command Center',sector:'cross-sector',publisher:'VoiceInsights Africa',version:'1.0.0',rating:4.9,installs:73,price:'Included',description:'Live channel, response, queue, cost and completion intelligence dashboard.',features:['phone','WhatsApp','SMS','web','offline']},
  {id:'widget-sdg-cards',type:'widget',name:'SDG Visual Cards',sector:'development',publisher:'VoiceInsights Africa',version:'1.0.0',rating:4.8,installs:156,price:'Included',description:'Publication-grade SDG cards with evidence and confidence labels.',features:['responsive','print-safe','evidence-aware','sector themes']},
  {id:'connector-dhis2',type:'connector',name:'DHIS2 Integration Connector',sector:'health',publisher:'VoiceInsights Africa',version:'0.9.0',rating:4.7,installs:41,price:'Configuration required',description:'Secure import and export bridge for DHIS2 programmes and indicators.',features:['token encryption','mapping','scheduled sync','audit trail']},
  {id:'connector-kobo',type:'connector',name:'KoboToolbox Connector',sector:'research',publisher:'VoiceInsights Africa',version:'0.9.0',rating:4.7,installs:62,price:'Configuration required',description:'Bring Kobo projects and submissions into VoiceInsights intelligence workflows.',features:['project import','response sync','field mapping','deduplication']},
  {id:'report-donor-impact',type:'report_template',name:'Donor Impact Publication',sector:'development',publisher:'VoiceInsights Africa',version:'1.0.0',rating:4.9,installs:110,price:'Included',description:'Donor-ready report structure with logframe, VFM, inclusion and next-cycle recommendations.',features:['evidence explorer','executive story','PowerPoint-ready','SDG alignment']},
  {id:'report-government-brief',type:'report_template',name:'Government Decision Brief',sector:'public-sector',publisher:'VoiceInsights Africa',version:'1.0.0',rating:4.9,installs:89,price:'Included',description:'Policy and implementation brief for ministries and public-sector decision makers.',features:['cabinet summary','policy options','regional equity','implementation risks']}
];

export function searchMarketplace({q='',type='',sector=''}={}) {
  const query=String(q).trim().toLowerCase();
  return MARKETPLACE_CATALOG.filter(item =>
    (!type || item.type===type) && (!sector || item.sector===sector) &&
    (!query || [item.name,item.description,item.publisher,item.sector,...item.features].join(' ').toLowerCase().includes(query))
  ).sort((a,b)=>b.rating-a.rating || b.installs-a.installs);
}

export function buildMarketplaceWorkspace(installed=[]) {
  const installedIds=new Set(installed.filter(x=>x.status==='installed').map(x=>x.item_id));
  const categories=[...new Set(MARKETPLACE_CATALOG.map(x=>x.type))];
  return {
    version: MARKETPLACE_V2107_VERSION,
    label:'VoiceInsights Marketplace',
    mission:'Extend VoiceInsights Cloud with trusted templates, prompts, dashboards, widgets, connectors and reports.',
    categories: categories.map(type=>({type,count:MARKETPLACE_CATALOG.filter(x=>x.type===type).length})),
    overview:{catalog_items:MARKETPLACE_CATALOG.length,installed:installedIds.size,publishers:1,average_rating:Number((MARKETPLACE_CATALOG.reduce((s,x)=>s+x.rating,0)/MARKETPLACE_CATALOG.length).toFixed(1))},
    featured: MARKETPLACE_CATALOG.slice().sort((a,b)=>b.installs-a.installs).slice(0,6).map(x=>({...x,installed:installedIds.has(x.id)})),
    governance:{organization_scoped_installs:true,founder_controls_global_publishers:true,connectors_require_configuration:true,uninstall_supported:true,audit_events_required:true}
  };
}

export function validateMarketplaceInstall(itemId) {
  const item=MARKETPLACE_CATALOG.find(x=>x.id===itemId);
  if(!item) return {ok:false,error:'Marketplace item not found'};
  return {ok:true,item,configuration_required:item.type==='connector'};
}

import { buildFullFlagshipPublication } from './full-flagship-publication.js';
import { enhancePlatinumPublication } from './platinum-publication-enhancer.js';
import { buildPlatinumReport } from './platinum-report-engine.js';

const DEMO_SAMPLE={
  key:'me_demo_brief',
  title:'M&E Evidence, Quality & Decision Brief',
  country:'East Africa Demonstration Portfolio',
  sector:'Monitoring',
  category:'M&E Interactive Demonstration',
  style:'un',
  tier:1,
  promise:'How VoiceInsights Africa turns multi-channel monitoring data into quality assurance, evidence, accountable decisions and follow-up action.',
  standards:['SDG 3','SDG 5','SDG 10','SDG 16','OECD-DAC','RBM','CHS','UN Evaluation Principles'],
  cover:{primary:'#073B32',accent:'#0F766E',highlight:'#D4AF37',motif:'Evidence-to-decision pathway'}
};

export function buildMeDemoBrief(){
  const full=buildFullFlagshipPublication(DEMO_SAMPLE);
  full.cover={...full.cover,label:'M&E DEMO BRIEF — SYNTHETIC DATA',subtitle:DEMO_SAMPLE.promise};
  full.estimated_pages=28;
  full.integrity_notice='DEMONSTRATION ONLY. Prepared by VoiceInsights Africa using synthetic M&E data. This brief is separate from the sixteen flagship sample reports and does not contain real client or respondent records.';
  const report={
    id:'voiceinsights-me-demo-brief',title:DEMO_SAMPLE.title,report_title:DEMO_SAMPLE.title,
    organization_name:'VoiceInsights Africa',prepared_by:'VoiceInsights Africa',classification:'Public synthetic M&E demonstration brief',
    executive_summary:`This demonstration brief shows how VoiceInsights Africa connects field collection, data quality, evidence traceability, results-based management and decision intelligence. The model contains ${full.sample_size.toLocaleString()} synthetic records across ${full.regions_covered} demonstration geographies.`,
    findings:full.findings.slice(0,6),recommendations:full.recommendations.slice(0,7),
    evidence:full.quotes.map(q=>({id:q.id,type:'synthetic respondent voice',source:q.quote,region:q.region,confidence_score:q.confidence,verification:q.verification})),
    methodology:full.methodology,limitations:full.methodology.limitations,standards:DEMO_SAMPLE.standards,
    kpis:[{label:'Synthetic responses',value:full.sample_size},{label:'Response rate',value:`${full.response_rate_pct}%`},{label:'Data quality',value:'93%'},{label:'Open quality reviews',value:12},{label:'Regions',value:full.regions_covered},{label:'Standards mapped',value:DEMO_SAMPLE.standards.length}],
    risks:full.regional.filter(x=>x.risk!=='Low').map(x=>({risk:`Quality or delivery risk in ${x.name}`,priority:x.risk})),
    opportunities:[{opportunity:'Use decision signals for targeted field support'},{opportunity:'Close feedback loops through accountable management response'},{opportunity:'Track SDG and RBM indicators through follow-up measurement'}],
    full_publication:full,chapters:full.chapters,visualizations:full.visualizations,regional_data:full.regional,demographics:full.demographics,indicators:full.indicators,quotes:full.quotes,raw_data:full.raw_data,data_dictionary:full.data_dictionary,
    international_frameworks:full.international_frameworks,sdg_alignment:full.sdg_alignment,oecd_dac:full.oecd_dac,rbm_results_framework:full.rbm_results_framework,chs_commitments:full.chs_commitments,standards_compliance_matrix:full.standards_compliance_matrix
  };
  Object.assign(report,enhancePlatinumPublication(report)); report.platinum=buildPlatinumReport(report);
  report.demo_workflow=['Synthetic collection','Automated quality checks','M&E review','Evidence traceability','Decision intelligence','Management response','Follow-up measurement'];
  report.demo_recommendations=report.decision_architecture.slice(0,6);
  return {ok:true,demo:true,prepared_by:'VoiceInsights Africa',logo_path:'/assets/img/logo-transparent.png',sample:DEMO_SAMPLE,report,full_publication:full,platinum:report.platinum,integrity_notice:full.integrity_notice};
}

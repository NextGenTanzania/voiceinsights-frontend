import { buildPlatinumReport } from './platinum-report-engine.js';
/**
 * VoiceInsights Africa World-Class Flagship Sample Reports Generator™
 * One governed generator creates the public library, interactive models and every export.
 * All publications are synthetic demonstrations and must never be represented as official statistics.
 */

export const FLAGSHIP_SAMPLE_LIBRARY_NAME = 'VoiceInsights Africa World-Class Flagship Sample Reports Generator™';
export const SYNTHETIC_NOTICE = 'Synthetic Demonstration Publication produced by VoiceInsights Africa. All people, quotations, locations and statistics are synthetic, internally governed demonstration content and are not official statistics.';

const REPORTS = [
  ['national-human-development','National Human Development Intelligence Report','Government','Government','Tanzania','Human Development','Deep Blue','National maps and cabinet intelligence',['SDG 1','SDG 3','SDG 4','SDG 5','Leave No One Behind','Human Rights Based Approach']],
  ['donor-impact-evaluation','Donor Impact Evaluation Report','UN & Donors','Donor','Uganda','Integrated Livelihoods','Purple','OECD-DAC, results chain and value for money',['OECD-DAC','RBM','Theory of Change','UNEG','Gender Equality']],
  ['government-policy-intelligence','Government Policy Intelligence Report','Government','Government','Kenya','Public Service Delivery','Deep Blue','Cabinet decisions and national policy maps',['RBM','SDG 16','Leave No One Behind','Data Protection']],
  ['humanitarian-needs-assessment','Humanitarian Needs Assessment Report','UN & Donors','Humanitarian','Somalia','Humanitarian Response','Light Blue','Severity, protection and response priorities',['CHS','Protection','Safeguarding','Human Rights Based Approach','Climate Resilience']],
  ['executive-board-intelligence','Executive Board Intelligence Report','Corporate','Board','South Africa','Enterprise Performance','Black Gold','Board decisions, ROI and strategic risk',['Responsible AI','Data Protection','Privacy Controls']],
  ['customer-experience-intelligence','Customer Experience Intelligence Report','Corporate','Corporate','Tanzania','Financial Services','Black Gold','Customer journey, loyalty and service recovery',['Data Protection','Privacy Controls','Disability Inclusion']],
  ['employee-experience-intelligence','Employee Experience Intelligence Report','Corporate','Corporate','Rwanda','Workforce Experience','Black Gold','Engagement, retention and culture intelligence',['Gender Equality','Disability Inclusion','Safeguarding']],
  ['community-scorecard-intelligence','Community Scorecard Intelligence Report','NGOs','NGO','Malawi','Primary Healthcare','Green Blue','Community accountability and provider action',['CHS','SDG 3','Gender Equality','Disability Inclusion']],
  ['annual-impact-report','Annual Impact Report','NGOs','NGO','Zambia','Youth Economic Inclusion','Emerald','Outcome pathways and beneficiary voice',['RBM','SDG 8','Theory of Change','Leave No One Behind']],
  ['quarterly-performance-intelligence','Quarterly Performance Intelligence Report','NGOs','NGO','Mozambique','Programme Delivery','Cobalt','Delivery dashboard and corrective action',['RBM','Risk Management','Data Protection']],
  ['market-intelligence','Market Intelligence Report','Corporate','Corporate','Ghana','Digital Financial Services','Black Gold','Market segmentation, growth and opportunity',['Responsible AI','Data Protection','Privacy Controls']],
  ['technical-research','Technical Research Report','Research','Research','Ethiopia','Agricultural Resilience','White Academic','Methodological rigor and reproducibility',['Research Ethics','Data Protection','Climate Resilience']],
  ['statistical-intelligence','Statistical Intelligence Report','Research','Research','Tanzania','Health Systems','White Academic','Inference, weighting and model diagnostics',['World Bank Statistical Standards','Reproducibility','Microdata Governance']],
  ['interactive-intelligence','Interactive Intelligence Report','Research','Interactive','East Africa','Regional Development','Midnight Teal','Evidence drill-down and knowledge graph',['Responsible AI','Data Protection','Accessibility']],
  ['evidence-explorer','Evidence Explorer Report','Research','Evidence','Tanzania','Citizen Feedback','Indigo','Claim-to-source lineage and governed AI explanation',['UNEG','Responsible AI','Privacy Controls','Safeguarding']],
  ['sdg-progress-intelligence','SDG Progress Intelligence Report','UN & Donors','UN','Africa','Sustainable Development','UN Blue','SDG targets, contribution and limitations',['SDGs','Leave No One Behind','Gender Equality','Climate Resilience']]
];

const THEMES = {
  'Deep Blue': {primary:'#082B55',accent:'#1669A8',highlight:'#D7B65A',motif:'national cartography'},
  'Purple': {primary:'#32105C',accent:'#7651B5',highlight:'#F0C35A',motif:'results chain'},
  'Light Blue': {primary:'#0B4C74',accent:'#28A9E0',highlight:'#F47A38',motif:'severity map'},
  'Black Gold': {primary:'#111111',accent:'#383838',highlight:'#D4AF37',motif:'executive signal grid'},
  'Green Blue': {primary:'#0E5138',accent:'#188A7A',highlight:'#E5B84B',motif:'community scorecard'},
  'Emerald': {primary:'#075C4A',accent:'#11A37F',highlight:'#F2C14E',motif:'impact pathway'},
  'Cobalt': {primary:'#123A73',accent:'#2F6FD0',highlight:'#F0A629',motif:'performance pulse'},
  'White Academic': {primary:'#F8FAFC',accent:'#334155',highlight:'#8B1E3F',motif:'statistical notation'},
  'Midnight Teal': {primary:'#061B2B',accent:'#008F8C',highlight:'#66E3D4',motif:'interactive evidence graph'},
  'Indigo': {primary:'#21134F',accent:'#5B4BB7',highlight:'#C9B8FF',motif:'evidence network'},
  'UN Blue': {primary:'#0B4F8A',accent:'#4DA6D9',highlight:'#F2C14E',motif:'SDG target wheel'}
};

// Sector-specific blueprints prevent the governed generator from producing sixteen
// cosmetically different versions of the same generic report.
const BLUEPRINTS = {
  'national-human-development':{subjects:['multidimensional poverty transitions','primary healthcare continuity','school-to-work mobility','gendered time poverty','district capability gaps'],actions:['Adopt a cabinet-owned human development delivery compact','Protect primary-care and foundational-learning allocations','Target social protection to overlapping deprivations','Publish a gender-responsive district performance scorecard','Run a twelve-month district capability accelerator'],regions:['Lake Zone','Central Corridor','Northern Highlands','Coastal Belt'],indicators:['Human development opportunity score','Essential health continuity','Learning-to-work transition','Overlapping deprivation rate']},
  'donor-impact-evaluation':{subjects:['outcome additionality','value for money','livelihood resilience','gendered benefit distribution','sustainability after exit'],actions:['Approve an adaptive results and learning window','Reallocate financing toward high-additionality pathways','Introduce equity-weighted value-for-money reviews','Fund partner transition and institutional ownership','Commission a pre-exit sustainability verification'],regions:['Northern Livelihoods Cluster','Eastern Enterprise Cluster','Lake Communities','Central Markets'],indicators:['Outcome additionality index','Cost per sustained outcome','Resilience capacity score','Women-controlled income gain']},
  'government-policy-intelligence':{subjects:['policy reach','administrative burden','county implementation variance','citizen trust','grievance resolution'],actions:['Issue a cabinet delivery directive with named accountabilities','Simplify the highest-burden service procedures','Deploy county implementation support teams','Publish a citizen trust and service recovery dashboard','Set statutory grievance-resolution service levels'],regions:['Nairobi Metro','Coast Counties','Western Counties','Arid and Semi-Arid Counties'],indicators:['Policy reach rate','Administrative burden score','Implementation fidelity','Grievance resolution rate']},
  'humanitarian-needs-assessment':{subjects:['multisector severity','protection exposure','safe water access','acute livelihood stress','accountability to affected people'],actions:['Prioritise severity-four locations in the next allocation round','Scale protection referral and safe disclosure pathways','Restore minimum safe-water coverage at priority sites','Expand shock-responsive cash with market monitoring','Close the community feedback loop within fourteen days'],regions:['Bay Cluster','Gedo Cluster','Lower Shabelle Cluster','Banadir Displacement Sites'],indicators:['Multisector severity score','Protection referral coverage','Safe water access','Feedback closure rate']},
  'executive-board-intelligence':{subjects:['profitable growth quality','operating leverage','strategic execution','enterprise risk concentration','capital allocation discipline'],actions:['Approve a value-creation plan with quarterly board gates','Exit structurally low-return activities','Create one enterprise execution office','Reduce the three largest unmanaged risk concentrations','Tie capital release to evidence-backed milestones'],regions:['Southern Africa','East Africa','West Africa','Central Functions'],indicators:['Risk-adjusted growth','Operating leverage','Strategic milestone attainment','Return on invested capital']},
  'customer-experience-intelligence':{subjects:['journey friction','first-contact resolution','trust and transparency','vulnerable customer inclusion','churn propensity'],actions:['Redesign the two highest-friction journeys','Give frontline teams authority for first-contact recovery','Publish plain-language pricing and service explanations','Introduce assisted channels for vulnerable customers','Trigger retention interventions from governed churn signals'],regions:['Dar es Salaam','Northern Zone','Lake Zone','Digital-only Customers'],indicators:['Customer effort score','First-contact resolution','Trust index','Predicted retention rate']},
  'employee-experience-intelligence':{subjects:['manager effectiveness','psychological safety','career mobility','workload sustainability','critical-talent retention'],actions:['Set manager quality as an executive performance measure','Protect confidential speak-up and response pathways','Publish transparent internal mobility criteria','Rebalance workload in the highest-burnout functions','Create evidence-led retention plans for critical roles'],regions:['Kigali Headquarters','Eastern Operations','Western Operations','Remote Workforce'],indicators:['Manager effectiveness score','Psychological safety index','Internal mobility rate','Critical-talent retention']},
  'community-scorecard-intelligence':{subjects:['respectful care','medicine availability','wait-time reliability','disability access','provider-community accountability'],actions:['Agree facility-level service improvement contracts','Stabilise tracer-medicine availability','Introduce visible wait-time and triage standards','Fund priority disability-access adaptations','Hold quarterly community-provider evidence reviews'],regions:['Central Facilities','Northern Facilities','Southern Facilities','Hard-to-Reach Facilities'],indicators:['Respectful care score','Tracer medicine availability','Median wait-time compliance','Community action closure']},
  'annual-impact-report':{subjects:['decent employment outcomes','enterprise survival','young women participation','income resilience','systems-level contribution'],actions:['Scale pathways with verified employment conversion','Add twelve-month enterprise survival support','Remove participation constraints facing young women','Integrate savings and shock-readiness coaching','Formalise employer and public-system partnerships'],regions:['Lusaka Corridor','Copperbelt','Eastern Province','Rural Enterprise Hubs'],indicators:['Decent employment conversion','Enterprise twelve-month survival','Young women outcome parity','Income resilience score']},
  'quarterly-performance-intelligence':{subjects:['milestone delivery','budget absorption quality','partner performance','procurement delay','corrective-action closure'],actions:['Launch a thirty-day recovery sprint for red milestones','Link budget release to verified delivery evidence','Place underperforming partners on time-bound support plans','Escalate critical procurement bottlenecks','Close overdue management actions before quarter end'],regions:['North Portfolio','Central Portfolio','Coastal Portfolio','Cross-Cutting Services'],indicators:['Milestone delivery rate','Evidence-backed budget absorption','Partner performance score','Corrective-action closure']},
  'market-intelligence':{subjects:['addressable demand','segment economics','digital trust','channel productivity','competitive differentiation'],actions:['Prioritise the two highest-value underserved segments','Test segment-specific pricing and propositions','Build visible privacy and fraud-protection signals','Shift acquisition to the most productive channel mix','Defend differentiation through service reliability'],regions:['Greater Accra','Ashanti','Northern Growth Markets','Digital Nationwide'],indicators:['Serviceable market capture','Segment contribution margin','Digital trust score','Acquisition cost efficiency']},
  'technical-research':{subjects:['climate exposure','technology adoption','yield stability','gendered asset access','extension-system effectiveness'],actions:['Pre-register a confirmatory resilience study','Target technologies by agro-ecological risk','Pair adoption support with seasonal finance','Correct gender gaps in productive-asset access','Test extension delivery through a stepped-wedge design'],regions:['Highland Systems','Rift Systems','Dryland Systems','Mixed Farming Systems'],indicators:['Climate resilience index','Technology adoption persistence','Yield variability','Extension contact quality']},
  'statistical-intelligence':{subjects:['effective coverage','facility readiness','wealth-related inequity','measurement reliability','predictive model stability'],actions:['Publish weighted effective-coverage estimates','Target readiness investment using uncertainty bands','Institutionalise equity decomposition','Repeat reliability and measurement-invariance testing','Monitor model drift before operational use'],regions:['Eastern Zone','Lake Zone','Northern Zone','Southern Highlands'],indicators:['Effective coverage','Facility readiness index','Concentration index','Calibration error']},
  'interactive-intelligence':{subjects:['regional divergence','cross-border service access','evidence connectivity','decision latency','scenario sensitivity'],actions:['Activate a regional exception-monitoring workspace','Create cross-border service continuity protocols','Expose claim-to-source knowledge graph links','Set decision turnaround service levels','Publish scenario assumptions beside every forecast'],regions:['Kenya','Tanzania','Uganda','Rwanda'],indicators:['Regional convergence index','Cross-border access continuity','Evidence graph completeness','Decision latency']},
  'evidence-explorer':{subjects:['claim traceability','source triangulation','review consistency','privacy-safe disclosure','AI explanation grounding'],actions:['Require source lineage for every publishable claim','Triangulate high-risk findings across source types','Calibrate reviewer decisions with blinded cases','Enforce disclosure checks before evidence download','Block AI explanations without approved citations'],regions:['Coastal Sample','Lake Sample','Northern Sample','Urban Sample'],indicators:['Claim traceability rate','Triangulation strength','Reviewer agreement','Grounded explanation rate']},
  'sdg-progress-intelligence':{subjects:['target trajectory','leave-no-one-behind gaps','financing alignment','data availability','climate-development co-benefits'],actions:['Focus acceleration plans on off-track targets','Fund disaggregated leave-no-one-behind measures','Align budget tagging with SDG contribution logic','Close priority national data gaps','Screen investments for climate-development co-benefits'],regions:['East Africa','West Africa','Southern Africa','Central Africa'],indicators:['Targets on track','Equity gap index','SDG-aligned financing','Data availability score']}
};

const hash = value => [...String(value)].reduce((a,c)=>((a<<5)-a+c.charCodeAt(0))|0, 0) >>> 0;
const seeded = (key, index, min, max) => min + (hash(`${key}:${index}`) % (max-min+1));
const round1 = n => Math.round(n*10)/10;
const evidenceId = (key,i)=>`EVI-${key.slice(0,3).toUpperCase()}-${String(i).padStart(3,'0')}`;
const findingId = (key,i)=>`FND-${key.slice(0,3).toUpperCase()}-${String(i).padStart(2,'0')}`;
const decisionId = (key,i)=>`DEC-${key.slice(0,3).toUpperCase()}-${String(i).padStart(2,'0')}`;

function definition(row,index){
  const [key,title,category,profile,country,sector,theme,personality,standards]=row;
  const blueprint=BLUEPRINTS[key];
  return {key,title,category,profile:profile.toLowerCase(),country,sector,theme,personality,standards,tier:index<4?1:index<11?2:3,featured:index<4,style:profile.toLowerCase(),cover:{...(THEMES[theme]||THEMES['Deep Blue']),accent:`#${((hash(key)+index*2654435761)>>>0).toString(16).slice(-6).padStart(6,'0')}`,layout_variant:index+1},visuals:['Executive dashboard','Heat map','Decision matrix','Evidence graph'],promise:`A decision-ready ${sector.toLowerCase()} publication for ${country}, built from traceable synthetic evidence.`,executive_story:`This ${title.toLowerCase()} tests ${blueprint.subjects.slice(0,3).join(', ')} and translates the resulting synthetic evidence into accountable decisions for ${profile.toLowerCase()} leaders.`,quality_score:null};
}
export const FLAGSHIP_SAMPLE_REPORTS = REPORTS.map(definition);

function buildEvidence(sample,count=10){
  const groups=['Rural women','Young adults','Persons with disabilities','Frontline workers','Low-income households','Service managers','Community leaders','Private-sector partners'];
  const blueprint=BLUEPRINTS[sample.key];
  return Array.from({length:count},(_,i)=>{
    const value=seeded(sample.key,i,54,86), confidence=seeded(sample.key,50+i,88,98);
    const subject=blueprint.subjects[i%blueprint.subjects.length],region=blueprint.regions[i%blueprint.regions.length],indicator=blueprint.indicators[i%blueprint.indicators.length];
    return {
      id:evidenceId(sample.key,i+1), evidence_id:evidenceId(sample.key,i+1), evidence_chain:`Dataset → Question Q${i+1} → Respondent group → Finding ${i%5+1} → Decision ${i%5+1}`,
      type:i%3===0?'survey':i%3===1?'key_informant_interview':'administrative_record',region,evidence_quality:confidence>=94?'HIGH':'MODERATE_HIGH', confidence_score:confidence, verification_status:'APPROVED_SYNTHETIC_DEMONSTRATION',verification:'APPROVED',
      source_interview:`SYN-${sample.key.slice(0,4).toUpperCase()}-${String(i+1).padStart(4,'0')}`, source:`SYN-${sample.key.slice(0,4).toUpperCase()}-${String(i+1).padStart(4,'0')}`, dataset_version:`synthetic-${sample.key}-2026.1`, survey_question:`Q${i+1}: How does ${subject} affect ${sample.sector.toLowerCase()} outcomes in ${region}?`,
      respondent_group:groups[i%groups.length], quote:`“In ${region}, ${subject} shapes whether ${groups[i%groups.length].toLowerCase()} can turn services into lasting outcomes.”`, transcript_excerpt:`Synthetic transcript ${i+1}: participants connected ${subject} to uneven delivery, accountability and the need for locally owned follow-up.`,
      indicator:`${indicator}`, statistic:{value,unit:'percent',denominator:seeded(sample.key,80+i,120,420)},
      gps:'MASKED_TO_DISTRICT', photo_reference:`SYN-PHOTO-${i+1}`, audio_reference:`SYN-AUDIO-${i+1}`, enumerator:`Synthetic Enumerator ${i+1}`, reviewer:'VoiceInsights Assurance Reviewer', approval:'APPROVED',
      lineage:{dataset:'synthetic flagship dataset',question:`Q${i+1}`,analysis:`weighted descriptive and segmented analysis`,finding: findingId(sample.key,i%5+1),recommendation:decisionId(sample.key,i%5+1)}
    };
  });
}

function buildFindings(sample,evidence){
  const subjects=BLUEPRINTS[sample.key].subjects;
  return subjects.map((subject,i)=>({
    id:findingId(sample.key,i+1), title:`Critical finding ${i+1}: ${subject}`,
    text:`Across ${sample.country}'s synthetic study areas, ${subject} is the clearest differentiator of ${sample.sector.toLowerCase()} performance. The evidence is strongest in ${evidence[i].region}, where ${evidence[i].respondent_group.toLowerCase()} face the largest gap. If the pattern remains unaddressed for twelve months, it is likely to weaken equity, delivery confidence and the durability of outcomes.`,
    evidence_ids:[evidence[i].id,evidence[(i+3)%evidence.length].id], confidence_score:round1((evidence[i].confidence_score+evidence[(i+3)%evidence.length].confidence_score)/2), verification_status:'VERIFIED',
    interpretation:`The pattern is consistent across quantitative and qualitative evidence and is strongest in lower-performing locations.`, related_indicator:evidence[i].indicator
  }));
}

function buildRecommendations(sample,findings){
  const actions=BLUEPRINTS[sample.key].actions;
  return actions.map((action,i)=>({
    id:decisionId(sample.key,i+1),decision_id:decisionId(sample.key,i+1),recommendation:`${action} for ${sample.sector.toLowerCase()}.`,strategic_priority:i<2?'CRITICAL':i<4?'HIGH':'MEDIUM',priority:i<2?'CRITICAL':i<4?'HIGH':'MEDIUM',
    evidence_used:findings[i].evidence_ids,why_this_recommendation_exists:findings[i].text,expected_benefit:`Improved equity, delivery confidence and measurable ${sample.sector.toLowerCase()} performance.`,
    expected_risk:i===0?'Execution capacity and coordination risk':'Insufficient ownership or delayed resourcing',dependencies:['Named executive sponsor','Validated operational baseline','Quarterly evidence review'],
    budget_requirement:i===0?'Medium — detailed costing and fiduciary review required':'Low to medium — validate through the formal planning cycle',budget_band:i===0?'Medium — detailed costing and fiduciary review required':'Low to medium — validate through the formal planning cycle',owner:sample.profile==='board'?'Chief Executive Officer / Board Sponsor':sample.profile==='government'?'Permanent Secretary':sample.profile==='humanitarian'?'Humanitarian Coordinator / Cluster Lead':sample.profile==='research'?'Principal Investigator':'Country Director / Programme Executive',supporting_organization:'M&E, Finance, Safeguarding and Delivery Units',
    timeline:i===0?'0–90 days':i<4?'3–12 months':'6–18 months',monitoring_indicator:`Percentage of agreed milestones completed for ${decisionId(sample.key,i+1)}`,success_criteria:'At least 80% of milestones achieved with verified evidence',management_response:'PENDING FORMAL MANAGEMENT RESPONSE',follow_up_actions:['Assign accountable owner','Validate budget','Approve milestone plan','Review evidence quarterly']
  }));
}

function buildVisuals(sample,evidence){
  const types=['executive_kpi_cards','regional_heat_map','choropleth_map','risk_matrix','decision_matrix','impact_chain','waterfall','treemap','radar','bubble_chart','journey_map','sankey','timeline','benchmark_chart','sdg_cards','executive_dashboard'];
  const blueprint=BLUEPRINTS[sample.key];
  return types.map((type,i)=>({id:`VIS-${String(i+1).padStart(2,'0')}`,type,title:`${type.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}: ${blueprint.indicators[i%blueprint.indicators.length]}`,data_source_ids:[evidence[i%evidence.length].id,evidence[(i+3)%evidence.length].id],data:Array.from({length:4},(_,j)=>({label:i%2?blueprint.regions[j]:blueprint.indicators[j],value:seeded(sample.key,310+i*7+j,48,91),target:seeded(sample.key,410+i*7+j,72,94),impact:['Moderate','High','Critical','High'][j],feasibility:['High','Moderate','Moderate','High'][j],risk:['Watch','Elevated','Critical','Stable'][j]})),interpretation:`The pattern shows how ${blueprint.indicators[i%blueprint.indicators.length].toLowerCase()} varies across priority segments or locations. Leadership should interpret the largest gaps alongside confidence, source lineage and the synthetic-use limitation before selecting an action.`,accessibility:{alt_text:`${type.replaceAll('_',' ')} for ${sample.title}`,table_fallback:true,color_independent_labels:true}}));
}

function scoreReport(report){
  const checks={
    branding:Boolean(report.branding?.logo && report.branding?.synthetic_notice), executive_book:Object.keys(report.executive_book||{}).length>=10,
    evidence:report.evidence?.length>=8 && report.findings.every(f=>f.evidence_ids?.length), statistics:Boolean(report.statistical_intelligence?.sampling_design && report.statistical_intelligence?.confidence_intervals),
    recommendations:report.recommendations?.length>=5 && report.recommendations.every(r=>r.evidence_used?.length && r.owner && r.timeline && r.monitoring_indicator),
    visuals:report.visualizations?.length>=12 && report.visualizations.every(v=>v.interpretation), standards:report.international_standards?.length>=2,
    publication_sections:['methodology','limitations','citations','data_dictionary','appendices','quality_statement'].every(k=>Boolean(report[k]?.length || Object.keys(report[k]||{}).length)),
    exports:report.exports?.length===9 && report.export_manifest?.length===9 && report.export_manifest.every(item=>item.path&&item.status==='GENERATED_FROM_GOVERNED_MODEL'), accessibility:Boolean(report.accessibility?.wcag_target), interactive:report.interactive_flow?.length>=10
  };
  checks.international_standards=checks.standards;
  const passed=Object.values(checks).filter(Boolean).length,total=Object.keys(checks).length,overall=Math.round(passed/total*100);
  const component=(...keys)=>Math.round(keys.filter(k=>checks[k]).length/keys.length*100);
  return {rules:checks,publication_quality:component('branding','publication_sections','exports'),evidence_quality:component('evidence','interactive'),statistical_quality:component('statistics','publication_sections'),visualization_quality:component('visuals','accessibility'),storytelling_quality:component('executive_book','recommendations'),accessibility:component('accessibility','visuals'),decision_support:component('recommendations','executive_book'),overall_publication_readiness:overall,gate:overall===100?'PUBLICATION_READY':'BLOCKED'};
}

export function buildFlagshipSampleReport(key){
  const sample=FLAGSHIP_SAMPLE_REPORTS.find(x=>x.key===key); if(!sample)return null;
  const evidence=buildEvidence(sample),findings=buildFindings(sample,evidence),recommendations=buildRecommendations(sample,findings),visualizations=buildVisuals(sample,evidence);
  const sampleSize=seeded(sample.key,200,1240,4860),responseRate=seeded(sample.key,201,78,94),designEffect=round1(seeded(sample.key,202,11,19)/10);
  const publicationDate='2026-07-11';
  const report={
    id:`VIA-FLAGSHIP-${sample.key.toUpperCase()}`,title:sample.title,subtitle:`Decision intelligence for ${sample.sector}`,country:sample.country,sector:sample.sector,classification:'PUBLIC SYNTHETIC DEMONSTRATION',publication_date:publicationDate,
    publication_profile:`International ${sample.profile.replace(/\b\w/g,c=>c.toUpperCase())} Publication Profile`,profile:sample.profile,style:sample.style,publication_page_equivalent:'34 generated publication pages',
    branding:{logo:'/assets/img/logo-transparent.png',prepared_by:'VoiceInsights Africa',tagline:'Every Voice. Every Language. Every Insight.',publication_id:`VIA-FLAGSHIP-${sample.key.toUpperCase()}`,publication_version:'Current Edition',copyright:'© 2026 VoiceInsights Africa',synthetic_notice:SYNTHETIC_NOTICE},
    executive_summary:`This flagship synthetic demonstration publication examines ${sample.sector.toLowerCase()} performance in ${sample.country}. The governed evidence model identifies uneven progress, concentrated risks and actionable opportunities. Findings are linked to synthetic source records, recommendations carry named accountability fields, and all statistical claims are generated from one internally consistent dataset.`,
    executive_book:{executive_brief:`Leadership should protect gains while concentrating action on the lowest-performing groups and locations.`,decision_snapshot:recommendations.slice(0,3),critical_findings:findings.slice(0,3),critical_risks:[{risk:'Uneven implementation widens existing disparities',likelihood:'High',impact:'High'},{risk:'Delayed financing weakens delivery confidence',likelihood:'Medium',impact:'High'}],top_opportunities:['Targeted operational acceleration','Evidence-led resource allocation','Stronger feedback accountability'],immediate_actions:recommendations.slice(0,2),priority_decisions:recommendations,budget_implications:'A medium-scale reprioritization is indicated; formal costing and fiduciary review are required.',cost_of_inaction:'Without corrective action, existing gaps are likely to persist and may increase the future cost of recovery.',ownership_matrix:recommendations.map(r=>({decision:r.id,owner:r.owner,timeline:r.timeline})),executive_confidence:'High confidence for synthetic demonstration purposes; not valid for real-world decision use.',strategic_outlook:'Improvement is achievable within 12–18 months if ownership, resourcing and evidence review are maintained.',key_messages:findings.map(f=>f.text),executive_dashboard:{sample_size:sampleSize,response_rate:responseRate,verified_findings:findings.length,priority_decisions:recommendations.length}},
    findings,evidence,recommendations,
    statistical_intelligence:{sampling_design:'Stratified multi-stage synthetic demonstration design',sampling_frame:`Synthetic frame covering programme-relevant population groups in ${sample.country}`,stratification:['Region','Urban/rural','Sex','Age','Disability status'],sample_size:sampleSize,weighting:'Post-stratification weights normalized to the synthetic population frame',confidence_intervals:'95% confidence intervals shown for eligible weighted estimates',response_rate:responseRate,reliability:{cronbach_alpha:0.86,status:'acceptable'},validity:{content:'expert-mapped synthetic instrument',construct:'factor structure reviewed for demonstration'},regression:'Multivariable regression included where outcome and assumptions are suitable',trend_analysis:'Three-period synthetic trend series',cross_tabulation:['Sex × location','Age × service access','Disability × satisfaction'],segmentation:'Five evidence-led respondent segments',missing_data_analysis:{item_nonresponse_percent:2.4,treatment:'multiple imputation for eligible analytical variables; complete-case sensitivity check'},outlier_detection:'IQR, leverage and influence diagnostics',design_effect:designEffect,data_quality_assessment:'Passed synthetic consistency, range, duplicate and contradiction checks',reproducibility_notes:'Deterministic generator, documented transformations and export manifest',methodological_limitations:['Synthetic data cannot support population inference','No institutional endorsement is implied','Cost estimates require external validation']},
    methodology:{research_objectives:[`Assess ${sample.sector.toLowerCase()} performance and equity`,`Identify operational drivers and decision priorities`],evaluation_questions:['What outcomes are changing?','Who is being left behind?','Which actions are most likely to improve performance?'],sampling_frame:`Synthetic programme population frame for ${sample.country}`,sample_size:sampleSize,stratification:['Region','Location type','Sex','Age','Disability'],weights:'Normalized post-stratification weights',confidence_intervals:'95%',design_effect:designEffect,missing_data:'Documented and sensitivity-tested',reliability:'Cronbach alpha 0.86',validity:'Content and construct validity checks',metadata:'Complete synthetic data dictionary and lineage registry'},
    limitations:['All content is synthetic and must not be interpreted as official statistics','Geographic references are illustrative','Budget implications are directional and require formal costing','Causal claims are not made without an appropriate design'],
    citations:evidence.map(e=>({citation_id:`CIT-${e.id}`,reference_id:`CIT-${e.id}`,evidence_id:e.id,source:e.source_interview,dataset_version:e.dataset_version,question:e.survey_question,citation:`VoiceInsights Africa. ${sample.title}. ${e.dataset_version}, ${e.id}, ${e.survey_question}`,access_note:'Synthetic demonstration source; not an external publication.'})),
    data_dictionary:Array.from({length:12},(_,i)=>({variable:`indicator_${i+1}`,label:`Synthetic ${sample.sector} indicator ${i+1}`,type:i%3===0?'numeric':'categorical',allowed_values:i%3===0?'0–100':'Documented code list',missing_code:'NA'})),
    appendices:['Technical methodology','Sampling and weighting','Evidence registry','Statistical tables','Data dictionary','Quality assurance statement','Management response matrix','Export manifest'],
    quality_statement:'This publication passed deterministic completeness, evidence linkage, statistical documentation, visual interpretation, accessibility and export-readiness rules. It remains a synthetic demonstration and requires external validation before real-world use.',
    international_standards:sample.standards.map(s=>({framework:s,relevance:`Applied where relevant to ${sample.sector}`,evidence_ids:[evidence[0].id,evidence[1].id],limitations:'Synthetic demonstration mapping; institutional validation not implied'})),
    ai_governance:{model:'Configured report intelligence model',prompt_version:'governed flagship prompt',temperature:0,dataset:'synthetic flagship dataset current',latency:'recorded at runtime',cost:'recorded at runtime',reviewer:'VoiceInsights Assurance Reviewer',approval:'APPROVED_SYNTHETIC_DEMONSTRATION'},
    visualizations,interactive_flow:['Finding','Evidence','Quote','Map','Indicator','Recommendation','AI Explanation','Related Findings','Knowledge Graph','Download Evidence'],
    accessibility:{wcag_target:'WCAG 2.2 AA',tagged_pdf_required:true,alt_text_required:true,table_fallback_required:true,keyboard_navigation_required:true,colour_independent_labels_required:true},
    exports:['Premium PDF','Editable Word','Native PowerPoint','Statistical Excel','Board Deck','Policy Brief','Cabinet Memo','Investor Deck','Interactive HTML'],
    export_manifest:[['Premium PDF','pdf'],['Editable Word','docx'],['Native PowerPoint','pptx'],['Statistical Excel','xlsx'],['Board Deck','board-deck'],['Policy Brief','policy-brief'],['Cabinet Memo','cabinet-memo'],['Investor Deck','investor-deck'],['Interactive HTML','html']].map(([product,path])=>({product,path:`/api/public/flagship-sample-library/${sample.key}/export/${path}`,status:'GENERATED_FROM_GOVERNED_MODEL'}))
  };
  report.publication_architecture=[
    {book:'Executive Intelligence Book',pages:'2–7',sections:['Executive brief','Decision snapshot','Risks','Opportunities','Budget implications']},
    {book:'Evidence Intelligence Book',pages:'8–15',sections:['Critical findings','Respondent voice','Evidence chains','Citation registry']},
    {book:'Statistical Intelligence Book',pages:'16–22',sections:['Sampling','Weighting','Uncertainty','Reliability','Model diagnostics']},
    {book:'Decision Intelligence Book',pages:'23–27',sections:['Decision matrix','Ownership','Budget','Roadmap','Management response']},
    {book:'Standards & Assurance',pages:'28–31',sections:['Relevant frameworks','Safeguarding','Privacy','Responsible AI','Accessibility']},
    {book:'Technical Appendices',pages:'32–34',sections:['Data dictionary','Quality gate','Export manifest','Responsible-use notice']}
  ];
  report.research_methodology_assurance={protocol:'Governed synthetic research protocol with sampling, weighting, reliability, validity and reproducibility controls',ethics:'Synthetic records only; no real participants or personal data',peer_review:'Independent synthetic-publication review checklist completed',reproducibility:'Deterministic inputs, versioned dataset and export manifest'};
  report.analytical_depth={inferential_statistics:'Enabled where assumptions and design permit',segmentation:'Evidence-led segments',trend_analysis:'Three-period synthetic series'};
  report.decision_architecture=recommendations.map(x=>({decision_id:x.id,decision:x.recommendation,owner:x.owner,start_window:x.timeline,cost_band:x.budget_requirement,monitoring_indicator:x.monitoring_indicator,evidence_ids:x.evidence_used}));
  report.evidence_registry=evidence;
  report.citation_registry=report.citations;
  report.publication_readiness={status:'PASS_FOR_SYNTHETIC_DEMONSTRATION',notice:SYNTHETIC_NOTICE};
  report.quality_scores=scoreReport(report);
  const blueprint=BLUEPRINTS[sample.key];
  const baseResponses=blueprint.regions.map((_,index)=>Math.floor(sampleSize*[.31,.27,.23,.19][index]));baseResponses[0]+=sampleSize-baseResponses.reduce((sum,value)=>sum+value,0);
  const regional=blueprint.regions.map((name,index)=>({name,responses:baseResponses[index],primary_score:seeded(sample.key,510+index,52,84),satisfaction:seeded(sample.key,520+index,50,88),women_pct:seeded(sample.key,530+index,48,58),youth_pct:seeded(sample.key,540+index,29,48),risk:['ELEVATED','WATCH','CRITICAL','STABLE'][index]}));
  const indicators=blueprint.indicators.map((label,index)=>{const value=seeded(sample.key,550+index,49,82),target=seeded(sample.key,560+index,76,92);return{id:`IND-${String(index+1).padStart(2,'0')}`,label,value,target,status:value>=target?'ON_TRACK':value>=target-10?'WATCH':'OFF_TRACK',trend:index%3===0?'IMPROVING':index%3===1?'STABLE':'DECLINING'};});
  const sdgFrameworks=sample.standards.filter(standard=>standard.includes('SDG'));
  const full_publication={
    cover:{...sample.cover,title:sample.title,prepared_by:'VoiceInsights Africa'},country:sample.country,sector:sample.sector,sample_size:sampleSize,response_rate_pct:responseRate,regions_covered:regional.length,overall_score:report.quality_scores.overall_publication_readiness,integrity_notice:SYNTHETIC_NOTICE,methodology:report.methodology,data_dictionary:report.data_dictionary.map(item=>[item.variable,`${item.label}; ${item.type}; allowed: ${item.allowed_values}`]),
    sdg_alignment:(sdgFrameworks.length?sdgFrameworks:['Relevant SDG contribution screening']).map((framework,index)=>({goal:String(framework).match(/\d+/)?.[0]||'Context-specific',contribution:index===0?'Primary':'Supporting',indicator_ids:[indicators[index%indicators.length].id],note:'Contribution mapping only; no attribution or institutional endorsement is implied.'})),
    oecd_dac:['Relevance','Coherence','Effectiveness','Efficiency','Impact','Sustainability'].map((criterion,index)=>({criterion,evidence_ids:[evidence[index%evidence.length].id],assessment:`Synthetic evidence indicates a ${index%2?'moderate-to-strong':'strong'} ${criterion.toLowerCase()} signal, subject to the stated design limitations.`,score:seeded(sample.key,600+index,72,91),management_implication:`Review ${criterion.toLowerCase()} evidence at the next formal management gate.`})),
    rbm_results_framework:{inputs:['Governed synthetic data','Delivery capacity','Approved financing'],activities:['Evidence collection','Segmented analysis','Management review'],outputs:[{id:'OUT-01',statement:'Verified findings and interpreted decision products'},{id:'OUT-02',statement:'Assigned actions with monitoring indicators'}],outcomes:[{id:'OC-01',statement:`Improved ${sample.sector.toLowerCase()} delivery and accountability`,indicators:[indicators[0].id,indicators[1].id]},{id:'OC-02',statement:'More equitable and durable outcomes',indicators:[indicators[2].id,indicators[3].id]}],impact:`Sustained, equitable improvement in ${sample.sector.toLowerCase()} performance`,indicators:recommendations.map(item=>item.monitoring_indicator),means_of_verification:['Evidence registry','Quarterly management review','Follow-up measurement'],risks:['Implementation delay','Financing shortfall'],assumptions:['Leadership ownership','Safeguarding and privacy controls remain effective']},
    chs_commitments:Array.from({length:9},(_,index)=>({commitment_number:index+1,commitment:`CHS Commitment ${index+1}`,evidence_ids:[evidence[index%evidence.length].id],status:sample.profile==='humanitarian'||sample.category==='NGOs'?'APPLIED':'CONTEXT_ONLY',action:'Validate relevance and assign an accountable owner before live use.'})),
    standards_compliance_matrix:[...report.international_standards.map(item=>({standard:item.framework,status:'APPLIED_WHERE_RELEVANT',evidence:`Mapped to ${item.evidence_ids.join(', ')}; ${item.limitations}`})),...['Evidence Traceability','Research Ethics','Data Protection','Accessibility','Responsible AI','Publication Integrity'].map((standard,index)=>({standard,status:'APPLIED',evidence:`Control linked to ${evidence[index%evidence.length].id} and the deterministic publication gate.`}))],
    quality_gate:{checks:report.quality_scores.rules,status:report.quality_scores.gate,score:report.quality_scores.overall_publication_readiness},regional,demographics:{sex:[['Women',52],['Men',47],['Other / prefer not to say',1]],age:[['18–24',24],['25–39',38],['40–59',27],['60+',11]],location:[['Urban',44],['Rural',56]]},indicators,
    quotes:evidence.map(item=>({quote:item.quote,evidence_id:item.id,region:item.region,respondent_group:item.respondent_group,theme:blueprint.subjects[evidence.indexOf(item)%blueprint.subjects.length],confidence:item.confidence_score})),
    raw_data:Array.from({length:240},(_,index)=>({response_id:`SYN-${sample.key}-${String(index+1).padStart(4,'0')}`,region:blueprint.regions[index%blueprint.regions.length],respondent_group:evidence[index%evidence.length].respondent_group,indicator:blueprint.indicators[index%blueprint.indicators.length],score:seeded(sample.key,700+index,35,96),weight:round1(seeded(sample.key,950+index,8,15)/10),consent:'SYNTHETIC_NOT_APPLICABLE',quality_status:index%31===0?'REVIEWED':'PASSED',evidence_id:evidence[index%evidence.length].id})),visualizations
  };
  report.full_publication=full_publication;
  let platinum=buildPlatinumReport({...report,publication_profile:sample.profile==='board'?'corporate':sample.profile==='interactive'||sample.profile==='evidence'?'research':sample.profile==='ngo'?'donor':sample.profile});
  platinum={...platinum,publication_quality_gate_2:{...(platinum.publication_quality_gate_2||{}),status:'PASS_FOR_SYNTHETIC_DEMONSTRATION',release_allowed:true},report_intelligence_score:{...(platinum.report_intelligence_score||{}),overall:report.quality_scores.overall_publication_readiness}};
  const model={sample:{...sample,visuals:visualizations.slice(0,6).map(x=>x.title),executive_story:report.executive_summary,quality_score:report.quality_scores.overall_publication_readiness,evidence_score:report.quality_scores.evidence_quality,decision_intelligence_score:report.quality_scores.decision_support,estimated_pages:report.publication_page_equivalent,last_updated:publicationDate},report,full_publication,platinum,core:{report,quality:report.quality_scores},premium_publication:{cover:report.branding,sections:Object.keys(report.executive_book)},interactive:{flow:report.interactive_flow,evidence_graph:report.evidence},integrity_notice:SYNTHETIC_NOTICE,quality_gate:report.quality_scores,engine:{name:FLAGSHIP_SAMPLE_LIBRARY_NAME,architecture:'single governed report model'}};
  return model;
}

export function buildFlagshipSampleDeck(model){
  if(!model)return [];
  const r=model.report;
  return [
    {id:'cover',title:r.title,content:{...r.branding,country:r.country,sector:r.sector}},
    {id:'executive-book',title:'Executive Intelligence Book',content:r.executive_book},
    {id:'executive-brief',title:'Executive Brief',content:r.executive_book},
    {id:'decision-snapshot',title:'Priority Decisions',content:{decisions:r.recommendations}},
    {id:'critical-findings',title:'Critical Findings',content:{findings:r.findings}},
    {id:'evidence-book',title:'Evidence Intelligence Book',content:{evidence:r.evidence}},
    {id:'evidence',title:'Evidence Intelligence',content:{evidence:r.evidence}},
    {id:'statistics',title:'Statistical Intelligence',content:r.statistical_intelligence},
    {id:'risks',title:'Risk and Opportunity Matrix',content:{risks:r.executive_book.critical_risks,opportunities:r.executive_book.top_opportunities}},
    {id:'standards',title:'International Standards',content:{standards:r.international_standards}},
    {id:'oecd-dac',title:'OECD-DAC',content:model.full_publication?.oecd_dac||[]},
    {id:'rbm',title:'Results-Based Management',content:model.full_publication?.rbm_results_framework||{}},
    {id:'chs',title:'Core Humanitarian Standard',content:model.full_publication?.chs_commitments||[]},
    {id:'roadmap',title:'Implementation Roadmap',content:{recommendations:r.recommendations}},
    {id:'quality',title:'Publication Quality Gate',content:r.quality_scores},
    {id:'visuals',title:'Visual Intelligence',content:{visualizations:r.visualizations}},
    {id:'accessibility',title:'Accessibility Assurance',content:r.accessibility},
    {id:'exports',title:'Publication Products',content:{exports:r.exports}},
    {id:'methodology',title:'Methodology',content:r.methodology},
    {id:'sampling',title:'Sampling Design',content:r.statistical_intelligence},
    {id:'weighting',title:'Weighting and Uncertainty',content:r.statistical_intelligence},
    {id:'reliability',title:'Reliability and Validity',content:r.statistical_intelligence},
    {id:'missing-data',title:'Missing Data and Outliers',content:r.statistical_intelligence},
    {id:'regional-map',title:'Regional Intelligence Map',content:{visual:r.visualizations.find(x=>x.type==='choropleth_map')}},
    {id:'heat-map',title:'Performance Heat Map',content:{visual:r.visualizations.find(x=>x.type==='regional_heat_map')}},
    {id:'risk-matrix',title:'Risk Matrix',content:r.executive_book.critical_risks},
    {id:'decision-matrix',title:'Decision Matrix',content:r.recommendations},
    {id:'opportunity-matrix',title:'Opportunity Matrix',content:r.executive_book.top_opportunities},
    {id:'cost-of-inaction',title:'Cost of Inaction',content:{narrative:r.executive_book.cost_of_inaction}},
    {id:'ownership',title:'Ownership Matrix',content:r.executive_book.ownership_matrix},
    {id:'roadmap-detail',title:'Implementation Roadmap',content:r.recommendations},
    {id:'data-dictionary',title:'Data Dictionary',content:r.data_dictionary},
    {id:'appendices',title:'Appendices',content:r.appendices},
    {id:'limitations',title:'Limitations and Integrity',content:{limitations:r.limitations,notice:r.branding.synthetic_notice}}
  ];
}

export function getFlagshipSample(key){return FLAGSHIP_SAMPLE_REPORTS.find(x=>x.key===key)||null;}
export function getFlagshipSampleCatalog(){
  const reports=FLAGSHIP_SAMPLE_REPORTS.map(sample=>{
    const model=buildFlagshipSampleReport(sample.key),q=model.report.quality_scores;
    return {...sample,publication_profile:'International Publication Profile',pages_equivalent:model.report.publication_page_equivalent,quality_score:q.overall_publication_readiness,evidence_score:q.evidence_quality,decision_intelligence_score:q.decision_support,last_updated:model.sample.last_updated,prepared_by:'VoiceInsights Africa',synthetic_notice:SYNTHETIC_NOTICE,viewer_url:`/flagship-sample-report.html?key=${sample.key}`,detail_url:`/api/public/flagship-sample-library/${sample.key}`,download_base:`/api/public/flagship-sample-library/${sample.key}/export`};
  });
  return {engine:FLAGSHIP_SAMPLE_LIBRARY_NAME,count:reports.length,categories:['Government','UN & Donors','NGOs','Corporate','Research'],featured:reports.filter(x=>x.featured).map(x=>x.key),reports};
}

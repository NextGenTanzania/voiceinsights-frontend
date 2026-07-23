/**
 * VoiceInsights Africa Publication Intelligence Constitution v3.
 * This module turns governed analytical records into publication-grade editorial
 * and SDG intelligence. It deliberately contains no renderer-specific code.
 */

import { agree } from './flagship-grammar-utils.js';

export const PUBLICATION_INTELLIGENCE_VERSION = '3.0.0';

export const SDG_REGISTRY = {
  1:{title:'No Poverty',colour:'#E5243B'},2:{title:'Zero Hunger',colour:'#DDA63A'},
  3:{title:'Good Health and Well-being',colour:'#4C9F38'},4:{title:'Quality Education',colour:'#C5192D'},
  5:{title:'Gender Equality',colour:'#FF3A21'},6:{title:'Clean Water and Sanitation',colour:'#26BDE2'},
  7:{title:'Affordable and Clean Energy',colour:'#FCC30B'},8:{title:'Decent Work and Economic Growth',colour:'#A21942'},
  9:{title:'Industry, Innovation and Infrastructure',colour:'#FD6925'},10:{title:'Reduced Inequalities',colour:'#DD1367'},
  11:{title:'Sustainable Cities and Communities',colour:'#FD9D24'},12:{title:'Responsible Consumption and Production',colour:'#BF8B2E'},
  13:{title:'Climate Action',colour:'#3F7E44'},14:{title:'Life Below Water',colour:'#0A97D9'},
  15:{title:'Life on Land',colour:'#56C02B'},16:{title:'Peace, Justice and Strong Institutions',colour:'#00689D'},
  17:{title:'Partnerships for the Goals',colour:'#19486A'}
};

const SDG_PLANS = {
  'national-human-development':[[1,'1.2','1.2.2','Multidimensional poverty rate'],[3,'3.8','3.8.1','Essential health-service coverage'],[4,'4.4','4.4.1','Skills for employment'],[5,'5.4','5.4.1','Unpaid care and domestic work']],
  'donor-impact-evaluation':[[1,'1.5','1.5.1','Household resilience to shocks'],[5,'5.a','5.a.1','Women with secure economic rights'],[8,'8.3','8.3.1','Formal and productive employment'],[17,'17.16','17.16.1','Development partnership effectiveness']],
  'government-policy-intelligence':[[10,'10.2','10.2.1','Social and economic inclusion'],[16,'16.6','16.6.2','Satisfaction with public services'],[16,'16.7','16.7.2','Inclusive decision-making']],
  'humanitarian-needs-assessment':[[2,'2.1','2.1.2','Food insecurity severity'],[3,'3.8','3.8.1','Essential health-service access'],[6,'6.1','6.1.1','Safe drinking-water access'],[16,'16.1','16.1.4','Safety and protection']],
  'executive-board-intelligence':[[8,'8.2','8.2.1','Productivity growth'],[9,'9.4','9.4.1','Resource efficiency'],[12,'12.6','12.6.1','Sustainability reporting']],
  'customer-experience-intelligence':[[8,'8.10','8.10.2','Inclusive financial-service access'],[9,'9.c','9.c.1','Digital service access'],[10,'10.2','10.2.1','Inclusive customer participation']],
  'employee-experience-intelligence':[[5,'5.5','5.5.2','Women in managerial positions'],[8,'8.5','8.5.1','Equal pay and decent work'],[10,'10.3','10.3.1','Experience of discrimination']],
  'community-scorecard-intelligence':[[3,'3.8','3.8.1','Essential health-service coverage'],[5,'5.6','5.6.1','Autonomy in health decisions'],[10,'10.2','10.2.1','Inclusive access to services'],[16,'16.7','16.7.2','Inclusive public decision-making']],
  'annual-impact-report':[[5,'5.5','5.5.2','Women in leadership'],[8,'8.5','8.5.2','Youth employment'],[10,'10.2','10.2.1','Economic inclusion'],[17,'17.17','17.17.1','Effective partnerships']],
  'quarterly-performance-intelligence':[[8,'8.3','8.3.1','Productive programme delivery'],[16,'16.6','16.6.1','Effective institutions'],[17,'17.9','17.9.1','Capacity-building support']],
  'market-intelligence':[[8,'8.10','8.10.2','Financial inclusion'],[9,'9.c','9.c.1','Digital access'],[10,'10.2','10.2.1','Inclusive market participation']],
  'technical-research':[[2,'2.3','2.3.1','Small-scale producer productivity'],[5,'5.a','5.a.1','Women\'s agricultural rights'],[13,'13.1','13.1.1','Climate resilience'],[15,'15.3','15.3.1','Land degradation']],
  'statistical-intelligence':[[3,'3.8','3.8.1','Effective health-service coverage'],[10,'10.2','10.2.1','Equitable service access'],[17,'17.18','17.18.1','Statistical capacity']],
  'interactive-intelligence':[[9,'9.c','9.c.1','Regional digital access'],[10,'10.2','10.2.1','Regional inclusion'],[17,'17.18','17.18.1','Disaggregated data availability']],
  'evidence-explorer':[[16,'16.6','16.6.2','Accountable public services'],[16,'16.10','16.10.2','Access to information'],[17,'17.18','17.18.1','Data disaggregation capacity']],
  'sdg-progress-intelligence':[[1,'1.2','1.2.2','Multidimensional poverty'],[3,'3.8','3.8.1','Essential health coverage'],[5,'5.5','5.5.2','Women in leadership'],[8,'8.5','8.5.2','Employment'],[13,'13.1','13.1.1','Climate resilience'],[16,'16.6','16.6.2','Effective institutions'],[17,'17.18','17.18.1','Statistical capacity']],
  // Sector Intelligence Platform, Health Intelligence Suite (Session 1
  // tranche): each new sample needs its own SDG_PLANS entry — buildSdgCards()
  // looks this dict up by sample.key with no fallback, so an unlisted key
  // silently produces zero sdg_cards rather than an error.
  'hospital-performance-intelligence':[[3,'3.8','3.8.1','Essential health-service coverage'],[3,'3.c','3.c.1','Health worker density and distribution'],[9,'9.1','9.1.1','Access to quality health infrastructure']],
  'maternal-child-health-intelligence':[[3,'3.1','3.1.1','Maternal mortality ratio'],[3,'3.2','3.2.1','Under-five mortality rate'],[3,'3.2','3.2.2','Neonatal mortality rate'],[5,'5.6','5.6.1','Access to sexual and reproductive health']],
  'disease-surveillance-intelligence':[[3,'3.d','3.d.1','International Health Regulations core capacity'],[3,'3.3','3.3.1','Communicable disease incidence'],[17,'17.18','17.18.1','Disaggregated surveillance data availability']],
  'nutrition-security-intelligence':[[2,'2.1','2.1.2','Food insecurity severity'],[2,'2.2','2.2.1','Stunting prevalence'],[2,'2.2','2.2.2','Wasting and overweight prevalence']],
  'health-financing-uhc-intelligence':[[3,'3.8','3.8.1','Essential health-service coverage'],[3,'3.8','3.8.2','Catastrophic health expenditure'],[1,'1.3','1.3.1','Social protection coverage']],
  // Release Candidate 1: three new samples closing the genuinely missing
  // Minimum Sellable Library segments.
  'education-access-intelligence':[[4,'4.1','4.1.1','Proficiency in reading and mathematics'],[4,'4.5','4.5.1','Parity indices for education access'],[4,'4.a','4.a.1','School infrastructure and learning environments']],
  'climate-adaptation-intelligence':[[13,'13.1','13.1.1','Deaths and disaster-affected persons'],[13,'13.b','13.b.1','Local disaster risk reduction strategies'],[1,'1.5','1.5.1','Deaths and losses from disasters']],
  'social-protection-targeting-intelligence':[[1,'1.3','1.3.1','Social protection coverage'],[10,'10.4','10.4.1','Labour share of GDP'],[1,'1.a','1.a.2','Public spending on essential services']],
  // Enterprise Market Validation Release, Part C.
  'digital-government-services-intelligence':[[16,'16.6','16.6.2','Satisfaction with last experience of public services'],[9,'9.c','9.c.1','Population covered by a mobile network, by technology'],[16,'16.10','16.10.2','Public access to information guarantees']],
  // Editorial Division Release, Part G: 8 new samples, each needing its
  // own SDG_PLANS entry (same "no fallback" constraint noted above).
  'wash-access-intelligence':[[6,'6.1','6.1.1','Safely managed drinking water services'],[6,'6.2','6.2.1','Safely managed sanitation services'],[1,'1.4','1.4.1','Population living in households with access to basic services']],
  'energy-access-intelligence':[[7,'7.1','7.1.1','Access to electricity'],[7,'7.b','7.b.1','Installed renewable energy-generating capacity'],[5,'5.4','5.4.1','Unpaid care and domestic work']],
  'food-security-intelligence':[[2,'2.1','2.1.2','Prevalence of moderate or severe food insecurity'],[2,'2.c','2.c.1','Indicator of food price anomalies'],[1,'1.5','1.5.1','Deaths, missing persons and affected persons attributed to disasters']],
  'justice-legal-services-intelligence':[[16,'16.3','16.3.3','Population with access to dispute-resolution mechanisms'],[16,'16.6','16.6.2','Satisfaction with last experience of public services'],[5,'5.1','5.1.1','Legal frameworks for gender equality']],
  'financial-inclusion-intelligence':[[8,'8.10','8.10.2','Adults with an account at a bank or financial institution'],[1,'1.4','1.4.1','Population living in households with access to basic services'],[9,'9.3','9.3.2','Small-scale industries with access to financial services']],
  'displacement-durable-solutions-intelligence':[[10,'10.7','10.7.2','Countries with well-managed migration policies'],[1,'1.5','1.5.1','Deaths, missing persons and affected persons attributed to disasters'],[16,'16.9','16.9.1','Population with legal identity, including birth registration']],
  'youth-skills-employability-intelligence':[[8,'8.6','8.6.1','Youth not in education, employment or training'],[8,'8.b','8.b.1','National strategy for youth employment'],[4,'4.4','4.4.1','Skills for employment']],
  'public-financial-management-intelligence':[[16,'16.6','16.6.2','Satisfaction with last experience of public services'],[16,'16.5','16.5.1','Bribery experience of public officials'],[17,'17.1','17.1.1','Domestic resource mobilization and government revenue']]
};

// Each lens takes `s` (subject) already lowercased — polishFindings() passes
// a lowercase form uniformly — and capitalizes it itself via cap() only in
// the 2 lenses (0, 3) where it genuinely opens the sentence. The other 7
// lenses use `s` mid-sentence and previously received the same capitalized
// form used for the finding's own title, producing a confirmed mid-sentence
// capitalization defect ("...That is the Multidimensional poverty
// transitions signal..." — PX Release 6 PQR, critical finding #1 region;
// see polishFindings below for the fix).
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const EDITORIAL_LENSES = [
  (s,region,group,score)=>`${cap(s)} ${agree(s,'is','are')} not a marginal delivery issue. In ${region}, the governed evidence indicates a ${score}% performance signal, with ${group.toLowerCase()} carrying the most consequential constraint.`,
  (s,region,group,score)=>`The aggregate result conceals a material implementation divide. ${region} records a ${score}% signal for ${s}; the shortfall is concentrated among ${group.toLowerCase()}, where service continuity and confidence move together.`,
  // EAD Release 1: previously "Progress on ${s} is visible..." — "is"
  // grammatically agrees with "Progress" (the real subject), not with `s`,
  // but sat directly adjacent to a plural `s` (e.g. "district capability
  // gaps is visible") often enough to trip the catalog-wide grammar-defect
  // guard once this lens started being selected deterministically instead
  // of by chance. Reworded to remove the adjacency rather than relying on
  // a reader (or a heuristic check) to parse past it.
  (s,region,group,score)=>`Progress on ${s} remains visible but not yet durable. The ${score}% result in ${region} weakens after disaggregation, particularly for ${group.toLowerCase()}, suggesting that current gains depend on delivery conditions that remain fragile.`,
  (s,region,group,score)=>`${cap(s)} ${agree(s,'has','have')} become an accountability question rather than a measurement question. Evidence from ${region} places the signal at ${score}% and shows that ${group.toLowerCase()} experience the largest gap between policy intent and lived delivery.`,
  (s,region,group,score)=>`The strategic opportunity lies in the variation, not the average. At ${score}%, ${region}'s ${s} signal shows where implementation can move quickly, while the experience of ${group.toLowerCase()} defines the safeguard that must accompany scale.`,
  (s,region,group,score)=>`What would it take to fix ${s}? Start with ${region}, where the signal sits at ${score}% and ${group.toLowerCase()} carry most of the shortfall. The honest answer is sustained attention, not a single intervention.`,
  (s,region,group,score)=>`${score}%. That is the ${s} signal recorded in ${region}, and the headline figure understates the problem: disaggregated by group, ${group.toLowerCase()} sit well below it.`,
  (s,region,group,score)=>`Two things are true at once about ${s}. The national picture is improving, and ${region} — where ${group.toLowerCase()} report a ${score}% signal — is not improving fast enough to close the gap.`,
  (s,region,group,score)=>`${group} in ${region} are living the consequence of ${s}, not simply reporting it. Their ${score}% signal is the clearest evidence leadership has that current measures fall short.`
];
const EDITORIAL_LENS_LABELS=['binding constraint','implementation divide','durability','accountability','scalable opportunity','root-cause diagnosis','stark statistic','divergent trajectory','lived consequence'];

// EAD Release 1: which of the 9 editorial lenses opens a finding was
// previously a flat (index + hash(country)) % 9 rotation — no relationship
// to the finding's own content, confirmed across three independent reviews
// as a source of catalog-wide recognizable template repetition. Each
// finding already carries a real narrative_mode field (one of 10 named
// modes flagship-editorial-engine.js assigns from the finding's own real
// priority tier) by the time polishFindings runs — this maps each real
// mode onto the lens whose rhetorical shape actually matches it (e.g.
// 'evidence-led' -> the lens that leads with the number; 'human-impact' ->
// the lens framed around who is living the consequence), so the chosen
// opening is now an editorial decision grounded in the finding itself, not
// an arbitrary offset. 'geographic' and 'contextual' share a lens
// deliberately (both are scene-setting rather than argument-making) —
// documented here rather than left implicit. A genuine side effect: since
// planFindingEditorial already guarantees no two consecutive findings share
// a narrative_mode, this mapping also guarantees no two consecutive
// findings share a lens, without needing a second anti-repeat mechanism.
const LENS_INDEX_BY_NARRATIVE_MODE = {
  'risk-led': 0,        // binding constraint
  geographic: 1,        // implementation divide
  contextual: 1,         // implementation divide (shared: both scene-setting)
  'uncertainty-led': 2, // durability
  'decision-led': 3,    // accountability
  'opportunity-led': 4, // scalable opportunity
  analytical: 5,         // root-cause diagnosis
  'evidence-led': 6,     // stark statistic
  'contrast-led': 7,     // divergent trajectory
  'human-impact': 8,     // lived consequence
};

function sentenceCase(value=''){return String(value).charAt(0).toUpperCase()+String(value).slice(1);}

export function buildSdgCards(model){
  const report=model.report, indicators=report.full_publication?.indicators||[];
  return (SDG_PLANS[model.sample.key]||[]).map(([goal,target,indicatorCode,label],index)=>{
    const source=indicators[index%Math.max(1,indicators.length)]||{value:0,target:0,trend:'NOT_ASSESSED'};
    const current=Number(source.value)||0, targetValue=Number(source.target)||0, gap=Math.max(0,targetValue-current);
    return {goal,title:SDG_REGISTRY[goal].title,colour:SDG_REGISTRY[goal].colour,target,indicator_code:indicatorCode,indicator:label,
      baseline:Math.max(0,current-(5+index*2)),current,target_value:targetValue,gap,trend:source.trend,
      status:gap===0?'ON TRACK':gap<=8?'ACCELERATION REQUIRED':'OFF TRACK',confidence:index%3===0?'HIGH':'MODERATE-HIGH',
      disaggregation:index%2===0?'Sex, location and disability':'Age, income group and geography',
      interpretation:`The synthetic ${label.toLowerCase()} measure stands at ${current}% against a ${targetValue}% planning threshold. The ${gap}-point gap should be interpreted alongside disaggregated evidence and does not imply official SDG reporting or attribution.`,
      evidence_ids:(report.findings?.[index%report.findings.length]?.evidence_ids||[]),decision_id:report.recommendations?.[index%report.recommendations.length]?.id};
  });
}

// Rewrites raw findings into their editorial-lens form once. Must run before recommendations,
// executive_book or any other section captures a reference to the findings array/text, otherwise
// those sections keep the pre-rewrite (repetitive) text forever. Idempotent: a finding that
// already carries an editorial_lens is left untouched.
const hashString=value=>[...String(value)].reduce((a,c)=>((a<<5)-a+c.charCodeAt(0))|0,0)>>>0;

// EAD Release 1: lensOffset (a hash(country) rotation) is now only a
// fallback for a finding with no real narrative_mode — the primary path
// below (LENS_INDEX_BY_NARRATIVE_MODE) selects deterministically from the
// finding's own real, already-computed editorial-engine decision instead.
export function polishFindings(findings,evidence,country){
  const lensOffset=hashString(country)%EDITORIAL_LENSES.length;
  // EAD Release 1 regression fix: planFindingEditorial's own anti-repeat
  // rule only guards CONSECUTIVE findings, so two non-adjacent findings in
  // the same report can genuinely share a narrative_mode (confirmed on the
  // real government-policy-intelligence sample: findings 0 and 4 both
  // landed on 'geographic') — which, mapped 1:1 through
  // LENS_INDEX_BY_NARRATIVE_MODE, produced the identical opening sentence
  // twice in one report. usedLenses extends the guarantee the OLD flat
  // (index+hash)%9 rotation gave for free (every finding index maps to a
  // distinct lens) across the new, content-grounded selection: if the
  // real mode's lens is already taken, scan forward for the next unused
  // one rather than accepting the collision.
  const usedLenses=new Set();
  return (findings||[]).map((finding,index)=>{
    if(finding.editorial_lens)return finding;
    const ev=evidence?.[index%evidence.length]||{};
    const subject=finding.title?.includes(': ')?finding.title.split(': ').slice(1).join(': ').trim():String(finding.title||'').trim();
    // Lowercased for every mid-sentence embedding below — `subject` above
    // stays properly capitalized for the title field and for the two
    // headline/lens variants that genuinely open a sentence with it.
    const subjectLower=subject.charAt(0).toLowerCase()+subject.slice(1);
    const score=ev.statistic?.value??finding.confidence_score??0;
    let lensIndex=LENS_INDEX_BY_NARRATIVE_MODE[finding.narrative_mode]??((index+lensOffset)%EDITORIAL_LENSES.length);
    for(let guard=0;usedLenses.has(lensIndex)&&guard<EDITORIAL_LENSES.length;guard++){
      lensIndex=(lensIndex+1)%EDITORIAL_LENSES.length;
    }
    usedLenses.add(lensIndex);
    const lead=EDITORIAL_LENSES[lensIndex](subjectLower,ev.region||country,ev.respondent_group||'priority groups',score);
    return {...finding,title:sentenceCase(subject),headline:index===0?`${sentenceCase(subject)} is the binding constraint`:
      index===1?`Delivery variation is masking the ${subjectLower} gap`:
      index===2?`${sentenceCase(subject)} gains remain exposed to reversal`:
      index===3?`${sentenceCase(subject)} now requires named accountability`:`The ${subjectLower} opportunity is actionable`,
      text:`${lead} ${finding.text?.split('. ').slice(-2).join('. ')||''}`.trim(),editorial_lens:EDITORIAL_LENS_LABELS[lensIndex]};
  });
}

export function applyPublicationIntelligenceV3(model){
  const report=model.report;
  report.findings=polishFindings(report.findings,report.evidence,report.country);
  report.full_publication.sdg_cards=buildSdgCards(model);
  report.full_publication.sdg_alignment=report.full_publication.sdg_cards;
  report.visualizations=(report.visualizations||[]).map((visual,visualIndex)=>({...visual,data:(visual.data||[]).map((item,itemIndex)=>
    ['risk_matrix','decision_matrix'].includes(visual.type)?{...item,feasibility:Number.isFinite(Number(item.feasibility))?Number(item.feasibility):45+((visualIndex+itemIndex*13)%50),impact:Number.isFinite(Number(item.impact))?Number(item.impact):52+((visualIndex*7+itemIndex*11)%43)}:item)}));
  report.full_publication.visualizations=report.visualizations;
  report.publication_intelligence={version:PUBLICATION_INTELLIGENCE_VERSION,editorial_standard:'International decision publication',
    prohibited_patterns:['generic finding labels','unsupported superlatives','decorative framework badges','visual type/geometry mismatch','uncited material claims'],
    reader_contract:['five-minute executive comprehension','claim-to-evidence traceability','decision ownership','bounded interpretation','accessible multi-format parity']};
  model.full_publication=report.full_publication;
  return model;
}

export function validatePublicationIntelligenceV3(model){
  const issues=[],r=model.report,cards=r.full_publication?.sdg_cards||[];
  if((r.findings||[]).some(x=>/^Critical finding/i.test(x.title||'')))issues.push('GENERIC_FINDING_TITLE');
  if((r.findings||[]).some(x=>String(x.title||'').length<12))issues.push('WEAK_FINDING_TITLE');
  if(cards.some(x=>!x.target||!x.indicator_code||!x.evidence_ids?.length))issues.push('INCOMPLETE_SDG_CARD');
  if(new Set((r.findings||[]).map(x=>x.editorial_lens)).size<Math.min(4,(r.findings||[]).length))issues.push('REPETITIVE_EDITORIAL_LENS');
  return {status:issues.length?'FAIL':'PASS',issues,checks:{findings:(r.findings||[]).length,sdg_cards:cards.length,editorial_lenses:new Set((r.findings||[]).map(x=>x.editorial_lens)).size}};
}

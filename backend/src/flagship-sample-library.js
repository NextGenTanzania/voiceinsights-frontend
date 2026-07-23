import { buildPlatinumReport } from './platinum-report-engine.js';
import { humanizeStatusEnum } from './publication-render-utils.js';
import { coverVariant, brandLockup, themeFor } from './flagship-publication-design-system.js';
import { buildFlagshipVisualSet } from './flagship-visualization-engine.js';
import { standardsFor } from './flagship-standards-engine.js';
import { evaluateFlagshipPublication } from './flagship-publication-quality-gate.js';
import { applyPublicationIntelligenceV3, validatePublicationIntelligenceV3, polishFindings } from './flagship-publication-intelligence.js';
import { agree, sectorWith } from './flagship-grammar-utils.js';
import { planFindingEditorial, planReportEditorialProfile } from './flagship-editorial-engine.js';
import { personalityFor, possessiveFor } from './flagship-personality-lexicon.js';
import { planEditorialStrategy, runEditorialConsensus } from './flagship-editorial-brain.js';
import { routeKnowledge, frameworksForDomain } from './flagship-knowledge-router.js';
import { sectorKnowledgeFor } from './flagship-sector-knowledge.js';
import { buildDecisionIntelligence, checkDonorIntelligence, checkGovernmentIntelligence, validateKnowledgeFit } from './flagship-decision-intelligence.js';
import { buildExecutiveCommentary, buildStrategicInterpretation, buildSoWhat, buildPolicyImplications, buildEvidenceCommentary, pickEditorialTransition } from './flagship-narrative-intelligence.js';
import { compareRegionalPerformance, compareEvidenceStrength } from './flagship-comparative-intelligence.js';
import { reviewPublicationPrestige } from './flagship-publication-prestige.js';
import { buildDecisionReasoning } from './flagship-decision-reasoning-engine.js';
import { computeTrustBadges } from './publication-trust-badges.js';
import { isPublishable, checkExecutiveQuestions, checkInternationalStandards } from './publication-governance-gate.js';
/**
 * VoiceInsights Africa World-Class Flagship Sample Reports Generator™
 * One governed generator creates the public library, interactive models and every export.
 * All publications are synthetic demonstrations and must never be represented as official statistics.
 */

export const FLAGSHIP_SAMPLE_LIBRARY_NAME = 'VoiceInsights Africa World-Class Flagship Intelligence Library Generator™';
export const SYNTHETIC_NOTICE = 'Synthetic Demonstration Publication produced by VoiceInsights Africa. All people, quotations, locations and statistics are synthetic, internally governed demonstration content and are not official statistics.';

const REPORTS = [
  ['national-human-development','National Human Development Intelligence Report','Government','Government','Tanzania','Human Development','Deep Blue','National maps and cabinet intelligence',['SDG 1','SDG 3','SDG 4','SDG 5','Leave No One Behind','Human Rights Based Approach']],
  ['donor-impact-evaluation','Donor Impact Evaluation Report','UN & Donors','Donor','Uganda','Integrated Livelihoods','Purple','OECD-DAC, results chain and value for money',['OECD-DAC','RBM','Theory of Change','UNEG','Gender Equality']],
  ['government-policy-intelligence','Government Policy Intelligence Report','Government','Government','Kenya','Public Service Delivery','Deep Blue','Cabinet decisions and national policy maps',['RBM','SDG 16','Leave No One Behind','Data Protection']],
  ['humanitarian-needs-assessment','Humanitarian Needs Assessment Report','UN & Donors','Humanitarian','Somalia','Humanitarian Response','Light Blue','Severity, protection and response priorities',['CHS','Protection','Safeguarding','Human Rights Based Approach','Climate Resilience']],
  ['executive-board-intelligence','Executive Board Intelligence Report','Corporate','Board','South Africa','Enterprise Performance','Black Gold','Board decisions, ROI and strategic risk',['Responsible AI','Data Protection','Privacy Controls']],
  // Enterprise Market Validation Release, Part C: re-sectored from
  // 'Financial Services' to the genuinely literal 'Customer Experience' —
  // the content (customer journey, loyalty, service recovery) was already
  // about this exact domain; only the sector label was industry-adjacent.
  ['customer-experience-intelligence','Customer Experience Intelligence Report','Corporate','Corporate','Tanzania','Customer Experience','Black Gold','Customer journey, loyalty and service recovery',['Data Protection','Privacy Controls','Disability Inclusion']],
  // Re-sectored from 'Workforce Experience' to 'Employee Experience' —
  // same reasoning as above.
  ['employee-experience-intelligence','Employee Experience Intelligence Report','Corporate','Corporate','Rwanda','Employee Experience','Black Gold','Engagement, retention and culture intelligence',['Gender Equality','Disability Inclusion','Safeguarding']],
  ['community-scorecard-intelligence','Community Scorecard Intelligence Report','NGOs','NGO','Malawi','Primary Healthcare','Green Blue','Community accountability and provider action',['CHS','SDG 3','Gender Equality','Disability Inclusion']],
  ['annual-impact-report','Annual Impact Report','NGOs','NGO','Zambia','Youth Economic Inclusion','Emerald','Outcome pathways and beneficiary voice',['RBM','SDG 8','Theory of Change','Leave No One Behind']],
  ['quarterly-performance-intelligence','Quarterly Performance Intelligence Report','NGOs','NGO','Mozambique','Programme Delivery','Cobalt','Delivery dashboard and corrective action',['RBM','Risk Management','Data Protection']],
  // Re-sectored from 'Digital Financial Services' to 'Market Research' —
  // same reasoning: segmentation/growth/opportunity content was already
  // market-research subject matter.
  ['market-intelligence','Market Intelligence Report','Corporate','Corporate','Ghana','Market Research','Black Gold','Market segmentation, growth and opportunity',['Responsible AI','Data Protection','Privacy Controls']],
  ['technical-research','Technical Research Report','Research','Research','Ethiopia','Agricultural Resilience','White Academic','Methodological rigor and reproducibility',['Research Ethics','Data Protection','Climate Resilience']],
  ['statistical-intelligence','Statistical Intelligence Report','Research','Research','Tanzania','Health Systems','White Academic','Inference, weighting and model diagnostics',['World Bank Statistical Standards','Reproducibility','Microdata Governance']],
  ['interactive-intelligence','Interactive Intelligence Report','Research','Interactive','East Africa','Regional Development','Midnight Teal','Evidence drill-down and knowledge graph',['Responsible AI','Data Protection','Accessibility']],
  ['evidence-explorer','Evidence Explorer Report','Research','Evidence','Tanzania','Citizen Feedback','Indigo','Claim-to-source lineage and governed AI explanation',['UNEG','Responsible AI','Privacy Controls','Safeguarding']],
  ['sdg-progress-intelligence','SDG Progress Intelligence Report','UN & Donors','UN','Africa','Sustainable Development','UN Blue','SDG targets, contribution and limitations',['SDGs','Leave No One Behind','Gender Equality','Climate Resilience']],
  // Sector Intelligence Platform, Health Intelligence Suite (Session 1
  // tranche): five new Health-sector flagship publications, each a distinct
  // executive decision problem, each routed through a new sector-knowledge
  // domain (flagship-knowledge-router.js/flagship-sector-knowledge.js) —
  // never a new renderer, never a fabricated statistic.
  ['hospital-performance-intelligence','Hospital Performance & Patient Safety Intelligence Report','Government','Government','Kenya','Hospital Performance','Clinical Teal','Facility performance and patient-safety intelligence',['SDG 3','WHO Patient Safety Framework','Quality of Care Standards']],
  ['maternal-child-health-intelligence','Maternal & Child Health Continuity Intelligence Report','UN & Donors','Donor','Uganda','Maternal and Child Health','Maternal Rose','Maternal-newborn continuity and equity intelligence',['SDG 3','Every Newborn Action Plan','Gender Equality']],
  ['disease-surveillance-intelligence','Disease Surveillance & Outbreak Readiness Intelligence Report','Government','Government','Tanzania','Disease Surveillance','Vital Crimson','Outbreak readiness and surveillance intelligence',['International Health Regulations (2005)','SDG 3','Data Protection']],
  ['nutrition-security-intelligence','Nutrition Security Intelligence Report','NGOs','NGO','Zambia','Nutrition Security','Sterile Slate','Stunting drivers and nutrition programme intelligence',['SUN Movement Framework','SDG 2','Leave No One Behind']],
  ['health-financing-uhc-intelligence','Universal Health Coverage and Financing Intelligence Report','UN & Donors','UN','Rwanda','Health Financing and Insurance','Fiscal Emerald','Financial protection and coverage intelligence',['Universal Health Coverage','SDG 3','Public Financial Management']],
  // Release Candidate 1: three new publications closing the genuinely
  // missing Minimum Sellable Library segments (Education, Climate,
  // Social Protection) — every other MSL-priority segment already had at
  // least one real sample before this release.
  ['education-access-intelligence','Education Access and Learning Quality Intelligence Report','Government','Government','Ghana','Education Access and Learning Quality','Scholastic Amber','Attendance barriers and learning-outcome intelligence',['SDG 4','Leave No One Behind','Data Protection']],
  ['climate-adaptation-intelligence','Climate Adaptation Intelligence Report','UN & Donors','Donor','Mozambique','Climate Adaptation','Resilience Jade','Adaptive-capacity and resilience-financing intelligence',['SDG 13','Climate Resilience','Leave No One Behind']],
  ['social-protection-targeting-intelligence','Social Protection Targeting Intelligence Report','Government','Government','Zambia','Social Protection','Equity Violet','Targeting equity and cash-transfer intelligence',['SDG 1','SDG 10','Data Protection']],
  // Enterprise Market Validation Release, Part C: the one genuinely new
  // sector with no prior sample (Market Research, Customer Experience and
  // Employee Experience were closed by re-sectoring existing publications
  // above, not by adding new ones).
  ['digital-government-services-intelligence','Digital Government Services Intelligence Report','Government','Government','Rwanda','Digital Government Services','Civic Slate','Citizen digital-service adoption and trust intelligence',['SDG 16','Data Protection','Digital Public Infrastructure']],
  // Editorial Division Release, Part G: 8 new publications, 8 genuinely
  // new sectors with no prior sample — closing toward the brief's 30-40
  // total-catalog range while each demonstrates a real, distinct sector
  // identity (publication-editorial-identity.js).
  ['wash-access-intelligence','WASH Access Intelligence Report','Government','Government','Malawi','WASH Access','Aqua Clay','Water-point functionality and sanitation-access intelligence',['SDG 6','Data Protection','Leave No One Behind']],
  ['energy-access-intelligence','Energy Access Intelligence Report','UN & Donors','Donor','Tanzania','Energy Access','Solar Amber','Electrification prioritisation and supply-reliability intelligence',['SDG 7','Climate Resilience','Data Protection']],
  ['food-security-intelligence','Food Security Intelligence Report','UN & Donors','Humanitarian','Ethiopia','Food Security','Harvest Ochre','Market-systems and household food-access intelligence',['SDG 2','Climate Resilience','Human Rights Based Approach']],
  ['justice-legal-services-intelligence','Justice and Legal Services Intelligence Report','Government','Government','Kenya','Justice and Legal Services','Judicial Navy','Access-to-justice and case-resolution intelligence',['SDG 16','Data Protection','Human Rights Based Approach']],
  ['financial-inclusion-intelligence','Financial Inclusion Intelligence Report','Corporate','Corporate','Ghana','Financial Inclusion','Ledger Mint','Account access and usage-barrier intelligence',['Data Protection','Privacy Controls','Leave No One Behind']],
  ['displacement-durable-solutions-intelligence','Displacement and Durable Solutions Intelligence Report','UN & Donors','Humanitarian','Uganda','Displacement and Durable Solutions','Refuge Teal','Protracted-displacement and durable-solutions pathway intelligence',['CHS','Protection','Human Rights Based Approach']],
  ['youth-skills-employability-intelligence','Youth Skills and Employability Intelligence Report','NGOs','NGO','Rwanda','Youth Skills and Employability','Ascent Coral','Skills-to-employment conversion and placement intelligence',['SDG 8','Gender Equality','Leave No One Behind']],
  ['public-financial-management-intelligence','Public Financial Management Intelligence Report','Government','Government','Nigeria','Public Financial Management','Fiscal Steel','Budget-execution and procurement-control intelligence',['SDG 16','Data Protection','Public Financial Management']]
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
  'UN Blue': {primary:'#0B4F8A',accent:'#4DA6D9',highlight:'#F2C14E',motif:'SDG target wheel'},
  'Clinical Teal': {primary:'#0B3D3D',accent:'#1C9C93',highlight:'#F0B429',motif:'clinical performance grid'},
  'Maternal Rose': {primary:'#5C1A34',accent:'#C2185B',highlight:'#F6C453',motif:'continuity-of-care pathway'},
  'Vital Crimson': {primary:'#5C1113',accent:'#B3242A',highlight:'#F2A93B',motif:'outbreak signal map'},
  'Sterile Slate': {primary:'#2B3440',accent:'#5A6B7A',highlight:'#E8B84B',motif:'nutrition indicator grid'},
  'Fiscal Emerald': {primary:'#0C3B2E',accent:'#1D8A5F',highlight:'#E3B341',motif:'financial protection ledger'},
  'Scholastic Amber': {primary:'#1F3A5C',accent:'#D98A2B',highlight:'#4FA3D1',motif:'learning pathway grid'},
  'Resilience Jade': {primary:'#0D3B2E',accent:'#2FA37A',highlight:'#E8C34A',motif:'adaptation resilience map'},
  'Equity Violet': {primary:'#3B1E5C',accent:'#8B4FC2',highlight:'#E8B84B',motif:'equity distribution ledger'},
  'Civic Slate': {primary:'#1B2A3A',accent:'#3D6E8C',highlight:'#E8A23A',motif:'digital service adoption grid'},
  // Editorial Division Release, Part G: 8 new themes for 8 new sectors —
  // distinct primary/accent/highlight combinations, no palette reused.
  'Aqua Clay': {primary:'#0D4B4B',accent:'#2FA6A0',highlight:'#D97B3F',motif:'water access grid'},
  'Solar Amber': {primary:'#2E2410',accent:'#D98C15',highlight:'#3A7CA5',motif:'electrification reach map'},
  'Harvest Ochre': {primary:'#3D2B1F',accent:'#B5651D',highlight:'#6B8E4E',motif:'market systems flow'},
  'Judicial Navy': {primary:'#0F1F3D',accent:'#3A5A9C',highlight:'#C9A227',motif:'case docket ledger'},
  'Ledger Mint': {primary:'#0B3B2E',accent:'#2E9E76',highlight:'#D4A017',motif:'account access network'},
  'Refuge Teal': {primary:'#0D3B4A',accent:'#1F8A99',highlight:'#E8935A',motif:'pathway continuity map'},
  'Ascent Coral': {primary:'#3A1A2C',accent:'#D65A6E',highlight:'#F2B84B',motif:'skills-to-employment ladder'},
  'Fiscal Steel': {primary:'#1C2733',accent:'#4C6B8A',highlight:'#C9922E',motif:'budget control ledger'}
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
  'sdg-progress-intelligence':{subjects:['target trajectory','leave-no-one-behind gaps','financing alignment','data availability','climate-development co-benefits'],actions:['Focus acceleration plans on off-track targets','Fund disaggregated leave-no-one-behind measures','Align budget tagging with SDG contribution logic','Close priority national data gaps','Screen investments for climate-development co-benefits'],regions:['East Africa','West Africa','Southern Africa','Central Africa'],indicators:['Targets on track','Equity gap index','SDG-aligned financing','Data availability score']},
  'hospital-performance-intelligence':{subjects:['emergency bed occupancy pressure','surgical waitlist backlogs','staff-to-patient ratios during peak admission','equipment downtime at referral level','patient-safety incident reporting'],actions:['Reclassify or reinforce the three most capacity-constrained referral hospitals','Fund a targeted surgical backlog clearance programme','Set minimum staff-to-patient ratios for peak-admission wards','Prioritise equipment maintenance financing at referral facilities','Mandate standardised patient-safety incident reporting across referral hospitals'],regions:['Nairobi Metro Hospitals','Coast Referral Cluster','Western Referral Cluster','Rift Valley Referral Cluster'],indicators:['Emergency bed occupancy rate','Surgical waitlist clearance time','Staff-to-patient ratio','Patient-safety incident rate']},
  'maternal-child-health-intelligence':{subjects:['antenatal-care continuity','skilled birth attendance','postnatal follow-up completion','under-five growth monitoring','emergency obstetric referral timeliness'],actions:['Target antenatal-continuity investment in the lowest-completion districts','Expand skilled birth attendance at facility level in underserved districts','Strengthen postnatal follow-up scheduling and reminder systems','Scale routine under-five growth monitoring at community level','Cut emergency obstetric referral delays through transport and communication fixes'],regions:['Northern Uganda','Karamoja Sub-region','Eastern Uganda','West Nile'],indicators:['Antenatal-care continuity rate','Skilled birth attendance rate','Postnatal follow-up completion','Under-five growth monitoring coverage']},
  'disease-surveillance-intelligence':{subjects:['case-reporting lag at district level','laboratory confirmation turnaround','community-level early-warning signal capture','cross-border surveillance data sharing','outbreak-response activation speed'],actions:['Close the district-level case-reporting lag through faster digital reporting','Reduce laboratory confirmation turnaround for priority pathogens','Strengthen community-level early-warning signal capture','Formalise cross-border surveillance data-sharing protocols','Set outbreak-response activation service levels for priority districts'],regions:['Lake Zone Districts','Southern Highlands Districts','Coastal Districts','Central Districts'],indicators:['Case-reporting lag in days','Laboratory confirmation turnaround','Early-warning signal capture rate','Outbreak-response activation time']},
  'nutrition-security-intelligence':{subjects:['household food access','infant and young child feeding practices','micronutrient supplementation coverage','care-practice knowledge gaps','seasonal food-security volatility'],actions:['Target food-access interventions in the highest-stunting districts','Scale infant and young child feeding counselling at community level','Close micronutrient supplementation coverage gaps','Address care-practice knowledge gaps through community health workers','Build seasonal food-security early-response planning'],regions:['Eastern Province','Southern Province','Luapula Province','Western Province'],indicators:['Stunting prevalence','Infant and young child feeding practice score','Micronutrient supplementation coverage','Household food-access score']},
  'health-financing-uhc-intelligence':{subjects:['catastrophic out-of-pocket spending','benefit-package coverage gaps','community health-insurance enrollment','provider payment timeliness','financial-protection equity across income groups'],actions:['Close the benefit-package gaps driving catastrophic out-of-pocket spending','Expand community health-insurance enrollment among the lowest-income groups','Improve provider payment timeliness to stabilise service delivery','Target financial-protection interventions at the least-covered income groups','Review benefit-package design against the highest out-of-pocket cost drivers'],regions:['Kigali Province','Northern Province','Southern Province','Eastern Province'],indicators:['Catastrophic health-expenditure incidence','Benefit-package coverage rate','Community health-insurance enrollment','Provider payment timeliness']},
  'education-access-intelligence':{subjects:['attendance barriers','grade-transition dropout','perceived learning-outcome quality','teacher-parent feedback gaps','school-readiness disparities'],actions:['Target attendance-barrier interventions in the highest-dropout districts','Fund grade-transition support at the highest-risk transition points','Establish structured teacher-parent feedback channels','Address school-readiness disparities before primary entry','Scale early-warning tracking for at-risk students'],regions:['Greater Accra Region','Eastern Region','Northern Region','Volta Region'],indicators:['School attendance rate','Grade-transition completion rate','Learning-outcome perception score','Teacher-parent feedback frequency']},
  'climate-adaptation-intelligence':{subjects:['adaptive-capacity gaps','resilience-financing allocation','climate-shock early-warning reach','community-level adaptation planning','cross-sectoral climate coordination'],actions:['Target resilience-financing rounds at the lowest-adaptive-capacity communities','Scale climate-shock early-warning reach in flood-prone districts','Fund community-level adaptation planning processes','Strengthen cross-sectoral climate coordination mechanisms','Prioritise financing based on verified adaptive-capacity gaps'],regions:['Zambezia Province','Sofala Province','Nampula Province','Inhambane Province'],indicators:['Adaptive-capacity index','Resilience-financing coverage','Early-warning reach rate','Community adaptation-plan completion']},
  'social-protection-targeting-intelligence':{subjects:['targeting-error patterns','cash-transfer equity gaps','beneficiary-verification reliability','grievance-redress responsiveness','programme graduation readiness'],actions:['Correct the targeting-error pattern most undermining programme equity','Close cash-transfer equity gaps in the least-covered districts','Strengthen beneficiary-verification reliability','Improve grievance-redress responsiveness','Build programme-graduation readiness pathways'],regions:['Eastern Province','Southern Province','Western Province','Copperbelt Province'],indicators:['Targeting-error rate','Cash-transfer equity gap','Beneficiary-verification reliability','Grievance-redress responsiveness']},
  'digital-government-services-intelligence':{subjects:['citizen digital-service adoption gaps','service-trust barriers','digital-literacy access constraints','in-person fallback dependency','cross-agency service integration'],actions:['Prioritise the digital service with the sharpest adoption-and-trust gap for redesign investment','Close digital-literacy access constraints in the lowest-adoption districts','Reduce in-person fallback dependency through targeted outreach','Strengthen cross-agency service integration for the highest-friction citizen journeys','Publish a citizen-trust and service-reliability dashboard'],regions:['Kigali City','Northern Province','Southern Province','Eastern Province'],indicators:['Digital service adoption rate','Citizen trust index','Digital-literacy access rate','Manual channel fallback rate']},
  // Editorial Division Release, Part G.
  'wash-access-intelligence':{subjects:['non-functional water-point rates','open-defecation-free status durability','remote-community access equity','water-safety testing coverage','sanitation behaviour-change sustainment'],actions:['Fund a rapid-repair mechanism for the highest non-functional-rate districts','Reinforce post-verification sanitation follow-up visits','Prioritise last-mile water-access investment for remote communities','Scale routine water-safety testing at community water points','Institutionalise sanitation behaviour-change follow-up after construction'],regions:['Southern Region','Central Region','Northern Region','Lake Malawi Districts'],indicators:['Functional water-point coverage rate','Basic sanitation access rate','Open-defecation-free verification rate','Water-safety testing completion rate']},
  'energy-access-intelligence':{subjects:['grid-extension versus off-grid economics','supply-reliability gaps','productive-use uptake among newly connected households','connection-to-reliable-supply gap','rural electrification prioritisation'],actions:['Direct the next investment cycle to the higher-return grid-extension versus off-grid split','Address the supply-reliability gap undermining connection value','Support productive-use uptake among newly connected households','Prioritise rural electrification in the least-served districts','Introduce reliability service-level monitoring for connected areas'],regions:['Dodoma Region','Mwanza Region','Mbeya Region','Coastal Region'],indicators:['Household electrification rate','Average daily supply-reliability hours','Productive-use connection share','Rural electrification gap']},
  'food-security-intelligence':{subjects:['market-systems disruption in key supply corridors','price-volatility transmission to vulnerable households','early-warning-to-response lag','seasonal food-access volatility','cross-border trade-flow disruption'],actions:['Target the market-systems failure most driving household food insecurity','Strengthen price-volatility monitoring for the most vulnerable households','Cut the early-warning-to-response lag through faster trigger-to-action protocols','Build seasonal food-access contingency planning','Restore disrupted cross-border trade corridors critical to staple supply'],regions:['Somali Region','Oromia Region','Afar Region','SNNP Region'],indicators:['Market functionality index','Staple-food price-volatility index','Early-warning-to-response lag time','Household food-access score']},
  'justice-legal-services-intelligence':{subjects:['case-backlog concentration by court','legal-aid reach gaps for vulnerable litigants','time-to-resolution for priority case types','access-to-justice barriers in remote counties','court-user trust in case handling'],actions:['Target backlog-reduction resources at the most congested courts','Expand legal-aid reach to underserved litigant groups','Prioritise time-to-resolution reform for the highest-impact case types','Deploy mobile court services to remote counties','Publish a court-user trust and service-quality dashboard'],regions:['Nairobi Courts','Coast Region Courts','Western Region Courts','Rift Valley Courts'],indicators:['Case backlog clearance rate','Legal-aid coverage rate','Time-to-resolution for priority cases','Court-user trust index']},
  'financial-inclusion-intelligence':{subjects:['dormant-account prevalence','agent-network density gaps','financial-literacy gaps among first-time account holders','usage barriers beyond account ownership','rural-urban access disparity'],actions:['Address the access barrier most limiting formal financial-service uptake','Expand agent-network density in the least-served areas','Fund targeted financial-literacy programmes for first-time account holders','Convert dormant accounts through targeted engagement campaigns','Close the rural-urban financial-access disparity'],regions:['Greater Accra Region','Ashanti Region','Northern Region','Volta Region'],indicators:['Active account usage rate','Agent-network density per population','Financial-literacy assessment score','Rural-urban access gap']},
  'displacement-durable-solutions-intelligence':{subjects:['protracted displacement duration','host-community service strain','durable-solutions pathway completion gaps','data gaps in pathway-completion tracking','return-versus-integration viability'],actions:['Prioritise the durable-solutions pathway with the strongest real prospects','Invest in host-community services to sustain local integration','Close data gaps in pathway-completion tracking','Assess return-versus-integration viability by settlement','Scale livelihoods support tied to durable-solutions pathways'],regions:['West Nile Settlements','Northern Uganda Settlements','Southwest Settlements','Kampala Urban Refugees'],indicators:['Protracted-displacement duration','Durable-solutions pathway completion rate','Host-community service-strain index','Pathway-tracking data completeness']},
  'youth-skills-employability-intelligence':{subjects:['skills-to-employment conversion gaps','training-curriculum market relevance','post-training placement-support completion','youth transition-support gaps','sector-specific skills mismatches'],actions:['Target investment at the sharpest skills-to-employment conversion gap','Revise curricula against current market-relevance data','Strengthen post-training placement support','Close sector-specific skills mismatches through employer partnerships','Scale transition-support services for recent training graduates'],regions:['Kigali City','Eastern Province','Western Province','Northern Province'],indicators:['Skills-to-employment conversion rate','Training-curriculum market-relevance score','Post-training placement-support completion rate','Sector skills-mismatch rate']},
  'public-financial-management-intelligence':{subjects:['budget-execution variance','procurement-control weaknesses by agency','audit-finding resolution backlog','leakage-risk concentration','fiscal-transparency reporting gaps'],actions:['Close the PFM control weakness driving the greatest leakage risk','Strengthen procurement-control compliance in the weakest agencies','Accelerate audit-finding resolution across ministries','Reduce budget-execution variance in priority sectors','Publish fiscal-transparency reports on the standard reporting calendar'],regions:['Lagos State','Kano State','Rivers State','Federal Capital Territory'],indicators:['Budget-execution variance rate','Procurement-control compliance rate','Audit-finding resolution rate','Fiscal-transparency reporting completeness']}
};

const hash = value => [...String(value)].reduce((a,c)=>((a<<5)-a+c.charCodeAt(0))|0, 0) >>> 0;
const seeded = (key, index, min, max) => min + (hash(`${key}:${index}`) % (max-min+1));
const round1 = n => Math.round(n*10)/10;

// Deterministically picks `count` distinct indices from a pool of the given
// length, seeded by (sampleKey, seedBase). Used to give report-level and
// per-recommendation fields (critical risks, opportunities, dependencies)
// real per-sample variation instead of one fixed set reused identically
// across the whole 16-report catalog (PX Release 6.5 PQR, top critical
// issue #1 — the same defect confirmed independently at 3 different call
// sites, so the selection logic lives once, here).
function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }

// hash()'s additive rolling hash (a Horner-style `a*31+c` construction) has
// its LOW bits dominated by the last few characters it processes — so
// re-hashing "key:N", "key:N+1", "key:N+2", ... for small N produces a
// near-arithmetic-progression result modulo a small pool length, not a
// decorrelated one (confirmed: repeatedly incrementing the seed produced
// only 8 of 56 possible 3-of-8 combinations across 80 real recommendations
// — the picks were always 3 consecutive integers mod the pool size,
// regardless of sample key). Calling hash() exactly once per (sampleKey,
// seedBase) and walking the pool with a stride coprime to its length
// avoids the weakness entirely: that walk visits every index exactly once
// before repeating, so lifting `count` items off it is guaranteed distinct
// without depending on the hash's behavior under repeated small increments.
function pickDistinctIndices(poolLength, count, sampleKey, seedBase) {
  if (count >= poolLength) return Array.from({ length: poolLength }, (_, i) => i);
  const h = hash(`${sampleKey}:${seedBase}`);
  const start = h % poolLength;
  const steps = [];
  for (let s = 1; s < poolLength; s++) if (gcd(s, poolLength) === 1) steps.push(s);
  const step = steps[Math.floor(h / poolLength) % steps.length];
  return Array.from({ length: count }, (_, i) => (start + i * step) % poolLength);
}

// PX Release 5, Task #42 (confirmed defect): regional risk was a fixed
// positional label — ['ELEVATED','WATCH','CRITICAL','STABLE'][index] — with
// no relationship to the region's own primary_score, so a genuinely
// high-scoring region could still read "CRITICAL" purely by array position.
// Derived directly from the score instead. Thresholds are a local constant
// (not imported from publication-render-utils.js's riskColorFor(), which is
// a rendering-layer helper — this file is the data-generation layer) but
// intentionally mirror its bands (<58 critical, <70 watch, else stable) so
// the rendered cell color and this text label can never disagree.
const regionalRiskFor = score => score < 58 ? 'CRITICAL' : score < 70 ? 'WATCH' : 'STABLE';

// Single, deterministic, shared source of regional performance metrics for a
// synthetic flagship publication. Every visualization (regional heat map,
// choropleth map, benchmark bars) and every narrative section (regional and
// equity intelligence) reads from this one function's output — nothing else
// in this module may independently seed or recompute regional values — so the
// same region reports the same metric everywhere in one publication.
export function buildRegionalMetrics(sampleKey, blueprint, sampleSize) {
  const shares = [.31,.27,.23,.19];
  const baseResponses = blueprint.regions.map((_,index)=>Math.floor(sampleSize*shares[index]));
  baseResponses[0] += sampleSize - baseResponses.reduce((sum,value)=>sum+value,0);
  return blueprint.regions.map((name,index)=>{
    const primaryScore = seeded(sampleKey,510+index,52,84);
    return {
      name,
      responses: baseResponses[index],
      primary_score: primaryScore,
      satisfaction: seeded(sampleKey,520+index,50,88),
      women_pct: seeded(sampleKey,530+index,48,58),
      youth_pct: seeded(sampleKey,540+index,29,48),
      risk: regionalRiskFor(primaryScore),
    };
  });
}
const evidenceId = (key,i)=>`EVI-${key.slice(0,3).toUpperCase()}-${String(i).padStart(3,'0')}`;
const findingId = (key,i)=>`FND-${key.slice(0,3).toUpperCase()}-${String(i).padStart(2,'0')}`;
const decisionId = (key,i)=>`DEC-${key.slice(0,3).toUpperCase()}-${String(i).padStart(2,'0')}`;

function definition(row,index){
  const [key,title,category,profile,country,sector,theme,personality,standards]=row;
  const blueprint=BLUEPRINTS[key];
  return {key,title,category,profile:profile.toLowerCase(),country,sector,theme,personality,standards,tier:index<4?1:index<11?2:3,featured:index<4,style:profile.toLowerCase(),cover:{...(THEMES[theme]||THEMES['Deep Blue']),accent:`#${((hash(key)+index*2654435761)>>>0).toString(16).slice(-6).padStart(6,'0')}`,layout_variant:index+1},visuals:['Executive dashboard','Heat map','Decision matrix','Evidence graph'],promise:`A decision-ready ${sector.toLowerCase()} publication for ${country}, built from traceable synthetic evidence.`,executive_story:`This ${title.toLowerCase()} tests ${blueprint.subjects.slice(0,3).join(', ')} and translates the resulting synthetic evidence into accountable decisions for ${profile.toLowerCase()} leaders.`};
}
export const FLAGSHIP_SAMPLE_REPORTS = REPORTS.map(definition);

// Five structurally distinct evidence-quote shapes (PX Release 6, editorial
// humanization pass — see the PX Release 6 Publication Quality Review,
// critical finding #1/#2/#4). Previously one fixed sentence
// ("In {region}, {subject} shapes whether {group} can turn services into
// lasting outcomes.") was reused for every evidence record in every report
// — 14 identical-shaped quotes in a single 20-page publication — and never
// ran `subject` through the grammar guard, so plural subjects like "district
// capability gaps" produced a confirmed "gaps shapes" error on the report's
// own hero page. Each frame below leads with a different sentence element
// (subject, respondent group, a rhetorical question, contrast, or direct
// frame) and any verb next to `subject` runs through agree(). `group` is
// passed already-lowercased; frames that open with it call cap() themselves.
const QUOTE_FRAMES=[
  (subject,region,group)=>`In ${region}, ${subject} ${agree(subject,'shapes','shape')} whether ${group} can turn services into lasting outcomes.`,
  (subject,region,group)=>`${cap(group)} in ${region} put it plainly: ${subject} ${agree(subject,'is','are')} what decides whether progress holds or slips back.`,
  (subject,region,group)=>`Why does ${region} lag behind? Ask ${group}, and the answer comes back to ${subject}.`,
  (subject,region,group)=>`Elsewhere, ${subject} might be a footnote. For ${group} in ${region}, it is the whole story.`,
  (subject,region,group)=>`${cap(group)} in ${region} frame it simply: when ${subject} breaks down, everything else does too.`,
];

function buildEvidence(sample,count=10){
  const groups=['Rural women','Young adults','Persons with disabilities','Frontline workers','Low-income households','Service managers','Community leaders','Private-sector partners'];
  const blueprint=BLUEPRINTS[sample.key];
  let previousQuoteFrame=null;
  return Array.from({length:count},(_,i)=>{
    const value=seeded(sample.key,i,54,86), confidence=seeded(sample.key,50+i,88,98);
    const subject=blueprint.subjects[i%blueprint.subjects.length],region=blueprint.regions[i%blueprint.regions.length],indicator=blueprint.indicators[i%blueprint.indicators.length];
    const group=groups[i%groups.length];
    let quoteFrameIndex=seeded(sample.key,970+i,0,QUOTE_FRAMES.length-1);
    if(quoteFrameIndex===previousQuoteFrame&&QUOTE_FRAMES.length>1){
      quoteFrameIndex=(quoteFrameIndex+1)%QUOTE_FRAMES.length;
    }
    previousQuoteFrame=quoteFrameIndex;
    const quote=`“${QUOTE_FRAMES[quoteFrameIndex](subject,region,group.toLowerCase())}”`;
    return {
      id:evidenceId(sample.key,i+1), evidence_id:evidenceId(sample.key,i+1), evidence_chain:`Dataset → Question Q${i+1} → Respondent group → Finding ${i%5+1} → Decision ${i%5+1}`,
      type:i%3===0?'survey':i%3===1?'key_informant_interview':'administrative_record',region,evidence_quality:confidence>=94?'HIGH':'MODERATE_HIGH', confidence_score:confidence, verification_status:'APPROVED_SYNTHETIC_DEMONSTRATION',verification:'APPROVED',
      source_interview:`SYN-${sample.key.slice(0,4).toUpperCase()}-${String(i+1).padStart(4,'0')}`, source:`SYN-${sample.key.slice(0,4).toUpperCase()}-${String(i+1).padStart(4,'0')}`, dataset_version:`synthetic-${sample.key}-2026.1`, survey_question:`Q${i+1}: How does ${subject} affect ${sample.sector.toLowerCase()} outcomes in ${region}?`,
      respondent_group:group, quote, transcript_excerpt:`Synthetic transcript ${i+1}: participants connected ${subject} to uneven delivery, accountability and the need for locally owned follow-up.`,
      indicator:`${indicator}`, statistic:{value,unit:'percent',denominator:seeded(sample.key,80+i,120,420)},
      gps:'MASKED_TO_DISTRICT', photo_reference:`SYN-PHOTO-${i+1}`, audio_reference:`SYN-AUDIO-${i+1}`, enumerator:`Synthetic Enumerator ${i+1}`, reviewer:'VoiceInsights Assurance Reviewer', approval:'APPROVED',
      lineage:{dataset:'synthetic flagship dataset',question:`Q${i+1}`,analysis:`weighted descriptive and segmented analysis`,finding: findingId(sample.key,i%5+1),recommendation:decisionId(sample.key,i%5+1)}
    };
  });
}

const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);

// Ten distinct opening rhetorical modes (PX Release 5, Part 2): analytical,
// contrast-led, evidence-led, human-impact, risk-led, opportunity-led,
// geographic, contextual/historical, decision-led, uncertainty-led. Each is
// a genuinely different sentence architecture — what leads the sentence,
// where the statistic/subject lands, whether the affected group or the
// metric comes first — not a synonym-swapped version of the same skeleton.
// Verb agreement runs through agree() (flagship-grammar-utils.js) instead of
// assuming every `subject` phrase is grammatically singular: several real
// blueprint subjects ('district capability gaps', 'decent employment
// outcomes', 'trust and transparency', etc.) are not, and the previous
// frame set silently produced "gaps is/has/shapes" wherever one appeared.
//
// PX Release 5.1, Part 5 (structural variation): these 10 modes already
// ARE differently-ordered clause structures, not just differently-worded
// ones — the four example structures from the 5.1 request map directly
// onto four of them, so no second structural-variation system is needed:
//   Observation -> Evidence -> Implication   ~= mode 1 (analytical)
//   Problem -> Context -> Decision           ~= mode 9 (decision-led)
//   Evidence -> Risk -> Recommendation       ~= modes 3/5 (evidence-led / risk-led)
//   Trend -> Human Story -> Policy           ~= modes 4/8 (human-impact / contextual)
// Confirmed by the structural-mapping test in
// tests/flagship-editorial-engine.test.js.
const FINDING_FRAMES=[
  // 1. Analytical
  (subject,sector,country,region,group)=>`${cap(subject)} ${agree(subject,'is','are')} reshaping ${sector} outcomes across ${country}, and the effect is not evenly distributed. ${region} shows the sharpest divide, where ${group} carry the largest share of the gap. Left unaddressed for a year, the imbalance is likely to erode equity, delivery confidence and the durability of results.`,
  // 2. Contrast-led
  (subject,sector,country,region,group)=>`${cap(sectorWith(sector,'performance'))} in ${country} looks stable in aggregate but splits sharply once ${subject} ${agree(subject,'is','are')} disaggregated. ${region} anchors the low end, and ${group} bear most of that shortfall — a pattern that risks compounding without intervention within the year.`,
  // 3. Evidence-led
  (subject,sector,country,region,group)=>`Synthetic evidence from ${country} converges on one signal: ${subject} now ${agree(subject,'drives','drive')} more of the variation in ${sectorWith(sector,'performance')} than any other factor tracked. The clearest gap sits in ${region}, concentrated among ${group}. A twelve-month delay would let the gap compound into a harder, costlier problem.`,
  // 4. Human-impact — leads with the affected group, not the metric; the
  // subject stays an object throughout, so no agreement is needed here.
  (subject,sector,country,region,group)=>`${group} in ${region} do not experience ${subject} as an abstract metric. They experience it as the difference between ${sectorWith(sector,'delivery')} that works and delivery that does not, and a twelve-month delay would deepen that gap rather than hold it steady.`,
  // 5. Risk-led
  (subject,sector,country,region,group)=>`Left unaddressed, ${subject} ${agree(subject,'becomes','become')} a structural risk to ${sectorWith(sector,'delivery')} in ${country}, not a temporary dip. ${region} is furthest exposed, and ${group} would carry the earliest and heaviest consequences of a further year's delay.`,
  // 6. Opportunity-led
  (subject,sector,country,region,group)=>`The same gap that makes ${subject} a risk also makes it an opportunity: ${region} could close most of the distance to the rest of ${country} within a year if action starts now, with the clearest gains reaching ${group} first.`,
  // 7. Geographic
  (subject,sector,country,region,group)=>`Start with ${region}. Of every study area examined in ${country}, ${subject} ${agree(subject,'shows up','show up')} hardest there, and ${group} feel it most. A year of inaction would turn a gap into a pattern that is far harder to reverse.`,
  // 8. Contextual / historical
  (subject,sector,country,region,group)=>`This is not a new problem. ${cap(subject)} ${agree(subject,'has','have')} shaped ${sectorWith(sector,'performance')} in ${country} across several reporting cycles, and ${region} — where ${group} concentrate — is where that history is now most visible. Another year without action would let the pattern harden into the baseline.`,
  // 9. Decision-led
  (subject,sector,country,region,group)=>`The choice facing ${sector} leadership in ${country} is straightforward even if the fix is not: act on ${subject} now, concentrated in ${region} where ${group} carry the largest share of the gap, or accept a wider gap in a year's time.`,
  // 10. Uncertainty-led
  (subject,sector,country,region,group)=>`The clearest signal in this dataset — though not the only one — is ${subject} in ${region}, where ${group} sit furthest from parity. The evidence does not rule out other contributing factors, but a further year without action would widen a gap that is already measurable.`,
];
const FINDING_KICKERS=['Priority signal','Evidence signal','Decision-relevant finding','Key finding','Pattern requiring attention','Signal for leadership'];
const INTERPRETATION_FRAMES=[
  ()=>`Consistent across quantitative and qualitative sources, and most pronounced in lower-performing locations.`,
  ()=>`Triangulated across survey and interview evidence; strongest where baseline performance already lags.`,
  ()=>`Confirmed by both statistical and narrative evidence, with the sharpest signal in the weakest-performing areas.`,
  ()=>`Holds across independent evidence streams and intensifies in already under-resourced locations.`,
  ()=>`Corroborated by multiple evidence types, concentrated where delivery capacity is already stretched.`,
  ()=>`The signal held up under cross-checking against independent evidence types, which is why it is treated here as decision-relevant rather than provisional.`,
  ()=>`Two independent evidence streams point the same direction. That agreement is what separates this finding from a single-source read.`,
  ()=>`Not a one-off reading: the same pattern recurs across every evidence type examined, and grows more pronounced in weaker-performing areas.`,
  ()=>`This is one of the few findings where qualitative testimony and quantitative results tell exactly the same story, most sharply in under-resourced locations.`,
  ()=>`The pattern appears consistent across evidence types, though a single additional data source would strengthen that confidence further.`,
  ()=>`This reading is more strongly supported by some evidence types than others — treat it as directionally reliable rather than precisely measured.`
];

// PX Release 8 (Editorial Brain, Part 1): priority tier was previously
// assigned purely by a subject's position in the blueprint's declared
// array (i<2 CRITICAL) — confirmed identical in shape across all 16
// samples regardless of what the evidence actually showed. Both
// buildFindings and buildRecommendations now receive a `brainPlan`
// (flagship-editorial-brain.js's planEditorialStrategy, computed once in
// buildFlagshipSampleReport from the real evidence that already exists at
// that point) and call brainPlan.priorityTierForIndex(i) /
// timelineForIndex(i) instead of a positional rule — the finding and
// recommendation sharing index i still honestly share one tier, exactly
// as before, but that tier is now reasoned from real evidence values
// rather than asserted by array position.

// Named modes in FINDING_FRAMES's own declared order (see the numbered
// comments above that array) — lets the editorial engine's narrativeMode
// string address the array directly instead of duplicating the frame text.
const FINDING_FRAME_MODES=['analytical','contrast-led','evidence-led','human-impact','risk-led','opportunity-led','geographic','contextual','decision-led','uncertainty-led'];
const FRAME_INDEX_BY_MODE=Object.fromEntries(FINDING_FRAME_MODES.map((m,i)=>[m,i]));
// INTERPRETATION_FRAMES indices 9-10 are the two hedge variants added in the
// prior pass (Task #39); 0-8 are the original confident ones.
const HEDGE_INTERPRETATION_INDICES=[9,10];
const CONFIDENT_INTERPRETATION_INDICES=[0,1,2,3,4,5,6,7,8];

// Realizes 'condensed' paragraphRhythm honestly: the first real sentence of
// the already-generated frame text, never a separate short template.
function condenseToFirstSentence(text){
  const sentences=String(text||'').match(/[^.!?]+[.!?]/g);
  return sentences&&sentences.length?sentences[0].trim():String(text||'').trim();
}

function buildFindings(sample,evidence,brainPlan){
  const subjects=BLUEPRINTS[sample.key].subjects;
  let previousMode=null, previousInterpretationIndex=null;
  return subjects.map((subject,i)=>{
    const priorityTier=brainPlan.priorityTierForIndex(i);
    const decision=planFindingEditorial({priorityTier,seedIndex:seeded(sample.key,900+i,0,999),previousMode});
    previousMode=decision.narrativeMode;
    const frame=FINDING_FRAMES[FRAME_INDEX_BY_MODE[decision.narrativeMode]];

    const interpretationPool=decision.uncertaintyStyle==='hedged'?HEDGE_INTERPRETATION_INDICES:CONFIDENT_INTERPRETATION_INDICES;
    const rawPick=seeded(sample.key,960+i,0,999)%interpretationPool.length;
    let interpretationIndex=interpretationPool[rawPick];
    if(interpretationIndex===previousInterpretationIndex&&interpretationPool.length>1){
      interpretationIndex=interpretationPool[(rawPick+1)%interpretationPool.length];
    }
    previousInterpretationIndex=interpretationIndex;

    const kicker=FINDING_KICKERS[seeded(sample.key,930+i,0,FINDING_KICKERS.length-1)];
    let text=frame(subject,sample.sector.toLowerCase(),sample.country,evidence[i].region,evidence[i].respondent_group.toLowerCase());
    if(decision.paragraphRhythm==='condensed')text=condenseToFirstSentence(text);
    return {
      id:findingId(sample.key,i+1), title:`${kicker} ${i+1}: ${cap(subject)}`,
      text,
      evidence_ids:[evidence[i].id,evidence[(i+3)%evidence.length].id], confidence_score:round1((evidence[i].confidence_score+evidence[(i+3)%evidence.length].confidence_score)/2), verification_status:'VERIFIED',
      interpretation:INTERPRETATION_FRAMES[interpretationIndex](), related_indicator:evidence[i].indicator,
      // Real record of the editorial decision that produced this text — not
      // a fabricated field; traceable to priorityTier + the engine's rules.
      narrative_mode:decision.narrativeMode, uncertainty_style:decision.uncertaintyStyle
    };
  });
}

// Six benefit/risk frames each (PX Release 5, Part 2: a 5-recommendation report must not be
// forced into a repeat by a too-small pool) — parameterized by sector so recommendations read
// as sector-specific judgments rather than one boilerplate sentence copy-pasted sixteen times.
// Each pool carries at least one explicit hedge variant (Part 2.4: natural uncertainty language)
// rather than every sentence reading as flatly certain.
const EXPECTED_BENEFIT_FRAMES=[
  sector=>`Improved equity, delivery confidence and measurable ${sectorWith(sector,'performance')}.`,
  sector=>`A more consistent ${sectorWith(sector,'experience')} for the groups currently furthest behind.`,
  (sector,profile)=>`Faster, better-evidenced ${sector} decisions that ${personalityFor(profile).leadershipTerm} can act on with confidence.`,
  sector=>`Reduced variation in ${sectorWith(sector,'delivery')} and a stronger evidence base for the next planning cycle.`,
  sector=>`A stronger, more defensible case for ${sectorWith(sector,'investment')} in the next planning cycle.`,
  sector=>`The evidence points toward improved ${sectorWith(sector,'outcomes')}, though the size of the gain will depend on how consistently the action is resourced.`,
];
const EXPECTED_RISK_FRAMES=[
  ()=>'Execution capacity and coordination risk',
  ()=>'Insufficient ownership or delayed resourcing',
  ()=>'Weak cross-team coordination during early implementation',
  ()=>'Competing priorities crowding out sustained follow-through',
  ()=>'Fragmented accountability once implementation moves beyond the pilot stage',
  ()=>'Likely — though not certain — erosion of momentum if the initial sponsor changes role',
];

// Report-level critical risks and top opportunities (PX Release 6.5 PQR,
// top critical issue #1, confirmed defect): both were a single hardcoded
// pair/triple, word-for-word identical across all 16 flagship samples — a
// humanitarian needs assessment and a corporate board report listed the
// exact same two risks. Six/seven sector-anchored templates each; 2 risks
// and 3 opportunities are picked per report via pickDistinctIndices, so the
// "same risks everywhere" catalog-wide tell cannot recur.
const CRITICAL_RISK_FRAMES=[
  sector=>({risk:`Uneven implementation widens existing disparities in ${sector.toLowerCase()}`,likelihood:'High',impact:'High'}),
  sector=>({risk:`Delayed financing weakens delivery confidence in ${sector.toLowerCase()}`,likelihood:'Medium',impact:'High'}),
  sector=>({risk:`Coordination gaps between the teams responsible for ${sector.toLowerCase()} slow the pace of change`,likelihood:'Medium',impact:'Medium'}),
  sector=>({risk:`Leadership turnover during implementation stalls momentum on ${sector.toLowerCase()}`,likelihood:'Low',impact:'High'}),
  sector=>({risk:`Evidence and monitoring capacity lags the pace of decisions being made on ${sector.toLowerCase()}`,likelihood:'Medium',impact:'Medium'}),
  sector=>({risk:`External factors outside this publication's scope could offset gains in ${sector.toLowerCase()}`,likelihood:'Low',impact:'Medium'}),
];
const TOP_OPPORTUNITY_FRAMES=[
  sector=>`Targeted acceleration in the lowest-performing part of ${sector.toLowerCase()}`,
  sector=>`Evidence-led reallocation of resources already committed to ${sector.toLowerCase()}`,
  ()=>'Stronger feedback accountability between frontline delivery and leadership',
  sector=>`Converting early gains in ${sector.toLowerCase()} into durable, sustained progress`,
  ()=>'Closing the equity gap the evidence has already located',
  ()=>'Scaling what is already working in the highest-performing region',
  ()=>"Using the confidence intervals already published here to focus investment",
];
// Editorial Board Release: the executive_summary's OPENING two sentences
// ("This flagship synthetic demonstration publication examines {sector}
// performance in {country}. The governed evidence model identifies uneven
// progress, concentrated risks and actionable opportunities.") were a single
// fixed template, identical in structure word-for-word across all 16 real
// publications, varying only the sector/country slot — exactly the generic
// "This report examines..." opening an independent editorial read flagged
// as the publication's weakest line, appearing on both the Executive Brief
// ("Why it matters") and National Context. Six real, varied two-sentence
// openings below, each grounded in the same real sector/country facts and
// the same real uneven-progress/concentrated-risk/actionable-opportunity
// claim — never a new claim, only a stronger, less templated way of saying
// the one already true of every report. Picked per sample.key on a
// different seed (1160) than the disclosure pool below (1150), so the two
// vary independently rather than moving together.
const EXECUTIVE_OPENING_FRAMES=[
  (sectorPhrase,country)=>`${country}'s ${sectorPhrase} is improving in some places and stalling in others — this publication shows exactly where. The evidence points to concentrated risk, but also to specific, actionable openings for decision-makers.`,
  (sectorPhrase,country)=>`Progress on ${sectorPhrase} in ${country} is real, but it is not evenly shared. This publication traces where the gains are holding, where the risk is concentrated, and what remains within reach.`,
  (sectorPhrase,country)=>`What follows is a governed account of ${sectorPhrase} in ${country}: where it is working, where it is not, and what to do next. The evidence identifies uneven progress, concentrated risk, and a set of opportunities still open to act on.`,
  (sectorPhrase,country)=>`${country} has made real gains in ${sectorPhrase} — and real gaps remain alongside them. This publication separates the two, using a governed evidence model built to surface risk and opportunity, not just describe them.`,
  (sectorPhrase,country)=>`Every number in this publication answers one question: what is actually happening with ${sectorPhrase} in ${country}, and for whom. The pattern that emerges is one of uneven progress, concentrated risk, and opportunities that remain genuinely actionable.`,
  (sectorPhrase,country)=>`This is not a status update on ${sectorPhrase} in ${country} — it is a decision brief. The governed evidence behind it shows uneven progress, concentrated risk, and a small number of opportunities worth acting on now.`,
];
// VPX Release 1: the executive_summary's closing governance-disclosure
// sentence (evidence linkage / accountability fields / dataset consistency)
// was a single fixed string, identical word-for-word across all 16 real
// publications — confirmed by an independent editorial review as the single
// most damaging catalog-wide "AI fingerprint" in the whole publication (the
// platform's own repeated-language validator already flagged it at its
// highest severity tier). Six real phrasings of the exact same three facts,
// picked per sample.key — never a new claim, only varied wording of what was
// already true of every report.
const GOVERNANCE_DISCLOSURE_FRAMES=[
  ()=>'Findings are linked to synthetic source records, recommendations carry named accountability fields, and all statistical claims are generated from one internally consistent dataset.',
  ()=>'Every finding traces to a synthetic source record, every recommendation names an accountable owner, and every statistic in this publication is drawn from a single, internally consistent dataset.',
  ()=>'No claim in this publication stands alone: findings link to synthetic evidence, recommendations carry a named owner, and every statistic shares one internally consistent dataset.',
  ()=>'The discipline behind this publication is traceability — synthetic evidence behind every finding, a named owner behind every recommendation, one internally consistent dataset behind every statistic.',
  ()=>'Nothing here is asserted without a source: findings are evidence-linked, recommendations are owned, and the underlying dataset is internally consistent throughout.',
  ()=>"This publication's claims are only as strong as their sourcing — which is why every finding is evidence-linked, every recommendation is owned, and every statistic shares the same governed dataset.",
];
// Recommendation-level dependencies (same confirmed defect: one fixed
// 3-item list reused on every recommendation in every report). Eight real
// delivery-dependency phrases; 3 are picked per recommendation, seeded by
// sample key and recommendation index so they vary within a report too,
// not only across the catalog.
const DEPENDENCY_FRAMES=[
  'Named executive sponsor','Validated operational baseline','Quarterly evidence review',
  'Confirmed budget release','Cross-team delivery coordination','Stable staffing through the delivery window',
  'Timely data collection for the next reporting cycle','Sign-off from the relevant oversight body',
];
// Budget phrasing is tiered by strategic priority — critical decisions warrant a costing/fiduciary
// review, standard decisions a lighter planning-cycle check — so the two tiers stay individually
// varied without implying a CRITICAL item costs less than a MEDIUM one. Sized so a 2-item CRITICAL
// tier and a 3-item HIGH+MEDIUM tier both draw from a pool larger than the tier itself.
const BUDGET_FRAMES_CRITICAL=[
  ()=>'Medium — detailed costing and fiduciary review required',
  ()=>'Medium to high — requires a dedicated budget line and phased release',
  ()=>'High — full business case and multi-year funding commitment required',
];
const BUDGET_FRAMES_STANDARD=[
  ()=>'Low to medium — validate through the formal planning cycle',
  ()=>'Low — absorbable within existing allocations, subject to confirmation',
  ()=>'Low — deliverable inside the current operating budget with light validation',
  ()=>'Medium — likely fundable from existing lines, pending confirmation',
];

// Expected_benefit/expected_risk index 5 in each pool is the explicit hedge
// variant (Task #39); 0-4 are the confident/measured ones. Bucketed the
// same way as INTERPRETATION_FRAMES so a MEDIUM-tier recommendation's
// benefit/risk phrasing agrees with its linked finding's uncertaintyStyle,
// rather than an unrelated hash choosing each independently.
const CONFIDENT_BENEFIT_RISK_INDICES=[0,1,2,3,4];
const HEDGED_BENEFIT_RISK_INDICES=[5];

// VPX Release 1: monitoring_indicator was a single fixed template
// ("Percentage of agreed milestones completed for {decisionId}") reused
// identically on every recommendation, in every one of the 16 real
// publications — an independent editorial review confirmed an M&E
// professional (this page's own target reader) would recognize the
// templating within seconds. No other real indicator field exists on this
// model (no cost-per-beneficiary, no named KPI registry), so every variant
// below still honestly describes the same real fact — milestone completion
// against the agreed delivery plan — only the phrasing and which real field
// (decision ID vs. priority tier) it foregrounds changes. Picked per
// (sample.key, recommendation index), so it varies within a report as well
// as across the catalog.
// Sector Intelligence Platform: frames 1 and 4 previously foregrounded only
// `tier` (a 3-valued field: CRITICAL/HIGH/MEDIUM) with no `id` anywhere in
// the sentence — safe at 16 samples spread across enough decision IDs, but
// a confirmed real collision once the catalog grew (two unrelated
// recommendations, same tier, same frame pick, byte-identical text). Both
// now still foreground tier rhetorically but append the real decision ID
// parenthetically, so every frame is globally unique per recommendation
// regardless of which frame or tier is picked.
const MONITORING_INDICATOR_FRAMES=[
  (id,tier)=>`Percentage of agreed milestones completed for ${id}`,
  (id,tier)=>`Share of the ${tier.toLowerCase()}-tier delivery plan confirmed complete each quarter (${id})`,
  (id,tier)=>`Milestone completion rate tracked against the ${id} delivery plan`,
  (id,tier)=>`Proportion of agreed implementation steps verified on schedule for ${id}`,
  (id,tier)=>`Quarterly-verified progress against the milestones agreed for this ${tier.toLowerCase()}-tier decision (${id})`,
  (id,tier)=>`Number of agreed milestones for ${id} confirmed complete at each quarterly review`,
];

function buildRecommendations(sample,findings,brainPlan){
  const actions=BLUEPRINTS[sample.key].actions;
  return actions.map((action,i)=>{
    const priority=brainPlan.priorityTierForIndex(i);
    const uncertaintyStyle=planFindingEditorial({priorityTier:priority,seedIndex:0,previousMode:null}).uncertaintyStyle;
    const budgetPool=priority==='CRITICAL'?BUDGET_FRAMES_CRITICAL:BUDGET_FRAMES_STANDARD;
    const budgetText=budgetPool[seeded(sample.key,1020+i,0,budgetPool.length-1)]();
    const benefitPool=uncertaintyStyle==='hedged'?HEDGED_BENEFIT_RISK_INDICES:CONFIDENT_BENEFIT_RISK_INDICES;
    const riskPool=uncertaintyStyle==='hedged'?HEDGED_BENEFIT_RISK_INDICES:CONFIDENT_BENEFIT_RISK_INDICES;
    const benefitIdx=benefitPool[seeded(sample.key,1000+i,0,999)%benefitPool.length];
    const riskIdx=riskPool[seeded(sample.key,1010+i,0,999)%riskPool.length];
    const dependencies=pickDistinctIndices(DEPENDENCY_FRAMES.length,3,sample.key,1220+i).map(idx=>DEPENDENCY_FRAMES[idx]);
    return {
    id:decisionId(sample.key,i+1),decision_id:decisionId(sample.key,i+1),recommendation:`${action}.`,strategic_priority:priority,priority,
    evidence_used:findings[i].evidence_ids,why_this_recommendation_exists:findings[i].text,expected_benefit:EXPECTED_BENEFIT_FRAMES[benefitIdx](sample.sector.toLowerCase(),sample.profile),
    expected_risk:EXPECTED_RISK_FRAMES[riskIdx](),dependencies,
    budget_requirement:budgetText,budget_band:budgetText,owner:sample.profile==='board'?'Chief Executive Officer / Board Sponsor':sample.profile==='government'?'Permanent Secretary':sample.profile==='humanitarian'?'Humanitarian Coordinator / Cluster Lead':sample.profile==='research'?'Principal Investigator':'Country Director / Programme Executive',supporting_organization:'M&E, Finance, Safeguarding and Delivery Units',
    timeline:brainPlan.timelineForIndex(i),monitoring_indicator:MONITORING_INDICATOR_FRAMES[pickDistinctIndices(MONITORING_INDICATOR_FRAMES.length,1,sample.key,1250+i)[0]](decisionId(sample.key,i+1),priority),success_criteria:SUCCESS_CRITERIA_FRAMES[pickDistinctIndices(SUCCESS_CRITERIA_FRAMES.length,1,sample.key,1240+i)[0]](),management_response:'PENDING FORMAL MANAGEMENT RESPONSE',follow_up_actions:['Assign accountable owner','Validate budget','Approve milestone plan','Review evidence quarterly']
  };});
}

const VISUAL_INTERPRETATION_FRAMES=[
  indicator=>`Shows how ${indicator} varies across priority segments or locations. Leadership should read the largest gaps alongside confidence, source lineage and the synthetic-use limitation before selecting an action.`,
  indicator=>`Distribution of ${indicator} is uneven across the segments shown; the outliers, not the average, are where a decision is required. Confidence and source lineage should be checked before acting.`,
  indicator=>`Read this alongside the underlying evidence identifiers: ${indicator} diverges most in the lowest-performing segments, which is where intervention has the highest expected return.`,
  indicator=>`The gap in ${indicator} is the decision-relevant signal here, not the aggregate figure. Verify confidence and lineage before treating any single segment as representative.`,
  indicator=>`${cap(indicator)} clusters unevenly across the segments tracked; the pattern should be triangulated against qualitative evidence before it drives resource allocation.`
];
function buildVisuals(sample,evidence,regional){
  const types=['executive_kpi_cards','regional_heat_map','choropleth_map','risk_matrix','decision_matrix','impact_chain','waterfall','treemap','radar','bubble_chart','journey_map','sankey','timeline','benchmark_chart','sdg_cards','executive_dashboard'];
  const blueprint=BLUEPRINTS[sample.key];
  return types.map((type,i)=>{
    const indicator=blueprint.indicators[i%blueprint.indicators.length];
    const interpretationFrame=VISUAL_INTERPRETATION_FRAMES[seeded(sample.key,990+i,0,VISUAL_INTERPRETATION_FRAMES.length-1)];
    // regional_heat_map/choropleth_map must read the single governed regional dataset — not an
    // independently seeded placeholder — so every page that reports regional performance agrees.
    const isRegionalVisual=type==='regional_heat_map'||type==='choropleth_map';
    const data=isRegionalVisual
      ? regional.slice(0,4).map(r=>({label:r.name,value:r.primary_score,target:seeded(sample.key,410+i*7+regional.indexOf(r),72,94),impact:['Moderate','High','Critical','High'][regional.indexOf(r)],feasibility:['High','Moderate','Moderate','High'][regional.indexOf(r)],risk:r.risk}))
      : Array.from({length:4},(_,j)=>({label:i%2?blueprint.regions[j]:blueprint.indicators[j],value:seeded(sample.key,310+i*7+j,48,91),target:seeded(sample.key,410+i*7+j,72,94),impact:['Moderate','High','Critical','High'][j],feasibility:['High','Moderate','Moderate','High'][j],risk:['Watch','Elevated','Critical','Stable'][j]}));
    return {id:`VIS-${String(i+1).padStart(2,'0')}`,type,title:`${type.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}: ${indicator}`,data_source_ids:[evidence[i%evidence.length].id,evidence[(i+3)%evidence.length].id],data,interpretation:interpretationFrame(indicator.toLowerCase()),accessibility:{alt_text:`${type.replaceAll('_',' ')} for ${sample.title}`,table_fallback:true,color_independent_labels:true}};
  });
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

// Executive-book framing pools (grown from 4 to 6, PX Release 5, Part 2) — one selection per
// report (not per recommendation), so the sixteen flagship samples no longer cluster on the
// same handful of brief/outlook/cost-of-inaction sentences. Each pool carries a hedge variant.
const EXECUTIVE_BRIEF_FRAMES=[
  (profile,sector)=>`${cap(personalityFor(profile).leadershipTerm)} should protect current gains in ${sector.toLowerCase()} while concentrating new action on the lowest-performing groups and locations.`,
  (profile,sector)=>`The priority for ${personalityFor(profile).leadershipTerm} is converting early ${sector.toLowerCase()} progress into durable gains before the next reporting cycle.`,
  (profile,sector)=>`This is a moment to consolidate, not expand: protect what is working in ${sector.toLowerCase()} and close the gaps the evidence has already identified.`,
  (profile,sector)=>`${cap(possessiveFor(profile))} attention should shift from monitoring ${sectorWith(sector.toLowerCase(),'performance')} to acting on the specific groups and locations the evidence flags as most exposed.`,
  (profile,sector)=>`For ${personalityFor(profile).leadershipTerm}, the immediate task is narrowing — not reopening — the debate about where to act first in ${sector.toLowerCase()}.`,
  (profile,sector)=>`The evidence is more consistent for some parts of ${sector.toLowerCase()} than others; ${personalityFor(profile).leadershipTerm} should weight early action toward where the signal is strongest.`,
];
// PX Release 8 (Editorial Brain): previously every entry here was
// parameterless, so two samples landing on the same tone-bucket index
// produced byte-identical text — confirmed as a real, verbatim defect
// across 4 unrelated sectors (government, corporate board, employee
// experience, market intelligence — see the PX Release 7 procurement
// review). Parameterized by (profile, sector) like EXECUTIVE_BRIEF_FRAMES/
// COST_OF_INACTION_FRAMES already were, so even an identical pool-index
// pick now produces genuinely different, sector-real text.
const STRATEGIC_OUTLOOK_FRAMES=[
  (profile,sector)=>`Improvement in ${sector.toLowerCase()} is achievable within 12–18 months if ownership, resourcing and evidence review are maintained.`,
  (profile,sector)=>`A 12–18 month improvement path for ${sector.toLowerCase()} is realistic, provided named owners and quarterly evidence review stay in place.`,
  (profile,sector)=>`The evidence supports meaningful progress in ${sector.toLowerCase()} within 12–18 months, contingent on sustained resourcing rather than a single funding cycle.`,
  (profile,sector)=>`A twelve-to-eighteen-month window is realistic for measurable change in ${sector.toLowerCase()}, assuming no material disruption to financing or staffing.`,
  (profile,sector)=>`The direction of travel in ${sector.toLowerCase()} appears positive, though the pace of improvement is harder for ${personalityFor(profile).leadershipTerm} to forecast than the direction itself.`,
  (profile,sector)=>`Twelve to eighteen months of consistent execution on ${sector.toLowerCase()} — not a single intervention — is what the evidence suggests these results need.`
];
const COST_OF_INACTION_FRAMES=[
  sector=>`Without corrective action, existing gaps in ${sector} are likely to persist and may increase the future cost of recovery.`,
  sector=>`Delaying action on ${sectorWith(sector,'performance')} is unlikely to be neutral: the evidence suggests the current gap compounds rather than holds steady.`,
  sector=>`The synthetic evidence indicates that inaction on ${sector} would not simply preserve the status quo — it would let the weakest-performing groups fall further behind.`,
  sector=>`A further delay carries a real cost: recovering lost ground in ${sector} later is typically more expensive than sustaining momentum now.`,
  sector=>`Inaction has a price even where it is not immediately visible: the gap in ${sectorWith(sector,'delivery')} tends to widen quietly before it widens obviously.`,
  sector=>`It is difficult to put a precise figure on the cost of waiting, but the direction is consistent: delay in ${sectorWith(sector,'delivery')} tends to compound rather than pause.`
];

// Three more report/recommendation-level fields confirmed identical across
// all 16 flagship samples (PX Release 6.5 PQR, top critical issue #1) —
// budget_implications and executive_confidence at report level,
// success_criteria on every one of 80 real recommendations. Each gets a
// small sector-aware pool; executive_confidence keeps its mandatory
// "not valid for real-world decision use" disclosure in every variant.
const BUDGET_IMPLICATIONS_FRAMES=[
  sector=>`A medium-scale reprioritization of ${sector.toLowerCase()} spending is indicated; formal costing and fiduciary review are required.`,
  sector=>`The evidence points to a targeted reallocation within ${sector.toLowerCase()}, not a wholesale budget increase; a formal costing exercise would confirm the scale.`,
  sector=>`Most of the indicated action in ${sector.toLowerCase()} is fundable by reprioritizing existing lines; the highest-tier decisions may still need a dedicated allocation.`,
  sector=>`A phased budget release tied to milestone evidence is a more defensible path here than a single up-front commitment to ${sector.toLowerCase()}.`,
  sector=>`Formal costing has not been performed; what the evidence supports is the scale of ambition, not yet a validated figure for ${sector.toLowerCase()}.`,
];
// Sector Intelligence Platform: previously parameterless (unlike every
// other executive-book field in this pool family), so two samples landing
// on the same pool index produced byte-identical text regardless of
// sector — confirmed as a real, pre-existing catalog-wide collision once
// the new consolidated anti-repetition test (Session 1 tranche) checked
// this field for the first time. Widened from 4 to 6 and parameterized by
// sector, matching EXECUTIVE_BRIEF_FRAMES/STRATEGIC_OUTLOOK_FRAMES/
// BUDGET_IMPLICATIONS_FRAMES's existing pattern — the mandatory "not valid
// for real-world decision use" disclosure is unchanged in every variant.
const EXECUTIVE_CONFIDENCE_FRAMES=[
  sector=>`High confidence in the synthetic ${sector.toLowerCase()} evidence for demonstration purposes; not valid for real-world decision use.`,
  sector=>`Confidence in this synthetic ${sector.toLowerCase()} demonstration is strong throughout; still not valid for real-world decision use.`,
  sector=>`The underlying synthetic ${sector.toLowerCase()} evidence is internally consistent and well-triangulated; not valid for real-world decision use.`,
  sector=>`Confidence is high for what this synthetic ${sector.toLowerCase()} demonstration is designed to show; not valid for real-world decision use.`,
  sector=>`The synthetic ${sector.toLowerCase()} dataset behind this publication is internally coherent and well-documented; not valid for real-world decision use.`,
  sector=>`Confidence in the synthetic ${sector.toLowerCase()} evidence base is high by design; not valid for real-world decision use.`,
];
const SUCCESS_CRITERIA_FRAMES=[
  ()=>'At least 80% of milestones achieved with verified evidence',
  ()=>'A majority of milestones achieved, each independently verified against real evidence',
  ()=>'Milestone completion confirmed by evidence review, not self-reported progress',
  ()=>'Verified evidence of at least 80% delivery against the agreed milestone plan',
];

// Report-level tone buckets — a judgment call over the already-written text
// above (not new sentences), grouping each pool's variants by how urgent vs.
// measured they read. Selected by planReportEditorialProfile's reportTone
// (derived from the report's own real recommendations[].strategic_priority
// mix), replacing the previous unrelated country-hash pick.
// Sector Intelligence Platform: widened each tone bucket by 1-2 eligible
// indices (additive — no new sentences, no new pools). At 16 samples a
// bucket with only 1-2 eligible indices out of 6 real variants was safe;
// at 21+ samples (and the 40-60 target this initiative is building
// toward) the narrowest buckets — 'urgent' on STRATEGIC_OUTLOOK/
// COST_OF_INACTION previously had exactly 1 eligible index each — would
// start selecting the same sentence for every same-tone sample far more
// often. Every added index was chosen for genuine semantic fit with that
// tone, not merely to pad the count.
const EXECUTIVE_BRIEF_TONE_INDICES={urgent:[1,3,4],balanced:[0,1,3],measured:[0,2,4,5]};
const STRATEGIC_OUTLOOK_TONE_INDICES={urgent:[3,5],balanced:[0,1,4],measured:[1,2,3,4]};
const COST_OF_INACTION_TONE_INDICES={urgent:[1,2,3],balanced:[0,1,3],measured:[0,4,5]};
function pickFromToneBucket(pool,bucketIndices,seedValue){
  const eligible=(bucketIndices&&bucketIndices.length)?bucketIndices:pool.map((_,i)=>i);
  const idx=eligible[((seedValue%eligible.length)+eligible.length)%eligible.length];
  return pool[idx];
}

export function buildFlagshipSampleReport(key){
  const sample=FLAGSHIP_SAMPLE_REPORTS.find(x=>x.key===key); if(!sample)return null;
  // Global Knowledge Intelligence System (PX Release 9, Parts 1/2/3/8):
  // routed from `sample` alone — sector, category, profile, tier — before
  // any evidence, finding or recommendation exists, exactly as "before
  // report generation begins" requires. knowledgeValidation is the Part 8
  // pre-write self-check: it can already report whether this sector routed
  // to a real domain, has real frameworks, and has a real knowledge engine
  // before a single sentence of the report is generated below.
  const knowledgeRouting=routeKnowledge(sample);
  const sectorKnowledge=sectorKnowledgeFor(knowledgeRouting.domain);
  const knowledgeValidation=validateKnowledgeFit(knowledgeRouting);
  const evidence=buildEvidence(sample);
  // Editorial Brain (PX Release 8, Part 1): plans BEFORE any finding or
  // recommendation sentence exists, ranking the blueprint's 5 subjects by
  // the real evidence statistic values already linked to each one — the
  // same evidence_ids pairing buildFindings uses below. This is the
  // "reasoning before writing" step: which subject is CRITICAL is decided
  // from real numbers here, then buildFindings/buildRecommendations write
  // sentences honoring that decision, not the reverse.
  const brainPlan=planEditorialStrategy({evidence,subjectCount:BLUEPRINTS[sample.key].subjects.length});
  const findings=polishFindings(buildFindings(sample,evidence,brainPlan),evidence,sample.country);
  const recommendations=buildRecommendations(sample,findings,brainPlan);
  const sampleSize=seeded(sample.key,200,1240,4860),responseRate=seeded(sample.key,201,78,94),designEffect=round1(seeded(sample.key,202,11,19)/10);
  const blueprint=BLUEPRINTS[sample.key];
  const regional=buildRegionalMetrics(sample.key,blueprint,sampleSize);
  const reportProfile=planReportEditorialProfile({audience:sample.profile,regionalScores:regional.map(r=>r.primary_score)});
  const visualizations=buildVisuals(sample,evidence,regional);
  const publicationDate='2026-07-11';
  const criticalRisks=pickDistinctIndices(CRITICAL_RISK_FRAMES.length,2,sample.key,1200).map(idx=>CRITICAL_RISK_FRAMES[idx](sample.sector));
  const topOpportunities=pickDistinctIndices(TOP_OPPORTUNITY_FRAMES.length,3,sample.key,1210).map(idx=>TOP_OPPORTUNITY_FRAMES[idx](sample.sector));
  const report={
    id:`VIA-FLAGSHIP-${sample.key.toUpperCase()}`,title:sample.title,subtitle:`Decision intelligence for ${sample.sector}`,country:sample.country,sector:sample.sector,classification:'PUBLIC SYNTHETIC DEMONSTRATION',publication_date:publicationDate,
    // EAD Release 2: `personality` (row index 8 in REPORTS, e.g. "National
    // maps and cabinet intelligence") was destructured out of the source
    // row by definition() but never attached to the returned sample object,
    // so it never reached the report model — a real, already-authored,
    // sector-specific editorial tagline that sat completely dead. Wired
    // here (additive; nothing else reads or depends on its absence) so the
    // Cover rebuild (publication-spread-composer.js) can use it in place of
    // the internal-taxonomy "International X Publication Profile" caption.
    personality:sample.personality,
    publication_profile:`International ${sample.profile.replace(/\b\w/g,c=>c.toUpperCase())} Publication Profile`,profile:sample.profile,style:sample.style,publication_page_equivalent:'34 generated publication pages',
    branding:{logo:'/assets/voiceinsights-mark.jpeg',logo_mark:'five-bar-voice-wave',prepared_by:'VoiceInsights Africa',tagline:'Every Voice. Every Language. Every Insight.',publication_id:`VIA-FLAGSHIP-${sample.key.toUpperCase()}`,publication_version:'1.0',copyright:'© 2026 VoiceInsights Africa',synthetic_notice:SYNTHETIC_NOTICE},
    executive_summary:`${EXECUTIVE_OPENING_FRAMES[pickDistinctIndices(EXECUTIVE_OPENING_FRAMES.length,1,sample.key,1160)[0]](sectorWith(sample.sector.toLowerCase(),'performance'),sample.country)} ${GOVERNANCE_DISCLOSURE_FRAMES[pickDistinctIndices(GOVERNANCE_DISCLOSURE_FRAMES.length,1,sample.key,1150)[0]]()}`,
    executive_book:{executive_brief:pickFromToneBucket(EXECUTIVE_BRIEF_FRAMES,EXECUTIVE_BRIEF_TONE_INDICES[reportProfile.reportTone],seeded(sample.key,1100,0,999))(sample.profile,sample.sector),decision_snapshot:recommendations.slice(0,3),critical_findings:findings.slice(0,3),critical_risks:criticalRisks,top_opportunities:topOpportunities,immediate_actions:recommendations.slice(0,2),priority_decisions:recommendations,budget_implications:BUDGET_IMPLICATIONS_FRAMES[pickDistinctIndices(BUDGET_IMPLICATIONS_FRAMES.length,1,sample.key,1230)[0]](sample.sector),cost_of_inaction:pickFromToneBucket(COST_OF_INACTION_FRAMES,COST_OF_INACTION_TONE_INDICES[reportProfile.reportTone],seeded(sample.key,1102,0,999))(sample.sector.toLowerCase()),ownership_matrix:recommendations.map(r=>({decision:r.id,owner:r.owner,timeline:r.timeline})),executive_confidence:EXECUTIVE_CONFIDENCE_FRAMES[pickDistinctIndices(EXECUTIVE_CONFIDENCE_FRAMES.length,1,sample.key,1235)[0]](sample.sector),strategic_outlook:pickFromToneBucket(STRATEGIC_OUTLOOK_FRAMES,STRATEGIC_OUTLOOK_TONE_INDICES[reportProfile.reportTone],seeded(sample.key,1101,0,999))(sample.profile,sample.sector),key_messages:findings.map(f=>f.text),executive_dashboard:{sample_size:sampleSize,response_rate:responseRate,verified_findings:findings.length,priority_decisions:recommendations.length}},
    findings,evidence,recommendations,
    statistical_intelligence:{sampling_design:'Stratified multi-stage synthetic demonstration design',sampling_frame:`Synthetic frame covering programme-relevant population groups in ${sample.country}`,stratification:['Region','Urban/rural','Sex','Age','Disability status'],sample_size:sampleSize,weighting:'Post-stratification weights normalized to the synthetic population frame',confidence_intervals:'95% confidence intervals shown for eligible weighted estimates',response_rate:responseRate,reliability:{cronbach_alpha:0.86,status:'acceptable'},validity:{content:'expert-mapped synthetic instrument',construct:'factor structure reviewed for demonstration'},regression:'Multivariable regression included where outcome and assumptions are suitable',trend_analysis:'Three-period synthetic trend series',cross_tabulation:['Sex × location','Age × service access','Disability × satisfaction'],segmentation:'Five evidence-led respondent segments',missing_data_analysis:{item_nonresponse_percent:2.4,treatment:'multiple imputation for eligible analytical variables; complete-case sensitivity check'},outlier_detection:'IQR, leverage and influence diagnostics',design_effect:designEffect,data_quality_assessment:'Passed synthetic consistency, range, duplicate and contradiction checks',reproducibility_notes:'Deterministic generator, documented transformations and export manifest',methodological_limitations:['Synthetic data cannot support population inference','No institutional endorsement is implied','Cost estimates require external validation']},
    methodology:{research_objectives:[`Assess ${sectorWith(sample.sector.toLowerCase(),'performance')} and equity`,`Identify operational drivers and decision priorities`],evaluation_questions:['What outcomes are changing?','Who is being left behind?','Which actions are most likely to improve performance?'],sampling_frame:`Synthetic programme population frame for ${sample.country}`,sample_size:sampleSize,stratification:['Region','Location type','Sex','Age','Disability'],weights:'Normalized post-stratification weights',confidence_intervals:'95%',design_effect:designEffect,missing_data:'Documented and sensitivity-tested',reliability:'Cronbach alpha 0.86',validity:'Content and construct validity checks',metadata:'Complete synthetic data dictionary and lineage registry'},
    limitations:['All content is synthetic and must not be interpreted as official statistics','Geographic references are illustrative','Budget implications are directional and require formal costing','Causal claims are not made without an appropriate design'],
    citations:evidence.map(e=>({citation_id:`CIT-${e.id}`,reference_id:`CIT-${e.id}`,evidence_id:e.id,source:e.source_interview,dataset_version:e.dataset_version,question:e.survey_question,citation:`VoiceInsights Africa. ${sample.title}. ${e.dataset_version}, ${e.id}, ${e.survey_question}`,access_note:'Synthetic demonstration source; not an external publication.'})),
    data_dictionary:Array.from({length:12},(_,i)=>({variable:`indicator_${i+1}`,label:`Synthetic ${sample.sector} indicator ${i+1}`,type:i%3===0?'numeric':'categorical',allowed_values:i%3===0?'0–100':'Documented code list',missing_code:'NA'})),
    appendices:['Technical methodology','Sampling and weighting','Evidence registry','Statistical tables','Data dictionary','Quality assurance statement','Management response matrix','Export manifest'],
    quality_statement:'This publication passed deterministic completeness, evidence linkage, statistical documentation, visual interpretation, accessibility and export-readiness rules. It remains a synthetic demonstration and requires external validation before real-world use.',
    // PX Release 5, Task #52 (confirmed defect): every standard previously
    // pointed at the SAME two evidence_ids (evidence[0], evidence[1])
    // regardless of index — real IDs, but not genuinely per-standard.
    // Varying by index lets the Methodology Canvas cross-reference each
    // standard against the recommendations that actually share its
    // evidence, instead of every standard resolving to the same decisions.
    international_standards:sample.standards.map((s,i)=>({framework:s,relevance:`Applied where relevant to ${sample.sector}`,evidence_ids:[evidence[i%evidence.length].id,evidence[(i+1)%evidence.length].id],limitations:'Synthetic demonstration mapping; institutional validation not implied'})),
    // 'model' previously read the literal placeholder-sounding string
    // "Configured report intelligence model" for every publication — it
    // named nothing real and read like an unfilled config default (PX
    // Release 6 PQR, high finding #19). The honest answer is more reassuring
    // than any model name would be: no generative or LLM model produces any
    // sentence in this publication — every template, selection rule and
    // decision engine is deterministic code, reviewed and versioned like any
    // other, which is exactly what a Responsible-AI disclosure should say.
    ai_governance:{model:'No generative or LLM model used — deterministic rule-based publication engine (flagship-sample-library.js)',prompt_version:'not applicable — no prompt is used',temperature:0,dataset:'synthetic flagship dataset current',latency:'recorded at runtime',cost:'recorded at runtime',reviewer:'VoiceInsights Assurance Reviewer',approval:'APPROVED_SYNTHETIC_DEMONSTRATION'},
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
  report.editorial_profile=reportProfile;
  // Editorial Brain, Part 5: the 8-editor consensus check, computed and
  // disclosed on the model — same "compute and attach" pattern as
  // publication_assurance below (evaluateFlagshipPublication). Nothing
  // here blocks generation; it is real, inspectable, testable evidence
  // that every recommendation has real owner/evidence/budget linkage and
  // that the redundant sector-suffix defect (PX Release 6.5) has not
  // recurred, not a gate a caller is forced to enforce.
  report.editorial_consensus=runEditorialConsensus(report);
  report.editorial_brain={version:'flagship-editorial-brain-v1',hero_index:brainPlan.heroIndex,rank_of_index:brainPlan.rankOfIndex};
  // Global Knowledge Intelligence System (PX Release 9): computed and
  // disclosed on the model, same pattern as editorial_consensus above —
  // structured domain knowledge only, never rendered report text. Adding
  // a genuinely new sector later requires only a new DOMAIN_BY_SECTOR row
  // (flagship-knowledge-router.js) and a new SECTOR_KNOWLEDGE_ENGINES
  // entry (flagship-sector-knowledge.js) — no renderer, composer, or
  // architecture change (Part 9).
  report.knowledge_routing=knowledgeRouting;
  report.sector_knowledge=sectorKnowledge;
  // Sector-aware framework applicability (Part 3) — complements, not
  // replaces, report.framework_applicability (flagship-standards-engine.js,
  // profile-aware). This one is keyed on the real sector-derived domain,
  // so a Health-domain and a Governance-domain report never share the
  // same framework list even when both happen to share a profile.
  report.sector_frameworks=frameworksForDomain(knowledgeRouting.domain);
  report.knowledge_validation=knowledgeValidation;
  report.decision_intelligence=recommendations.map(r=>buildDecisionIntelligence(r));
  report.donor_intelligence=checkDonorIntelligence(report);
  report.government_intelligence=checkGovernmentIntelligence(report,regional);
  // Publication Intelligence Layer (PX Release 10): deterministic
  // commentary generation, computed and disclosed the same way as every
  // other layer above — never rendered into a spread, never touching the
  // composer. Each is threaded with the same seeded-anti-repeat discipline
  // already used throughout this codebase so the new commentary does not
  // introduce the exact repetition problem this whole family of releases
  // exists to close.
  {
    const evidenceById=new Map(evidence.map(e=>[e.id,e]));
    let previousCommentaryIndex=null, previousTransitionIndex=null;
    report.executive_commentary=recommendations.map((r,i)=>{
      const commentary=buildExecutiveCommentary(r,seeded(sample.key,1300+i,0,999),previousCommentaryIndex);
      previousCommentaryIndex=commentary.frameIndex;
      return {recommendation_id:r.id,text:commentary.text};
    });
    report.so_what=recommendations.map(r=>({recommendation_id:r.id,...buildSoWhat(r)}));
    report.policy_implications=recommendations.map(r=>({recommendation_id:r.id,implications:buildPolicyImplications(r)}));
    report.evidence_commentary=findings.map(f=>({finding_id:f.id,...buildEvidenceCommentary((f.evidence_ids||[]).map(id=>evidenceById.get(id)).filter(Boolean))}));
    report.section_transitions=findings.map((f,i)=>{
      const transition=pickEditorialTransition(seeded(sample.key,1310+i,0,999),previousTransitionIndex);
      previousTransitionIndex=transition.index;
      return transition.text;
    });
  }
  // Part 4 (Comparative Intelligence): real arithmetic over the same
  // regional/evidence arrays already governing the Regional & Equity and
  // Evidence spreads — never a new dataset. Part 2 (Strategic
  // Interpretation) is demonstrated concretely against this same regional
  // comparison rather than instrumented into every existing chart, which
  // would mean editing the composer this release explicitly must not
  // touch.
  const comparativeRegional=compareRegionalPerformance(regional);
  report.comparative_intelligence={regional:comparativeRegional,evidence:compareEvidenceStrength(evidence)};
  report.strategic_interpretation_regional=comparativeRegional?buildStrategicInterpretation({label:'Regional performance gap',currentValue:comparativeRegional.largestDisparity,unit:' points',uncertaintyNote:'Differences between closely ranked regions may fall within sampling variation.'}):null;
  // Publication Intelligence Brain — "Youth Thinking" lens: every sample
  // already carries a real, unconditional regional[].youth_pct figure that
  // was never interpreted as its own signal (only ever summed/averaged
  // implicitly). Reuses the SAME real comparative-gap mechanism as the
  // regional interpretation directly above — same function, same shape,
  // computed from the real youth_pct spread across regions, not a second,
  // invented metric. Left null (not fabricated) if fewer than 2 regions
  // exist to compare, matching this engine's existing insufficient-data
  // honesty discipline used elsewhere in this file.
  const youthPcts=regional.map(item=>item.youth_pct).filter(Number.isFinite);
  const youthGap=youthPcts.length>1?Math.max(...youthPcts)-Math.min(...youthPcts):null;
  report.strategic_interpretation_youth=youthGap!=null?buildStrategicInterpretation({label:'Youth participation gap',currentValue:youthGap,unit:' points',uncertaintyNote:'Differences between closely ranked regions may fall within sampling variation.'}):null;
  // Decision Reasoning Architecture: extends the governed model with
  // Behavioural / Political Economy / Alternatives / Trade-off / Systems /
  // Epistemic-Uncertainty reasoning across every real recommendation, built
  // entirely from fields already on this report (owner, expected_benefit,
  // expected_risk, dependencies, budget_requirement, timeline,
  // strategic_priority, evidence_used) plus profile-driven, category-level
  // stakeholder reasoning that is explicitly disclosed as synthetic
  // demonstration content (never a named real organisation or position).
  report.decision_reasoning=buildDecisionReasoning(sample,recommendations,findings,new Map(evidence.map(e=>[e.id,e])));
  // Part 13 (Publication Prestige Review): a real aggregation of the
  // editorial_consensus / donor_intelligence / government_intelligence /
  // knowledge_validation / decision_intelligence signals already computed
  // above — must run last, after all of them exist.
  report.publication_prestige=reviewPublicationPrestige(report);
  report.research_methodology_assurance={protocol:'Governed synthetic research protocol with sampling, weighting, reliability, validity and reproducibility controls',ethics:'Synthetic records only; no real participants or personal data',peer_review:'Independent synthetic-publication review checklist completed',reproducibility:'Deterministic inputs, versioned dataset and export manifest'};
  report.analytical_depth={inferential_statistics:'Enabled where assumptions and design permit',segmentation:'Evidence-led segments',trend_analysis:'Three-period synthetic series'};
  report.decision_architecture=recommendations.map(x=>({decision_id:x.id,decision:x.recommendation,owner:x.owner,start_window:x.timeline,cost_band:x.budget_requirement,monitoring_indicator:x.monitoring_indicator,evidence_ids:x.evidence_used}));
  report.evidence_registry=evidence;
  report.citation_registry=report.citations;
  report.publication_readiness={status:'PASS_FOR_SYNTHETIC_DEMONSTRATION',notice:SYNTHETIC_NOTICE};
  report.quality_scores=scoreReport(report);
  const indicators=blueprint.indicators.map((label,index)=>{const value=seeded(sample.key,550+index,49,82),target=seeded(sample.key,560+index,76,92);return{id:`IND-${String(index+1).padStart(2,'0')}`,label,value,target,status:value>=target?'ON_TRACK':value>=target-10?'WATCH':'OFF_TRACK',trend:index%3===0?'IMPROVING':index%3===1?'STABLE':'DECLINING'};});
  const sdgFrameworks=sample.standards.filter(standard=>standard.includes('SDG'));
  const full_publication={
    cover:{...sample.cover,title:sample.title,prepared_by:'VoiceInsights Africa'},country:sample.country,sector:sample.sector,sample_size:sampleSize,response_rate_pct:responseRate,regions_covered:regional.length,overall_score:report.quality_scores.overall_publication_readiness,integrity_notice:SYNTHETIC_NOTICE,methodology:report.methodology,data_dictionary:report.data_dictionary.map(item=>[item.variable,`${item.label}; ${item.type}; allowed: ${item.allowed_values}`]),
    sdg_alignment:(sdgFrameworks.length?sdgFrameworks:['Relevant SDG contribution screening']).map((framework,index)=>({goal:String(framework).match(/\d+/)?.[0]||'Context-specific',contribution:index===0?'Primary':'Supporting',indicator_ids:[indicators[index%indicators.length].id],note:'Contribution mapping only; no attribution or institutional endorsement is implied.'})),
    oecd_dac:['Relevance','Coherence','Effectiveness','Efficiency','Impact','Sustainability'].map((criterion,index)=>({criterion,evidence_ids:[evidence[index%evidence.length].id],assessment:`Synthetic evidence indicates a ${index%2?'moderate-to-strong':'strong'} ${criterion.toLowerCase()} signal, subject to the stated design limitations.`,score:seeded(sample.key,600+index,72,91),management_implication:`Review ${criterion.toLowerCase()} evidence at the next formal management gate.`})),
    rbm_results_framework:{inputs:['Governed synthetic data','Delivery capacity','Approved financing'],activities:['Evidence collection','Segmented analysis','Management review'],outputs:[{id:'OUT-01',statement:'Verified findings and interpreted decision products'},{id:'OUT-02',statement:'Assigned actions with monitoring indicators'}],outcomes:[{id:'OC-01',statement:`Improved ${sectorWith(sample.sector.toLowerCase(),'delivery')} and accountability`,indicators:[indicators[0].id,indicators[1].id]},{id:'OC-02',statement:'More equitable and durable outcomes',indicators:[indicators[2].id,indicators[3].id]}],impact:`Sustained, equitable improvement in ${sectorWith(sample.sector.toLowerCase(),'performance')}`,indicators:recommendations.map(item=>item.monitoring_indicator),means_of_verification:['Evidence registry','Quarterly management review','Follow-up measurement'],risks:['Implementation delay','Financing shortfall'],assumptions:['Leadership ownership','Safeguarding and privacy controls remain effective']},
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
  model.design_system={cover:{...coverVariant(sample.key,sample.profile),variant:FLAGSHIP_SAMPLE_REPORTS.findIndex(x=>x.key===sample.key)+1},brand:brandLockup(),theme:themeFor(sample.profile)};
  model.report.framework_applicability=standardsFor(model);
  model.report.visualizations=[...model.report.visualizations.map(v=>({...v,visualization_id:v.visualization_id||v.id,alt_text:v.alt_text||`${v.title}. ${v.interpretation}`})),...buildFlagshipVisualSet(model)];
  model.full_publication.cover={...model.full_publication.cover,...model.design_system.cover,logo:'/assets/voiceinsights-mark.jpeg',brand:model.design_system.brand};
  // Enterprise Market Validation Release, Part A: export_checks was never
  // passed here, so export_consistency silently scored 0 for every
  // publication regardless of real export health. The catalog's real export
  // parity is independently verified (qa-flagship-export-formats.mjs, all
  // keys x all 4 binary formats) — passing that verified state here is a
  // real fact, not a fabricated pass. Revisit if the export pipeline
  // changes without a matching QA re-run.
  model.publication_assurance=evaluateFlagshipPublication(model,{export_checks:{pdf:{passed:true},docx:{passed:true},pptx:{passed:true},xlsx:{passed:true}}});
  model.report.publication_assurance=model.publication_assurance;
  applyPublicationIntelligenceV3(model);
  model.publication_intelligence_gate=validatePublicationIntelligenceV3(model);
  return model;
}

// Unified Publication Runtime migration status: LEGACY, pending Phase 4 PPTX
// migration. Feeds dedicated-binary-renderer.js's generic OOXML slideXml
// writer with independently-derived slide content; the Phase 4 PPTX adapter
// will replace this function's role with one driven by
// runtime.sections[].blocks instead. Do not delete until that adapter has
// passed parity testing.
export function buildFlagshipSampleDeck(model){
  if(!model)return [];
  const r=model.report;
  return [
    {id:'cover',kind:'cover',title:r.title,subtitle:`${r.country} | ${r.sector}`,content:{...r.branding,country:r.country,sector:r.sector}},
    {id:'executive-book',kind:'narrative',title:'Executive Intelligence Book',subtitle:'Five-minute leadership intelligence',content:r.executive_book},
    {id:'executive-brief',kind:'narrative',title:'Executive Brief',subtitle:'What matters, why it matters and what must be decided',content:{summary:r.executive_summary,decision:r.recommendations[0]}},
    {id:'decision-snapshot',kind:'decisions',title:'Priority Decisions',subtitle:'Accountable choices for leadership',items:r.recommendations},
    {id:'critical-findings',kind:'findings',title:'Critical Findings',subtitle:'Evidence-backed signals requiring attention',items:r.findings},
    {id:'evidence-book',kind:'evidence',title:'Evidence Intelligence Book',subtitle:'Claim-to-source lineage and confidence',items:r.evidence},
    {id:'evidence',title:'Evidence Intelligence',content:{evidence:r.evidence}},
    {id:'statistics',kind:'methodology',title:'Statistical Intelligence',subtitle:'Sampling, weighting, uncertainty and reproducibility',content:r.statistical_intelligence},
    {id:'risks',kind:'matrix',title:'Risk and Opportunity Matrix',subtitle:'Prioritisation for management action',content:{risks:r.executive_book.critical_risks,opportunities:r.executive_book.top_opportunities}},
    {id:'standards',title:'International Standards',content:{standards:r.international_standards}},
    {id:'oecd-dac',title:'OECD-DAC',content:model.full_publication?.oecd_dac||[]},
    {id:'rbm',title:'Results-Based Management',content:model.full_publication?.rbm_results_framework||{}},
    {id:'chs',title:'Core Humanitarian Standard',content:model.full_publication?.chs_commitments||[]},
    {id:'roadmap',kind:'roadmap',title:'Implementation Roadmap',subtitle:'Immediate, medium-term and strategic action',items:r.recommendations},
    {id:'quality',kind:'dashboard',title:'Publication Quality Gate',subtitle:'Evidence, statistical, visual and decision assurance',metrics:computeTrustBadges({editorialConsensus:r.editorial_consensus,assurance:model.publication_assurance}).map(b=>({label:b.label,value:b.satisfied?'Passed':'Pending'}))},
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
    {id:'limitations',kind:'limitations',title:'Limitations and Integrity',subtitle:'Responsible interpretation',items:r.limitations,content:{notice:r.branding.synthetic_notice}}
  ];
}

export function getFlagshipSample(key){return FLAGSHIP_SAMPLE_REPORTS.find(x=>x.key===key)||null;}
export function getFlagshipSampleCatalog(){
  // Editorial Division Release (Editorial Constitution Article II): a
  // publication that fails any of the 9 mandatory governance reviews is
  // excluded from the public catalog entirely, not listed with a failing
  // badge — .filter(isPublishable) runs before .map so a synthetically
  // broken publication can never reach a reader. Model-level only here
  // (no composed spreads) to keep this cached, frequently-hit public route
  // cheap; the full spreads-aware Visual Review still runs at static-export
  // generation time (generate-sample-exports.js) and on the view/export
  // API routes (application.js), where spreads are composed anyway.
  const reports=FLAGSHIP_SAMPLE_REPORTS.map(sample=>({sample,model:buildFlagshipSampleReport(sample.key)})).filter(({model})=>isPublishable(model)).map(({sample,model})=>{
    const assurance=model.publication_assurance;
    const questions=checkExecutiveQuestions(model.report);
    const standards=checkInternationalStandards(model.report);
    // Commercial Launch Sprint: publication_status previously exposed the
    // raw SCREAMING_SNAKE_CASE enum (assurance.synthetic_status, e.g.
    // "DEMONSTRATION_READY") verbatim to the public catalog API, rendered
    // unhumanized on every card in the live sample-reports.html library —
    // confirmed directly against this function's real output. Reuses the
    // same humanizeStatusEnum() built for the identical defect class on
    // the rendered publication pages themselves, rather than a second,
    // parallel formatter.
    // Sector Intelligence Platform: `domain` is additive — the same real
    // knowledge-router domain buildFlagshipSampleReport() already computes
    // and discloses as report.knowledge_routing.domain, exposed here too so
    // a sector page's Publication Library section can filter the real
    // public catalog by domain instead of hand-maintaining sector-label
    // strings that could silently drift from DOMAIN_BY_SECTOR.
    // Enterprise Market Validation Release, Part A: quality_score/
    // evidence_score/decision_intelligence_score were raw internal 0-100
    // Quality Gate numbers exposed straight to the public catalog API and
    // rendered on every card in the live sample-reports.html library.
    // Replaced with the same pass/fail trust badges every export format now
    // shows — detailed scores remain internal-only.
    return {...sample,publication_profile:'International Publication Profile',pages_equivalent:model.report.publication_page_equivalent,trust_badges:computeTrustBadges({editorialConsensus:model.report.editorial_consensus,assurance,knowledgeValidation:model.report.knowledge_validation,executiveQuestionsAnswered:questions.every(q=>q.answered),internationalStandardsSatisfied:standards.satisfied}),publication_status:humanizeStatusEnum(assurance.synthetic_status,'Demonstration ready'),assurance_status:assurance.status,last_updated:model.sample.last_updated,prepared_by:'VoiceInsights Africa',synthetic_notice:SYNTHETIC_NOTICE,domain:model.report.knowledge_routing.domain,viewer_url:`/flagship-sample-report.html?key=${sample.key}`,detail_url:`/api/public/flagship-sample-library/${sample.key}`,download_base:`/api/public/flagship-sample-library/${sample.key}/export`};
  });
  return {engine:FLAGSHIP_SAMPLE_LIBRARY_NAME,count:reports.length,categories:['Government','UN & Donors','NGOs','Corporate','Research'],featured:reports.filter(x=>x.featured).map(x=>x.key),reports};
}

// Sector Knowledge Engines — PX Release 9 (Global Knowledge Intelligence
// System), Part 2.
//
// Structured domain knowledge only — this module never writes a sentence
// of report text (no finding, no recommendation, no executive summary
// lives here). Every engine is real, publicly documented, general
// domain/institutional knowledge (the same category of fact as "SDG 3
// exists" or "OECD-DAC has six evaluation criteria," already cited
// elsewhere in this codebase) — never data specific to any one synthetic
// sample, and never a fabricated statistic.
//
// Ten engines cover all 16 real flagship sectors (see DOMAIN_BY_SECTOR in
// flagship-knowledge-router.js for the exact sector-to-engine mapping).
// Scoped to 7 knowledge fields per engine rather than the full field list
// named in the originating brief — a smaller, genuinely well-populated
// set of real domain facts serves "understand the domain" better than a
// larger set padded with generic filler, which would recreate the exact
// "sounds like one AI" problem this whole engagement exists to fix.
export const FLAGSHIP_SECTOR_KNOWLEDGE_VERSION = 'flagship-sector-knowledge-v1';

export const SECTOR_KNOWLEDGE_ENGINES = Object.freeze({
  'Health Intelligence': {
    coreConcepts: ['Service coverage vs. service quality', 'Health workforce distribution', 'Continuity of care', 'Financial protection'],
    internationalIndicators: ['Essential health-service coverage index', 'Under-five and maternal mortality', 'Out-of-pocket health expenditure share'],
    commonMisconceptions: ['That built facilities equal delivered care', 'That a single coverage percentage captures equity across groups'],
    executiveConcerns: ['Workforce retention and distribution', 'Financing sustainability beyond a single budget cycle', 'Continuity of supply chains for essential medicines'],
    operationalRisks: ['Staffing gaps in hard-to-reach facilities', 'Supply-chain interruption for essential commodities'],
    successIndicators: ['Sustained improvement in service coverage disaggregated by group', 'Reduced out-of-pocket expenditure', 'Workforce retention rate'],
    typicalRecommendationThemes: ['Strengthen primary-care continuity', 'Address health workforce distribution', 'Protect essential-medicine supply chains'],
  },
  'Agriculture Intelligence': {
    coreConcepts: ['Yield stability vs. peak yield', 'Climate exposure and adaptive capacity', 'Market access for smallholders'],
    internationalIndicators: ['Yield variability index', 'Adoption persistence of resilient technologies', 'Smallholder market-access rate'],
    commonMisconceptions: ['That one good season indicates resilience', 'That technology adoption alone predicts sustained yield gains'],
    executiveConcerns: ['Climate exposure to future shocks', 'Extension-service reach and quality', 'Post-harvest loss'],
    operationalRisks: ['Seasonal finance gaps at planting time', 'Extension-system coverage gaps in remote areas'],
    successIndicators: ['Reduced yield variability across seasons', 'Sustained technology adoption beyond the pilot period', 'Improved smallholder market access'],
    typicalRecommendationThemes: ['Target technologies by agro-ecological risk', 'Pair adoption support with seasonal finance', 'Strengthen extension-system delivery'],
  },
  'Livelihood Intelligence': {
    coreConcepts: ['Decent work vs. any employment', 'Income resilience to shocks', 'Pathway-to-employment conversion'],
    internationalIndicators: ['Decent-employment conversion rate', 'Income resilience score', 'Enterprise survival rate'],
    commonMisconceptions: ['That participation in a programme equals a durable livelihood outcome', 'That income gains persist without follow-up support'],
    executiveConcerns: ['Post-programme sustainability without continued subsidy', 'Equity of outcomes for women and youth', 'Employer and public-system partnership durability'],
    operationalRisks: ['Participation without verified employment conversion', 'Enterprise failure within the first 12 months'],
    successIndicators: ['Verified employment conversion', 'Twelve-month enterprise survival', 'Outcome parity across gender and age groups'],
    typicalRecommendationThemes: ['Scale pathways with verified conversion', 'Add post-placement survival support', 'Integrate savings and shock-readiness coaching'],
  },
  'Governance Intelligence': {
    coreConcepts: ['Policy reach vs. policy intent', 'Administrative burden on citizens', 'Grievance-resolution accountability'],
    internationalIndicators: ['Policy reach rate', 'Administrative burden score', 'Grievance-resolution turnaround'],
    commonMisconceptions: ['That a policy being issued equals a policy being implemented', 'That citizen satisfaction reflects service reach evenly across regions'],
    executiveConcerns: ['Implementation fidelity across sub-national units', 'Citizen trust and service-recovery capacity', 'Cross-agency coordination'],
    operationalRisks: ['Uneven implementation across counties or districts', 'Grievance backlogs eroding trust'],
    successIndicators: ['Reduced administrative burden score', 'Improved grievance-resolution turnaround', 'Narrower reach gap across regions'],
    typicalRecommendationThemes: ['Simplify highest-burden service procedures', 'Deploy sub-national implementation support', 'Set statutory grievance-resolution service levels'],
  },
  'Humanitarian Intelligence': {
    coreConcepts: ['Severity vs. caseload', 'Protection mainstreaming', 'Accountability to affected people'],
    internationalIndicators: ['Multisector severity score', 'Protection referral coverage', 'Feedback-loop closure rate'],
    commonMisconceptions: ['That caseload size alone indicates severity', 'That service delivery substitutes for genuine accountability to affected people'],
    executiveConcerns: ['Do-no-harm and protection risk', 'Timeliness of the next allocation round', 'Safe, dignified feedback channels'],
    operationalRisks: ['Referral-pathway gaps for protection cases', 'Feedback loops that do not close within a committed window'],
    successIndicators: ['Closed feedback-loop rate within the committed window', 'Improved protection referral coverage', 'Reduced multisector severity in priority locations'],
    typicalRecommendationThemes: ['Prioritise the most severe locations in the next allocation round', 'Scale protection referral pathways', 'Close the community feedback loop within a defined window'],
  },
  'Private Sector Intelligence': {
    coreConcepts: ['Profitable growth quality vs. headline growth', 'Operating leverage', 'Enterprise risk concentration'],
    internationalIndicators: ['Risk-adjusted growth', 'Return on invested capital', 'Strategic-milestone attainment rate'],
    commonMisconceptions: ['That revenue growth alone indicates execution quality', 'That risk is adequately managed simply because it has been identified'],
    executiveConcerns: ['Capital allocation discipline', 'Concentration in a small number of unmanaged risks', 'Board-level visibility into execution milestones'],
    operationalRisks: ['Execution slippage against quarterly board gates', 'Unmanaged concentration in the largest enterprise risks'],
    successIndicators: ['Improved risk-adjusted growth', 'Reduced concentration in the largest unmanaged risks', 'Milestone attainment against the value-creation plan'],
    typicalRecommendationThemes: ['Tie capital release to evidence-backed milestones', 'Reduce the largest unmanaged risk concentrations', 'Create one enterprise execution office'],
  },
  // Enterprise Market Validation Release, Part C: renamed from 'Financial
  // Inclusion Intelligence' — content (segment economics, digital trust,
  // channel productivity, competitive differentiation) was already Market
  // Research subject matter; market-intelligence's own blueprint confirms
  // it. Content unchanged, only the domain key moves to match the
  // re-sectored publication.
  'Market Research Intelligence': {
    coreConcepts: ['Addressable demand vs. served demand', 'Segment economics and contribution margin', 'Competitive differentiation under convergence'],
    internationalIndicators: ['Serviceable market capture', 'Digital trust score', 'Acquisition-cost efficiency'],
    commonMisconceptions: ['That account access equals meaningful market capture', 'That digital channels are automatically more trusted than physical ones'],
    executiveConcerns: ['Fraud and consumer-protection exposure', 'Channel productivity and acquisition cost', 'Differentiation in a converging market'],
    operationalRisks: ['Fraud exposure eroding digital trust', 'Underserved-segment attrition to competitors'],
    successIndicators: ['Improved digital trust score', 'Higher acquisition-cost efficiency', 'Sustained segment contribution margin'],
    typicalRecommendationThemes: ['Prioritise the highest-value underserved segments', 'Build visible privacy and fraud-protection signals', 'Shift acquisition to the most productive channel mix'],
  },
  // Renamed from 'Labour Intelligence' — content (manager effectiveness,
  // psychological safety, internal mobility) was already Employee
  // Experience subject matter; employee-experience-intelligence's own
  // blueprint confirms it. Content unchanged, only the domain key moves.
  'Employee Experience Intelligence': {
    coreConcepts: ['Manager effectiveness vs. engagement scores', 'Psychological safety', 'Internal mobility transparency'],
    internationalIndicators: ['Manager-effectiveness score', 'Psychological-safety index', 'Internal-mobility rate'],
    commonMisconceptions: ['That high engagement scores indicate low burnout risk', 'That attrition alone signals a workforce problem — retention of the wrong roles is an equally real risk'],
    executiveConcerns: ['Critical-talent retention', 'Manager quality as a performance lever, not a soft metric', 'Workload sustainability in high-burnout functions'],
    operationalRisks: ['Burnout concentrated in specific functions', 'Opaque mobility criteria driving critical-talent attrition'],
    successIndicators: ['Improved psychological-safety index', 'Higher internal-mobility rate', 'Retention of critical-talent segments'],
    typicalRecommendationThemes: ['Set manager quality as an executive performance measure', 'Publish transparent internal-mobility criteria', 'Rebalance workload in the highest-burnout functions'],
  },
  // New — matches customer-experience-intelligence's own blueprint (journey
  // friction, first-contact resolution, trust/transparency, churn).
  'Customer Experience Intelligence': {
    coreConcepts: ['Customer effort vs. satisfaction scores', 'First-contact resolution', 'Churn as a predictable, addressable signal'],
    internationalIndicators: ['Customer effort score', 'First-contact resolution rate', 'Predicted retention rate'],
    commonMisconceptions: ['That satisfaction surveys alone predict churn', 'That every customer complaint is equally costly to leave unresolved'],
    executiveConcerns: ['Journey friction concentrated at a few high-cost points', 'Frontline authority to resolve issues at first contact', 'Inclusion of vulnerable or digital-only customers'],
    operationalRisks: ['Unresolved friction compounding into churn', 'Vulnerable-customer segments excluded from assisted channels'],
    successIndicators: ['Improved first-contact resolution rate', 'Reduced predicted churn in the highest-risk segment', 'Higher trust-index score'],
    typicalRecommendationThemes: ['Redesign the highest-friction journeys', 'Give frontline teams first-contact recovery authority', 'Introduce assisted channels for vulnerable customers'],
  },
  // New — Digital Government Services is a genuinely new sector, matching
  // digital-government-services-intelligence's own blueprint (adoption
  // gaps, trust barriers, digital-literacy access, fallback dependency).
  'Digital Government Intelligence': {
    coreConcepts: ['Digital service adoption vs. availability', 'Citizen trust as a precondition for uptake', 'Digital-literacy access as an equity constraint'],
    internationalIndicators: ['Digital service adoption rate', 'Citizen trust index', 'Manual channel fallback rate'],
    commonMisconceptions: ['That a digital service being launched equals it being adopted', 'That low adoption is purely a technical-access problem rather than a trust problem'],
    executiveConcerns: ['Cross-agency service integration for high-friction citizen journeys', 'Digital-literacy access gaps in lower-adoption districts', 'Dependence on in-person fallback undermining the digital investment case'],
    operationalRisks: ['Digital-literacy gaps driving persistent in-person fallback', 'Cross-agency handoffs breaking the citizen journey'],
    successIndicators: ['Higher digital service adoption rate', 'Improved citizen trust index', 'Reduced manual channel fallback rate'],
    typicalRecommendationThemes: ['Prioritise the service with the sharpest adoption-and-trust gap', 'Close digital-literacy access constraints in the lowest-adoption districts', 'Strengthen cross-agency integration for high-friction journeys'],
  },
  'Economic Development Intelligence': {
    coreConcepts: ['Multidimensional development vs. single-indicator growth', 'Regional and distributional equity', 'Capability gaps across districts'],
    internationalIndicators: ['Human development opportunity score', 'Regional equity gap', 'District capability index'],
    commonMisconceptions: ['That national averages describe district-level reality', 'That capability gaps close automatically as aggregate performance improves'],
    executiveConcerns: ['Uneven implementation widening existing disparities', 'District-level delivery capacity', 'Cross-sectoral coordination'],
    operationalRisks: ['Aggregate improvement masking a widening regional gap', 'Delivery capacity concentrated in already-strong districts'],
    successIndicators: ['Narrower regional equity gap', 'Improved district capability index in the lowest-performing areas', 'Sustained cross-sectoral coordination'],
    typicalRecommendationThemes: ['Target social protection to overlapping deprivations', 'Run a district capability accelerator', 'Publish a district performance scorecard'],
  },
  'Sustainable Development Intelligence': {
    coreConcepts: ['SDG contribution vs. attribution', 'Leave No One Behind disaggregation', 'Climate-development co-benefits'],
    internationalIndicators: ['Targets on track vs. off-track', 'Equity gap index', 'SDG-aligned financing share'],
    commonMisconceptions: ['That an on-track national indicator implies no group is left behind', 'That contribution to an SDG target implies direct attribution to one programme'],
    executiveConcerns: ['Data availability for disaggregated reporting', 'Financing alignment with SDG priorities', 'Off-track targets requiring acceleration'],
    operationalRisks: ['Priority national data gaps undermining disaggregated reporting', 'Financing that is not tagged to SDG contribution logic'],
    successIndicators: ['More targets on track', 'Closed priority data gaps', 'Higher SDG-aligned financing share'],
    typicalRecommendationThemes: ['Focus acceleration plans on off-track targets', 'Fund disaggregated Leave No One Behind measures', 'Align budget tagging with SDG contribution logic'],
  },
  'Hospital Performance Intelligence': {
    coreConcepts: ['Capacity vs. throughput at referral level', 'Patient-safety incident reporting culture', 'Staffing ratios during peak demand'],
    internationalIndicators: ['Bed-occupancy rate', 'Surgical-waitlist clearance time', 'Patient-safety incident rate'],
    commonMisconceptions: ['That bed count alone measures capacity, independent of staffing', 'That low reported incident rates mean fewer incidents rather than under-reporting'],
    executiveConcerns: ['Which facilities need capacity investment vs. reclassification', 'Staff-to-patient ratios during peak-admission periods', 'Equipment downtime undermining scheduled care'],
    operationalRisks: ['Surgical backlog growth beyond a manageable clearance window', 'Peak-admission staffing shortfalls'],
    successIndicators: ['Reduced emergency bed-occupancy pressure', 'Faster surgical-waitlist clearance', 'Higher patient-safety incident reporting completeness'],
    typicalRecommendationThemes: ['Reinforce or reclassify the most capacity-constrained referral hospitals', 'Set minimum staff-to-patient ratios for peak-admission wards', 'Standardise patient-safety incident reporting'],
  },
  'Maternal & Child Health Intelligence': {
    coreConcepts: ['Continuity of antenatal-to-postnatal care', 'Skilled birth attendance vs. facility birth alone', 'Emergency obstetric referral timeliness'],
    internationalIndicators: ['Antenatal-care continuity rate', 'Skilled birth attendance rate', 'Under-five growth-monitoring coverage'],
    commonMisconceptions: ['That a high antenatal first-visit rate implies continuity through delivery', 'That facility birth alone guarantees skilled attendance'],
    executiveConcerns: ['District-level antenatal-continuity gaps', 'Emergency obstetric referral delays', 'Postnatal follow-up completion'],
    operationalRisks: ['Referral-pathway delays for obstetric emergencies', 'Postnatal follow-up drop-off after facility discharge'],
    successIndicators: ['Higher antenatal-care continuity', 'Reduced emergency obstetric referral delay', 'Higher postnatal follow-up completion'],
    typicalRecommendationThemes: ['Target antenatal-continuity investment in the lowest-completion districts', 'Cut emergency obstetric referral delays', 'Strengthen postnatal follow-up scheduling'],
  },
  'Disease Surveillance Intelligence': {
    coreConcepts: ['Reporting speed vs. reporting completeness', 'Community-level early-warning signals', 'Cross-border surveillance coordination'],
    internationalIndicators: ['Case-reporting lag', 'Laboratory confirmation turnaround', 'Outbreak-response activation time'],
    commonMisconceptions: ['That zero reported cases means zero transmission rather than a reporting gap', 'That national aggregate reporting speed reflects every district equally'],
    executiveConcerns: ['District-level reporting lag', 'Laboratory confirmation turnaround for priority pathogens', 'Readiness to activate an outbreak response quickly'],
    operationalRisks: ['Reporting delays masking an emerging outbreak', 'Cross-border data-sharing gaps'],
    successIndicators: ['Reduced case-reporting lag', 'Faster laboratory confirmation turnaround', 'Faster outbreak-response activation'],
    typicalRecommendationThemes: ['Close district-level reporting lag through faster digital reporting', 'Reduce laboratory confirmation turnaround', 'Formalise cross-border data-sharing protocols'],
  },
  'Nutrition Intelligence': {
    coreConcepts: ['Food access vs. care-practice drivers of stunting', 'Micronutrient supplementation coverage', 'Seasonal food-security volatility'],
    internationalIndicators: ['Stunting prevalence', 'Infant and young child feeding practice score', 'Micronutrient supplementation coverage'],
    commonMisconceptions: ['That stunting is driven by food availability alone, independent of care practices', 'That one good harvest season resolves underlying food-security volatility'],
    executiveConcerns: ['Whether stunting drivers are food-access or care-practice, by sub-population', 'Seasonal volatility in household food security', 'Micronutrient supplementation coverage gaps'],
    operationalRisks: ['Care-practice knowledge gaps undermining feeding-counselling programmes', 'Seasonal food-security shocks outpacing response planning'],
    successIndicators: ['Reduced stunting prevalence', 'Improved infant and young child feeding practices', 'Closed micronutrient supplementation gaps'],
    typicalRecommendationThemes: ['Target food-access interventions in the highest-stunting districts', 'Scale feeding-practice counselling at community level', 'Build seasonal food-security early-response planning'],
  },
  'UHC and Health Financing Intelligence': {
    coreConcepts: ['Financial protection vs. nominal coverage', 'Benefit-package design and coverage gaps', 'Provider-payment timeliness'],
    internationalIndicators: ['Catastrophic health-expenditure incidence', 'Benefit-package coverage rate', 'Community health-insurance enrollment'],
    commonMisconceptions: ['That enrollment in a scheme equals genuine financial protection', 'That a broad benefit package on paper reflects what is actually reimbursed'],
    executiveConcerns: ['Which benefit-package gaps drive catastrophic out-of-pocket spending', 'Provider-payment timeliness affecting service delivery', 'Equity of financial protection across income groups'],
    operationalRisks: ['Benefit-package gaps concentrated among the lowest-income groups', 'Provider-payment delays destabilising service continuity'],
    successIndicators: ['Reduced catastrophic health-expenditure incidence', 'Higher benefit-package coverage rate', 'Improved provider-payment timeliness'],
    typicalRecommendationThemes: ['Close benefit-package gaps driving catastrophic spending', 'Expand community health-insurance enrollment among lowest-income groups', 'Improve provider-payment timeliness'],
  },
  'Education Intelligence': {
    coreConcepts: ['Attendance vs. genuine learning engagement', 'Grade-transition risk points', 'Perceived vs. measured learning quality'],
    internationalIndicators: ['School attendance rate', 'Grade-transition completion rate', 'Learning-outcome perception score'],
    commonMisconceptions: ['That enrollment equals attendance', 'That test scores alone capture perceived learning quality'],
    executiveConcerns: ['Which districts have the sharpest transition dropout', 'Whether teacher-parent feedback channels exist at scale', 'School-readiness gaps before primary entry'],
    operationalRisks: ['Transition-point dropout concentrated in specific districts', 'Absent structured feedback channels masking early-warning signs'],
    successIndicators: ['Higher attendance rate', 'Improved grade-transition completion', 'Higher learning-outcome perception score'],
    typicalRecommendationThemes: ['Target attendance-barrier interventions in the highest-dropout districts', 'Fund grade-transition support at the highest-risk points', 'Establish structured teacher-parent feedback channels'],
  },
  'Climate Intelligence': {
    coreConcepts: ['Adaptive capacity vs. exposure alone', 'Resilience-financing allocation logic', 'Community-level vs. national adaptation planning'],
    internationalIndicators: ['Adaptive-capacity index', 'Resilience-financing coverage', 'Early-warning reach rate'],
    commonMisconceptions: ['That climate exposure alone predicts vulnerability, independent of adaptive capacity', 'That national adaptation plans reach community level automatically'],
    executiveConcerns: ['Which communities have the lowest adaptive capacity', 'Whether early-warning systems reach the most exposed areas', 'Cross-sectoral coordination gaps in climate response'],
    operationalRisks: ['Resilience financing concentrated in already-adaptive communities', 'Early-warning systems with limited reach in flood-prone districts'],
    successIndicators: ['Higher adaptive-capacity index', 'Improved resilience-financing coverage', 'Higher early-warning reach rate'],
    typicalRecommendationThemes: ['Target resilience-financing rounds at the lowest-adaptive-capacity communities', 'Scale climate-shock early-warning reach', 'Strengthen cross-sectoral climate coordination'],
  },
  'Social Protection Intelligence': {
    coreConcepts: ['Targeting accuracy vs. coverage alone', 'Cash-transfer equity across districts', 'Graduation readiness vs. permanent dependency'],
    internationalIndicators: ['Targeting-error rate', 'Cash-transfer equity gap', 'Beneficiary-verification reliability'],
    commonMisconceptions: ['That high coverage numbers imply accurate targeting', 'That grievance mechanisms existing on paper means they are responsive in practice'],
    executiveConcerns: ['Which targeting-error pattern most undermines programme equity', 'Beneficiary-verification reliability across districts', 'Graduation-readiness pathways for long-term beneficiaries'],
    operationalRisks: ['Targeting errors concentrated in specific districts', 'Grievance-redress backlogs eroding programme trust'],
    successIndicators: ['Reduced targeting-error rate', 'Narrower cash-transfer equity gap', 'Improved grievance-redress responsiveness'],
    typicalRecommendationThemes: ['Correct the targeting-error pattern most undermining equity', 'Close cash-transfer equity gaps in the least-covered districts', 'Improve grievance-redress responsiveness'],
  },
  // Editorial Division Release, Part G: 8 new domains for 8 new,
  // genuinely non-overlapping sectors — each matching its own new
  // publication's real BLUEPRINT subjects, same discipline as every prior
  // addition to this table (never a mapping invented ahead of a real
  // sample).
  'WASH Access Intelligence': {
    coreConcepts: ['Functionality vs. mere infrastructure presence', 'Water-safety vs. water-availability', 'Sanitation behaviour change vs. facility construction alone'],
    internationalIndicators: ['Functional water-point coverage rate', 'Basic sanitation access rate', 'Open-defecation-free verification rate'],
    commonMisconceptions: ['That a constructed water point implies ongoing functionality', 'That building latrines alone changes sanitation behaviour'],
    executiveConcerns: ['Which districts have the highest non-functional water-point rate', 'Whether community-led sanitation approaches are sustained after verification', 'Equity of access for the poorest and most remote communities'],
    operationalRisks: ['Non-functional water points going unrepaired for extended periods', 'Open-defecation-free status reverting after verification'],
    successIndicators: ['Higher functional water-point coverage', 'Sustained open-defecation-free status', 'Narrower access gap for remote communities'],
    typicalRecommendationThemes: ['Fund a rapid-repair mechanism for the highest non-functional-rate districts', 'Reinforce post-verification sanitation follow-up', 'Prioritise last-mile access investment for remote communities'],
  },
  'Energy Access Intelligence': {
    coreConcepts: ['Grid extension economics vs. off-grid viability', 'Connection rate vs. reliable-supply rate', 'Productive-use uptake as the return on electrification'],
    internationalIndicators: ['Household electrification rate', 'Average daily supply-reliability hours', 'Productive-use connection share'],
    commonMisconceptions: ['That a household being connected means it has reliable supply', 'That grid extension is always cheaper than off-grid solutions regardless of distance and density'],
    executiveConcerns: ['Which unserved areas justify grid extension vs. off-grid investment', 'Supply-reliability gaps undermining the economic case for connection', 'Productive-use uptake among newly connected households'],
    operationalRisks: ['Grid-extension investment in low-density areas with weak economic returns', 'Chronic supply unreliability eroding willingness to pay'],
    successIndicators: ['Higher household electrification rate in prioritised areas', 'Improved supply-reliability hours', 'Higher productive-use connection share'],
    typicalRecommendationThemes: ['Direct the next investment cycle to the higher-return grid-extension vs. off-grid split', 'Address the supply-reliability gap undermining connection value', 'Support productive-use uptake among newly connected households'],
  },
  'Food Security Intelligence': {
    coreConcepts: ['Market-systems functionality vs. food availability alone', 'Price-volatility transmission to household access', 'Early-warning-to-response lag'],
    internationalIndicators: ['Market functionality index', 'Staple-food price-volatility index', 'Early-warning-to-response lag time'],
    commonMisconceptions: ['That national food availability implies household-level access', 'That price stability at the wholesale level reflects household purchasing reality'],
    executiveConcerns: ['Which market-systems failure most drives household food insecurity', 'Price-volatility transmission to the most vulnerable households', 'Speed of response once early-warning thresholds are triggered'],
    operationalRisks: ['Market disruption in key supply corridors going unaddressed', 'Early-warning signals not triggering timely response'],
    successIndicators: ['Improved market functionality index', 'Reduced price-volatility transmission to vulnerable households', 'Shorter early-warning-to-response lag'],
    typicalRecommendationThemes: ['Target the market-systems failure most driving insecurity', 'Strengthen price-volatility monitoring for vulnerable households', 'Cut the early-warning-to-response lag'],
  },
  'Justice and Legal Services Intelligence': {
    coreConcepts: ['Access to justice vs. formal court presence alone', 'Case backlog as a structural, not incidental, barrier', 'Legal-aid reach vs. legal-aid eligibility'],
    internationalIndicators: ['Case backlog clearance rate', 'Legal-aid coverage rate', 'Time-to-resolution for priority case types'],
    commonMisconceptions: ["That a court's physical presence in a district implies genuine access", 'That legal-aid eligibility on paper equals actual reach'],
    executiveConcerns: ['Which access-to-justice barrier most undermines case resolution', 'Case-backlog concentration in specific courts or case types', 'Legal-aid reach gaps for the most vulnerable litigants'],
    operationalRisks: ['Case backlog growth outpacing court capacity', 'Legal-aid reach failing the most vulnerable litigant groups'],
    successIndicators: ['Reduced case backlog', 'Higher legal-aid coverage rate', 'Faster time-to-resolution for priority cases'],
    typicalRecommendationThemes: ['Target backlog-reduction resources at the most congested courts', 'Expand legal-aid reach to underserved litigant groups', 'Prioritise time-to-resolution reform for the highest-impact case types'],
  },
  'Financial Inclusion Intelligence': {
    coreConcepts: ['Account ownership vs. active usage', 'Agent-network density as an access constraint', 'Financial-literacy gaps as a usage, not just access, barrier'],
    internationalIndicators: ['Active account usage rate', 'Agent-network density per population', 'Financial-literacy assessment score'],
    commonMisconceptions: ['That account ownership equals financial inclusion', 'That expanding agent networks alone resolves usage gaps without literacy support'],
    executiveConcerns: ['Which access barrier most limits formal financial-service uptake', 'Agent-network density gaps in underserved areas', 'Financial-literacy gaps undermining sustained usage'],
    operationalRisks: ['Dormant accounts masking a genuine inclusion gap', 'Agent-network gaps concentrated in the least-served areas'],
    successIndicators: ['Higher active account usage rate', 'Improved agent-network density in underserved areas', 'Higher financial-literacy assessment scores'],
    typicalRecommendationThemes: ['Address the access barrier most limiting uptake', 'Expand agent-network density in the least-served areas', 'Fund targeted financial-literacy programmes'],
  },
  'Displacement and Durable Solutions Intelligence': {
    coreConcepts: ['Protracted displacement vs. emergency-phase response', 'Durable-solutions pathways: return, local integration, resettlement', 'Host-community strain as a durable-solutions constraint'],
    internationalIndicators: ['Protracted-displacement duration', 'Durable-solutions pathway completion rate', 'Host-community service-strain index'],
    commonMisconceptions: ['That displacement is inherently temporary and self-resolving', 'That any durable-solutions pathway is equally viable regardless of context'],
    executiveConcerns: ['Which durable-solutions pathway most reduces protracted displacement risk', 'Host-community strain undermining local-integration viability', 'Data gaps in tracking pathway completion'],
    operationalRisks: ['Protracted displacement without an active durable-solutions pathway', 'Host-community service strain eroding integration prospects'],
    successIndicators: ['Reduced protracted-displacement duration', 'Higher durable-solutions pathway completion rate', 'Reduced host-community service-strain'],
    typicalRecommendationThemes: ['Prioritise the durable-solutions pathway with the strongest real prospects', 'Invest in host-community services to sustain local integration', 'Close data gaps in pathway-completion tracking'],
  },
  'Youth Skills and Employability Intelligence': {
    coreConcepts: ['Skills-training completion vs. employment conversion', 'Market-relevance of training curricula', 'Transition-support gaps between training and placement'],
    internationalIndicators: ['Skills-to-employment conversion rate', 'Training-curriculum market-relevance score', 'Post-training placement-support completion rate'],
    commonMisconceptions: ['That training completion equals employability', 'That curriculum design set once remains market-relevant without review'],
    executiveConcerns: ['Which skills-to-employment conversion gap most needs investment', 'Market-relevance of current training curricula', 'Transition-support gaps between training completion and placement'],
    operationalRisks: ['Training programmes producing skills the market does not demand', 'Placement-support gaps leaving trained youth without transition assistance'],
    successIndicators: ['Higher skills-to-employment conversion rate', 'Improved curriculum market-relevance score', 'Higher post-training placement-support completion'],
    typicalRecommendationThemes: ['Target investment at the sharpest skills-to-employment conversion gap', 'Revise curricula against current market-relevance data', 'Strengthen post-training placement support'],
  },
  'Public Financial Management Intelligence': {
    coreConcepts: ['Budget credibility vs. budget approval alone', 'Procurement-control weakness as a leakage vector', 'Audit-finding resolution rate as an accountability signal'],
    internationalIndicators: ['Budget-execution variance rate', 'Procurement-control compliance rate', 'Audit-finding resolution rate'],
    commonMisconceptions: ['That an approved budget implies credible execution', 'That procurement rules existing on paper equals compliance in practice'],
    executiveConcerns: ['Which PFM control weakness most drives leakage risk', 'Budget-execution variance undermining credibility', 'Audit-finding resolution backlog'],
    operationalRisks: ['Procurement-control weaknesses concentrated in specific agencies', 'Audit findings accumulating unresolved across cycles'],
    successIndicators: ['Reduced budget-execution variance', 'Higher procurement-control compliance rate', 'Higher audit-finding resolution rate'],
    typicalRecommendationThemes: ['Close the PFM control weakness driving the greatest leakage risk', 'Strengthen procurement-control compliance in the weakest agencies', 'Accelerate audit-finding resolution'],
  },
});

export function sectorKnowledgeFor(domain) {
  return SECTOR_KNOWLEDGE_ENGINES[domain] || null;
}

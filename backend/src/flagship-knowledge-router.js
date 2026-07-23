// Global Knowledge Router — PX Release 9 (Global Knowledge Intelligence
// System), Parts 1 and 3.
//
// Pure deterministic routing. No LLM reasoning, no fabricated categories:
// every value this module returns is either a direct real field already
// on a flagship sample (sector, profile, tier), or a fixed, documented
// lookup from that real field onto a small, named set of categories —
// the same kind of categorical relabeling flagship-standards-engine.js
// already does for profile-to-framework applicability. This module adds
// the SECTOR axis that engine does not cover (it routes by profile —
// government/donor/humanitarian/research — not by sector — health,
// agriculture, governance), so the two are complementary, not duplicates.
//
// Scope note (Part 9, honestly stated up front, kept general rather than an
// exhaustive list that would drift every time a sector is added or
// re-sectored): DOMAIN_BY_SECTOR below maps every sector that has a real
// governed flagship sample onto a real Knowledge Engine domain
// (flagship-sector-knowledge.js) — never a mapping invented ahead of a real
// sample. Adding a genuinely new sector later only requires adding one row
// here and one engine there (Part 9), never a renderer or architecture
// change. The exact current sector list is FLAGSHIP_SAMPLE_REPORTS'
// distinct `sector` values (flagship-sample-library.js) — read from there,
// not from this comment.
export const FLAGSHIP_KNOWLEDGE_ROUTER_VERSION = 'flagship-knowledge-router-v1';

export const DOMAIN_BY_SECTOR = Object.freeze({
  'Primary Healthcare': 'Health Intelligence',
  'Health Systems': 'Health Intelligence',
  'Agricultural Resilience': 'Agriculture Intelligence',
  'Integrated Livelihoods': 'Livelihood Intelligence',
  'Youth Economic Inclusion': 'Livelihood Intelligence',
  'Public Service Delivery': 'Governance Intelligence',
  'Citizen Feedback': 'Governance Intelligence',
  'Humanitarian Response': 'Humanitarian Intelligence',
  'Enterprise Performance': 'Private Sector Intelligence',
  'Human Development': 'Economic Development Intelligence',
  'Regional Development': 'Economic Development Intelligence',
  'Programme Delivery': 'Economic Development Intelligence',
  'Sustainable Development': 'Sustainable Development Intelligence',
  // Sector Intelligence Platform, Health Intelligence Suite: five new Health
  // sub-domains, added only for the sectors this session's new flagship
  // publications actually use — not speculatively for sectors with no real
  // sample yet. 'Primary Healthcare'/'Health Systems' above keep resolving
  // to the pre-existing 'Health Intelligence' domain unchanged.
  'Hospital Performance': 'Hospital Performance Intelligence',
  'Maternal and Child Health': 'Maternal & Child Health Intelligence',
  'Disease Surveillance': 'Disease Surveillance Intelligence',
  'Nutrition Security': 'Nutrition Intelligence',
  'Health Financing and Insurance': 'UHC and Health Financing Intelligence',
  // Release Candidate 1: three new domains closing the genuinely missing
  // Minimum Sellable Library segments (Education, Climate, Social
  // Protection) — see docs cited in flagship-sample-library.js's own
  // BLUEPRINTS comment for this tranche.
  'Education Access and Learning Quality': 'Education Intelligence',
  'Climate Adaptation': 'Climate Intelligence',
  'Social Protection': 'Social Protection Intelligence',
  // Enterprise Market Validation Release, Part C: three previously-adjacent
  // sectors re-sectored to be genuinely sector-literal (their content —
  // customer journey/loyalty/service-recovery, engagement/retention/
  // culture, market segmentation/growth/opportunity — was already about
  // these exact domains; only the sector LABEL was adjacent, e.g. "Digital
  // Financial Services" for a publication about market intelligence in
  // general) — plus one genuinely new sector with no prior sample.
  'Customer Experience': 'Customer Experience Intelligence',
  'Employee Experience': 'Employee Experience Intelligence',
  'Market Research': 'Market Research Intelligence',
  'Digital Government Services': 'Digital Government Intelligence',
  // Editorial Division Release, Part G: 8 new domains for 8 genuinely
  // non-overlapping new sectors — same discipline as every prior addition,
  // one row here matched by one Knowledge Engine in flagship-sector-
  // knowledge.js, added only for sectors with a real new sample.
  'WASH Access': 'WASH Access Intelligence',
  'Energy Access': 'Energy Access Intelligence',
  'Food Security': 'Food Security Intelligence',
  'Justice and Legal Services': 'Justice and Legal Services Intelligence',
  'Financial Inclusion': 'Financial Inclusion Intelligence',
  'Displacement and Durable Solutions': 'Displacement and Durable Solutions Intelligence',
  'Youth Skills and Employability': 'Youth Skills and Employability Intelligence',
  'Public Financial Management': 'Public Financial Management Intelligence',
});
const DEFAULT_DOMAIN = 'Economic Development Intelligence';

// category is one of the 5 real values already on every FLAGSHIP_SAMPLE_
// REPORTS entry (Government, UN & Donors, NGOs, Corporate, Research) —
// relabeled to a publication-type name, not a new fabricated field.
const PUBLICATION_TYPE_BY_CATEGORY = Object.freeze({
  'Government': 'Policy Intelligence Publication',
  'UN & Donors': 'Development Effectiveness Publication',
  'NGOs': 'Programme Accountability Publication',
  'Corporate': 'Executive Performance Publication',
  'Research': 'Technical Research Publication',
});
const EVIDENCE_MATURITY_BY_CATEGORY = Object.freeze({
  'Government': 'Operationally governed',
  'UN & Donors': 'Operationally governed',
  'NGOs': 'Operationally governed',
  'Corporate': 'Operationally governed',
  'Research': 'Methodologically rigorous',
});
// sample.tier is already real (index<4 -> 1, index<11 -> 2, else 3, set in
// flagship-sample-library.js's definition()) — relabeled to a decision
// level, not recomputed from anything new.
const DECISION_LEVEL_BY_TIER = Object.freeze({
  1: 'Strategic / National',
  2: 'Operational / Institutional',
  3: 'Analytical / Technical',
});

// Routes a report BEFORE generation begins — takes only `sample` (the
// static catalog entry: sector, category, profile, tier), never findings
// or recommendations, because routing must be decidable before any of
// that text exists.
export function routeKnowledge(sample) {
  const domain = DOMAIN_BY_SECTOR[sample.sector] || DEFAULT_DOMAIN;
  return {
    sector: sample.sector,
    domain,
    publicationType: PUBLICATION_TYPE_BY_CATEGORY[sample.category] || 'General Intelligence Publication',
    audience: sample.profile,
    decisionLevel: DECISION_LEVEL_BY_TIER[sample.tier] || 'Operational / Institutional',
    evidenceMaturity: EVIDENCE_MATURITY_BY_CATEGORY[sample.category] || 'Operationally governed',
  };
}

// ------------------------------------------------------------------
// Part 3: International Framework Engine — sector-aware. Complements
// flagship-standards-engine.js's standardsFor() (profile-aware, already
// wired to report.framework_applicability) rather than replacing it.
// Every framework named below is a real, publicly documented
// international standard genuinely associated with that domain; every
// entry states WHY it applies so nothing renders as a decorative badge
// list — the same discipline the existing standards engine already
// follows.
// ------------------------------------------------------------------
export const FRAMEWORKS_BY_DOMAIN = Object.freeze({
  'Health Intelligence': [
    { id: 'WHO_HEALTH_SYSTEMS', name: 'WHO Health Systems Framework', rationale: 'Assesses service delivery, health workforce, information systems, medical products, financing and leadership/governance as one connected system, not isolated indicators.' },
    { id: 'UHC', name: 'Universal Health Coverage', rationale: 'Tests whether populations can access needed services without financial hardship — the standard reference point for health-access findings.' },
  ],
  'Agriculture Intelligence': [
    { id: 'FAO_FOOD_SYSTEMS', name: 'FAO Sustainable Food Systems Framework', rationale: 'Frames agricultural findings across production, resilience and livelihoods rather than yield alone.' },
    { id: 'CLIMATE_RESILIENT_AG', name: 'Climate-Resilient Agriculture Principles', rationale: 'Agricultural resilience findings are read against adaptive capacity, not a single-season result.' },
  ],
  'Livelihood Intelligence': [
    { id: 'ILO_DECENT_WORK', name: 'ILO Decent Work Agenda', rationale: 'Livelihood and economic-inclusion findings are benchmarked against employment quality, not participation counts alone.' },
    { id: 'SDG_8', name: 'SDG 8 — Decent Work and Economic Growth', rationale: 'The most directly applicable SDG target for livelihood and youth economic inclusion findings.' },
  ],
  'Governance Intelligence': [
    { id: 'SDG_16', name: 'SDG 16 — Peace, Justice and Strong Institutions', rationale: 'Public service delivery and citizen feedback findings map directly to institutional accountability targets.' },
    { id: 'PFM', name: 'Public Financial Management Principles', rationale: 'Government-facing budget and implementation recommendations are read against standard PFM discipline.' },
  ],
  'Humanitarian Intelligence': [
    { id: 'SPHERE', name: 'Sphere Standards', rationale: 'Minimum standards for humanitarian response quality — the reference point for severity and response-priority findings.' },
    { id: 'CHS', name: 'Core Humanitarian Standard', rationale: 'Accountability to crisis-affected people is assessed against CHS commitments, not internal delivery metrics alone.' },
  ],
  'Private Sector Intelligence': [
    { id: 'OECD_MNE', name: 'OECD Guidelines for Multinational Enterprises', rationale: 'Enterprise-performance recommendations are read against recognised responsible-business conduct expectations.' },
  ],
  'Economic Development Intelligence': [
    { id: 'HDI_CONCEPT', name: 'Human Development Index Framing', rationale: 'Multi-sectoral development findings are read across health, education and income dimensions together, the same lens the HDI itself uses.' },
    { id: 'SDG_10', name: 'SDG 10 — Reduced Inequalities', rationale: 'Regional and distributional findings map directly to this target.' },
  ],
  'Sustainable Development Intelligence': [
    { id: 'SDGS', name: 'Sustainable Development Goals', rationale: 'The direct, named frame for this sector — findings are explicitly SDG-contribution evidence, not a general performance report.' },
    { id: 'AU_AGENDA_2063', name: 'African Union Agenda 2063', rationale: 'Continental development priorities give the SDG contribution a regional policy anchor.' },
  ],
  'Hospital Performance Intelligence': [
    { id: 'WHO_PATIENT_SAFETY', name: 'WHO Global Patient Safety Action Plan', rationale: 'Facility-level safety and capacity findings are read against the internationally recognised patient-safety action framework, not an internal quality metric alone.' },
    { id: 'UHC', name: 'Universal Health Coverage', rationale: 'Hospital capacity constraints are ultimately an access-to-care question, the same lens UHC applies at referral level.' },
  ],
  'Maternal & Child Health Intelligence': [
    { id: 'ENAP', name: 'Every Newborn Action Plan', rationale: 'Maternal-newborn continuity findings map directly to this framework’s continuum-of-care standard.' },
    { id: 'SDG_3', name: 'SDG 3 — Good Health and Well-Being', rationale: 'Under-five and maternal mortality targets are the direct international reference point for this domain.' },
  ],
  'Disease Surveillance Intelligence': [
    { id: 'IHR_2005', name: 'International Health Regulations (2005)', rationale: 'Core surveillance and reporting-capacity obligations are defined by this binding international framework, the standard reference for outbreak-readiness findings.' },
  ],
  'Nutrition Intelligence': [
    { id: 'SUN_MOVEMENT', name: 'Scaling Up Nutrition (SUN) Movement Framework', rationale: 'Multi-sectoral stunting and nutrition-security findings are benchmarked against the SUN Movement’s convergence approach, not a single-sector metric.' },
    { id: 'SDG_2', name: 'SDG 2 — Zero Hunger', rationale: 'The direct international target for nutrition-security and food-access findings.' },
  ],
  'UHC and Health Financing Intelligence': [
    { id: 'UHC', name: 'Universal Health Coverage', rationale: 'Financial-protection and benefit-package findings are the core UHC test: access to needed services without financial hardship.' },
    { id: 'PFM', name: 'Public Financial Management Principles', rationale: 'Provider-payment timeliness and benefit-package financing recommendations are read against standard PFM discipline, consistent with how this engine already applies PFM to Governance Intelligence.' },
  ],
  'Education Intelligence': [
    { id: 'SDG_4', name: 'SDG 4 — Quality Education', rationale: 'The direct international target for attendance, transition and learning-outcome findings.' },
    { id: 'UNESCO_LEARNING', name: 'UNESCO Learning Framework', rationale: 'Frames learning-outcome findings across access, quality and equity dimensions, not test scores alone.' },
  ],
  'Climate Intelligence': [
    { id: 'SDG_13', name: 'SDG 13 — Climate Action', rationale: 'The direct international target for adaptive-capacity and resilience-financing findings.' },
    { id: 'PARIS_ADAPTATION', name: 'Paris Agreement Global Goal on Adaptation', rationale: 'Community-level adaptation findings are read against the global adaptation goal, not a single-project outcome.' },
  ],
  'Social Protection Intelligence': [
    { id: 'SDG_1', name: 'SDG 1 — No Poverty', rationale: 'Cash-transfer and targeting findings are the direct mechanism for reducing extreme poverty, the reference point SDG 1 sets.' },
    { id: 'ILO_SPF', name: 'ILO Social Protection Floors Recommendation', rationale: 'Targeting and coverage findings are benchmarked against the internationally recognised minimum social-protection guarantee.' },
  ],
  // Enterprise Market Validation Release, Part C.
  'Customer Experience Intelligence': [
    { id: 'ISO_10002', name: 'ISO 10002 — Complaints Handling Guidelines', rationale: 'Service-recovery and complaint-handling findings are benchmarked against the internationally recognised standard for this exact discipline.' },
    { id: 'ISO_9001', name: 'ISO 9001 — Quality Management Systems', rationale: 'Customer-journey and loyalty findings sit within the broader quality-management discipline this standard governs.' },
  ],
  'Employee Experience Intelligence': [
    { id: 'ILO_LABOUR_STANDARDS', name: 'ILO Labour Standards', rationale: 'Engagement and retention findings are benchmarked against internationally recognised labour standards, not an internal HR metric alone.' },
    { id: 'ISO_30414', name: 'ISO 30414 — Human Capital Reporting Guidelines', rationale: 'Engagement, retention and culture findings map directly to this standard’s named human-capital reporting metrics.' },
  ],
  'Market Research Intelligence': [
    { id: 'ISO_20252', name: 'ISO 20252 — Market, Opinion and Social Research', rationale: 'Segmentation and opportunity findings are benchmarked against the internationally recognised service-quality standard for market research.' },
    { id: 'ESOMAR_CODE', name: 'ESOMAR International Code on Market Research', rationale: 'Methodology and respondent-treatment findings are read against the leading international professional standard for this discipline.' },
  ],
  'Digital Government Intelligence': [
    { id: 'OECD_DIGITAL_GOV', name: 'OECD Digital Government Policy Framework', rationale: 'Citizen-facing digital service findings are benchmarked against the internationally recognised framework for digital government maturity.' },
    { id: 'UN_EGDI', name: 'UN E-Government Development Index', rationale: 'Adoption and trust findings are read against the standard UN DESA reference point for digital government performance.' },
  ],
  // Editorial Division Release, Part G.
  'WASH Access Intelligence': [
    { id: 'SDG_6', name: 'SDG 6 — Clean Water and Sanitation', rationale: 'Functional water-point and sanitation-access findings are the direct international target this sector reports against.' },
    { id: 'WHO_UNICEF_JMP', name: 'WHO/UNICEF Joint Monitoring Programme for Water Supply, Sanitation and Hygiene', rationale: 'Coverage and service-ladder classification (basic, limited, surface water) follow the JMP standard, the internationally recognised reference for WASH monitoring.' },
  ],
  'Energy Access Intelligence': [
    { id: 'SDG_7', name: 'SDG 7 — Affordable and Clean Energy', rationale: 'Electrification-rate and reliable-supply findings are the direct international target for this sector.' },
    { id: 'MULTI_TIER_FRAMEWORK', name: 'World Bank ESMAP Multi-Tier Framework for Energy Access', rationale: 'Reliability and capacity findings are benchmarked against the internationally recognised multi-tier definition of energy access, not connection status alone.' },
  ],
  'Food Security Intelligence': [
    { id: 'SDG_2', name: 'SDG 2 — Zero Hunger', rationale: 'Market-systems and household-access findings are the direct international target for food-security outcomes.' },
    { id: 'IPC', name: 'Integrated Food Security Phase Classification', rationale: 'Severity findings are classified against the IPC scale, the internationally recognised standard for food-insecurity phase classification.' },
  ],
  'Justice and Legal Services Intelligence': [
    { id: 'SDG_16', name: 'SDG 16 — Peace, Justice and Strong Institutions', rationale: 'Access-to-justice and case-resolution findings are the direct international target this sector reports against (Target 16.3).' },
    { id: 'WJP_RULE_OF_LAW_INDEX', name: 'World Justice Project Rule of Law Index', rationale: 'Access-to-justice and court-performance findings are benchmarked against the leading internationally recognised rule-of-law measurement framework.' },
  ],
  'Financial Inclusion Intelligence': [
    { id: 'SDG_8', name: 'SDG 8 — Decent Work and Economic Growth', rationale: 'Financial-access findings connect directly to Target 8.10 — expanding access to banking, insurance and financial services.' },
    { id: 'AFI_MAYA_DECLARATION', name: 'Alliance for Financial Inclusion Maya Declaration', rationale: 'Access and usage findings are read against the leading global policy commitment framework for measurable financial inclusion targets.' },
  ],
  'Displacement and Durable Solutions Intelligence': [
    { id: 'UNHCR_CRRF', name: 'UNHCR Comprehensive Refugee Response Framework', rationale: 'Durable-solutions pathway findings are structured against the internationally recognised framework for a coordinated refugee response.' },
    { id: 'IASC_DURABLE_SOLUTIONS', name: 'IASC Framework on Durable Solutions for Internally Displaced Persons', rationale: 'Return, integration and resettlement findings are benchmarked against the standard inter-agency durable-solutions criteria.' },
  ],
  'Youth Skills and Employability Intelligence': [
    { id: 'SDG_8', name: 'SDG 8 — Decent Work and Economic Growth', rationale: 'Skills-to-employment findings connect directly to Target 8.6 — substantially reducing the share of youth not in employment, education or training.' },
    { id: 'ILO_DECENT_JOBS_YOUTH', name: 'ILO Global Initiative on Decent Jobs for Youth', rationale: 'Curriculum-relevance and placement-support findings are benchmarked against the leading international youth-employment initiative.' },
  ],
  'Public Financial Management Intelligence': [
    { id: 'PEFA', name: 'Public Expenditure and Financial Accountability Framework', rationale: 'Budget-credibility and control-weakness findings are structured against PEFA, the internationally recognised standard for PFM performance assessment.' },
    { id: 'SDG_16', name: 'SDG 16 — Peace, Justice and Strong Institutions', rationale: 'Control-weakness and leakage-risk findings connect directly to Target 16.6 — developing effective, accountable and transparent institutions.' },
  ],
});

export function frameworksForDomain(domain) {
  return FRAMEWORKS_BY_DOMAIN[domain] || [];
}

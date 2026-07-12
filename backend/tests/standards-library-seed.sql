INSERT INTO standards_library (id, full_name, applies_when, citation_guidance) VALUES

('SDG', 'Sustainable Development Goals', 'Applies broadly across nearly all development, humanitarian, governance, and social-sector report types (Health, Education, Agriculture, Livelihood, Humanitarian, Baseline, Endline, Monitoring, Quarterly, Annual, Citizen Feedback, Community Scorecard, SDG Progress). Does NOT apply to private-sector commercial reports (Market Research, Customer Satisfaction, Employee Engagement) unless the client explicitly operates a CSR/ESG programme with stated SDG alignment.',
 'Reference the SPECIFIC goal and target number when a finding maps clearly (e.g. "consistent with SDG 3.8 on universal health coverage"), never a vague "supports the SDGs" claim. Never claim a survey demonstrates SDG ACHIEVEMENT — only that findings are RELEVANT to or CONSISTENT WITH a specific target.'),

('OECD-DAC', 'OECD Development Assistance Committee Evaluation Criteria', 'Applies to Baseline, Endline, Midline, Annual Impact, and any formal programme evaluation report type. Rarely applies to routine Monitoring Reports or single-round Citizen Feedback/Community Scorecard exercises unless they are explicitly framed as a formal evaluation.',
 'Reference by the specific criterion (Relevance, Coherence, Effectiveness, Efficiency, Impact, Sustainability) rather than "OECD-DAC compliant" as a blanket claim. A single survey round can typically speak to only 2-3 of the 6 criteria — never claim all 6 are addressed by one data collection round.'),

('WHO', 'World Health Organization Guidance', 'Applies specifically to Health Survey, Nutrition Assessment, and WASH Assessment report types. Does not apply to Education, Agriculture, or general governance reports even if health-adjacent topics are mentioned in passing.',
 'Reference specific WHO guidance areas (e.g. "consistent with WHO recommendations on facility-level wait times") rather than a generic "WHO-aligned" label. Never invent a specific WHO guideline number or document title not independently verified.'),

('Sphere', 'Sphere Humanitarian Standards', 'Applies specifically to Humanitarian Needs Assessment and any WASH/shelter/food-security report explicitly conducted in a humanitarian response context. Does not apply to development-context reports even in the same sector (e.g. a development-context WASH report should NOT cite Sphere).',
 'Reference the specific Sphere minimum standard area (e.g. shelter, water quantity, food security) being assessed against, and be explicit when a finding indicates the standard was NOT met — Sphere citation is only credible when both successes and shortfalls are reported transparently.'),

('CHS', 'Core Humanitarian Standard', 'Applies to Humanitarian Needs Assessment and any report assessing accountability-to-affected-populations, complaint mechanisms, or community feedback in a humanitarian or governance context (also relevant to Citizen Feedback and Community Scorecard).',
 'Reference the specific CHS Commitment number (e.g. Commitment 4: timely and effective response; Commitment 1: appropriate to needs) rather than a blanket "CHS compliant" statement. CHS citation requires reporting shortfalls transparently, not only successes.'),

('RBM', 'Results-Based Management', 'Applies to Baseline, Midline, Endline, Annual Impact, and Quarterly Performance reports specifically — any report type that exists within a tracked Results Framework across multiple rounds.',
 'Reference the specific results-chain level (output, outcome, or impact) a finding speaks to. A single survey round typically provides output- or outcome-level evidence, not impact-level evidence — never overclaim impact attribution from one round.'),

('Logical Framework', 'Logframe / LogFrame Matrix', 'Applies to the same report types as RBM (Baseline, Midline, Endline, Annual Impact) when the underlying programme explicitly uses a logframe rather than a broader Theory of Change / Results Framework format.',
 'Reference specific logframe indicator language where available (e.g. "Indicator 2.1: % of households reporting improved access"). Do not invent logframe indicator numbers not provided in the underlying programme documentation.'),

('Theory of Change', 'Theory of Change', 'Applies to Baseline (establishing the assumptions the ToC will be tested against) and Endline (assessing whether the ToC''s assumed causal pathway held) specifically.',
 'Reference the specific causal assumption or pathway a finding supports or challenges, rather than a vague "supports the Theory of Change" statement. Endline reports should explicitly note where evidence CHALLENGES an assumed pathway, not only where it confirms one.'),

('World Bank Results Framework', 'World Bank Results Framework', 'Applies to Livelihood Assessment, Agriculture Survey, and Financial Inclusion report types specifically, where World Bank-financed or -aligned programmes are common.',
 'Reference specific indicator categories (e.g. "Intermediate Results Indicator") where the underlying programme structure is known to use this framework. Do not assume World Bank framework applicability without contextual basis from the report''s metadata.'),

('National Statistics Guidelines', 'National Bureau/Statistics Office Guidelines', 'Applies to any report type when survey methodology, sampling, or data quality sections reference alignment with a specific country''s national statistics standards (most relevant to SDG Progress and Citizen Feedback reports at national scale).',
 'Reference the specific country''s statistics office by name only when the report''s metadata confirms the country context (e.g. "Tanzania National Bureau of Statistics household survey guidance") — never assume a specific national standard without that contextual confirmation.');

INSERT INTO audience_writing_standards (style_id, paragraph_length_guidance, vocabulary_level, chart_density, recommendation_style, structure_notes) VALUES

('executive_board', 'Very short — 2-4 sentences per paragraph maximum. Every paragraph should be readable in under 10 seconds. Lead with the conclusion, never bury it.',
 'Plain business English. Zero technical jargon, zero M&E terminology (no "logframe", "theory of change", "disaggregation" — say "plan", "how change happens", "broken down by").',
 'Low — one KPI-card summary visual per major section maximum. Never more than 1 chart per page-equivalent. No statistical tables in the main body.',
 'Single-line, decision-framed recommendations only (e.g. "Approve X", "Fund Y", "Stop Z"). No sub-bullets, no methodology caveats attached.',
 'Front-load everything: the single most important number/decision must appear in the first sentence of the document, not the third paragraph.'),

('un_agency', 'Moderate — 4-6 sentences per paragraph, allowing room for standards-referenced context (SDG target numbers, results-framework language) without becoming dense.',
 'Formal, technical-but-precise. RBM/logframe terminology is expected and should be used correctly (outputs vs. outcomes vs. impact), not simplified away.',
 'Moderate-to-high — cross-tabulations and trend charts are expected; a report with only KPI cards will read as insufficiently rigorous for this audience.',
 'Structured by results-framework tier (output-level vs. outcome-level recommendations kept explicitly separate), each tied to a specific indicator where possible.',
 'Follow a Results-Framework-aligned structure: findings organized by outcome area, not just by survey section order.'),

('government', 'Moderate — 3-5 sentences, favoring concrete service-delivery language over abstract framing.',
 'Formal but accessible to a non-technical Permanent Secretary — avoid academic jargon, but retain policy/budget-relevant precision (e.g. distinguish "requires new budget line" from "operational fix").',
 'Moderate — regional/district maps and comparison bar charts are highly valued by this audience (geographic equity is often a political concern); avoid overly technical chart types (no scatter plots, no radar charts).',
 'Explicitly tagged by whether each recommendation requires new budget allocation vs. is achievable within existing operational capacity.',
 'Structure around administrative geography (region/district) wherever the data supports it, since this audience typically manages resources along those lines.'),

('donor', 'Moderate — 4-6 sentences, with explicit space given to limitations and data-quality caveats (donors specifically distrust reports that omit these).',
 'Formal, accountability-focused. Use precise, hedged language for uncertain findings ("the data suggests" not "the data proves") rather than donor-facing confidence-inflation.',
 'High — donors expect thorough visual evidence (trend lines, benchmark comparisons, data quality indicators) as substantiation, not just narrative claims.',
 'Each recommendation should note estimated cost implication and expected measurable outcome, since donor decision-making is resource-allocation-focused.',
 'Always include a visible Data Quality / Confidence section — never omit or minimize this for a donor audience, even when findings are otherwise strongly positive.'),

('academic_research', 'Longer, more technical — 5-8 sentences, allowing full methodological qualification within each paragraph rather than deferring all caveats to a single limitations section.',
 'Technical, precise, hedged. Explicit confidence levels and statistical caveats are required, not optional. Avoid promotional or advocacy-toned language entirely.',
 'High — full statistical tables, cross-tabulations, and methodology diagrams are expected; a report lacking these will read as insufficiently rigorous.',
 'Recommendations should be framed as implications for future research and practice, explicitly distinguished from policy recommendations, which belong in a separate section if included at all.',
 'Methodology, sampling, and limitations sections must be unusually detailed relative to other audiences — this audience will scrutinize these sections specifically.'),

('corporate', 'Short-to-moderate — 3-5 sentences, direct and business-outcome-focused.',
 'Direct, commercial language. Frame everything in terms of business impact, ROI, customer/employee experience — avoid development-sector terminology entirely (no "beneficiaries", no "theory of change").',
 'Moderate — favor clean KPI cards and simple trend lines over complex statistical visualizations; this audience wants clarity and speed, not analytical depth on the page.',
 'Each recommendation should have a clear owner and a business-outcome framing (e.g. "reduces churn", "improves NPS"), not a development-sector framing.',
 'Structure around business functions or channels (e.g. by product line, by customer segment) rather than by demographic/geographic breakdown unless directly relevant.'),

('public_summary', 'Very short — 2-3 sentences per paragraph, plain and direct.',
 'Simple, everyday language. No statistical terminology, no percentages presented without a plain-language translation (e.g. "just over half" alongside "54%"), no acronyms without immediate explanation.',
 'Very low — at most one simple, clearly-labeled chart for the whole document; prefer plain-language statements over visual data density.',
 'Framed entirely around real-world impact on people, never around institutional or budget process language.',
 'Should read like a short news article, not a report — lead with what changed for real people, not with methodology or institutional framing.');

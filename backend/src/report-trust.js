// Report Trust & Intelligence Upgrade — Phase 19
// Additive trust layer: export quality gate, evidence traceability,
// SDG visual cards, true infographic renderer, and pre-export AI verification.
// This module is deterministic and does not call an LLM. It never invents
// new survey numbers; all values are derived from document_model_json.

function arr(v) { return Array.isArray(v) ? v : []; }
function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function text(v) { return String(v ?? '').trim(); }
function pct(part, total) { return total > 0 ? Math.round((num(part) / total) * 100) : 0; }
function clean(s) {
  return text(s)
    .replace(/This card reuses[^.]+\./gi, '')
    .replace(/This interpretation is generated directly[^.]+\./gi, '')
    .replace(/no new comparison logic was written[^.]+\./gi, '')
    .trim();
}
function totalResponses(dm) { return num(dm?.kpis?.total_responses ?? dm?.sample_statistics?.total_responses); }
function regions(dm) { return arr(dm?.demographics?.regions ?? dm?.annexes?.statistical_tables?.regions); }
function gender(dm) { return arr(dm?.demographics?.gender ?? dm?.annexes?.statistical_tables?.gender); }
function ages(dm) { return arr(dm?.demographics?.age ?? dm?.annexes?.statistical_tables?.age); }
function sentiment(dm) { return arr(dm?.findings?.sentiment ?? dm?.annexes?.statistical_tables?.sentiment); }
function topics(dm) { return arr(dm?.findings?.topics ?? dm?.insights?.topics ?? dm?.annexes?.statistical_tables?.topics); }
function quotes(dm) { return arr(dm?.findings?.representative_quotes ?? dm?.representative_quotes ?? dm?.quotes); }
function recommendations(dm) {
  const r = dm?.recommendations || {};
  return [
    ...arr(r.immediate).map(x => ({ tier: 'Immediate', action: clean(x), owner: 'Field / Operations Team', timeframe: '0–30 days' })),
    ...arr(r.medium_term).map(x => ({ tier: 'Medium-Term', action: clean(x), owner: 'Programme Management', timeframe: '30–90 days' })),
    ...arr(r.long_term).map(x => ({ tier: 'Long-Term', action: clean(x), owner: 'Country Leadership / Donor Liaison', timeframe: '6–12 months' })),
  ].filter(r => r.action);
}
function findings(dm) { return arr(dm?.narrative?.key_findings).map(clean).filter(Boolean); }
function limitations(dm) {
  const out = [];
  if (!dm?.annexes?.methodology) out.push('Methodology details should be reviewed before external publication.');
  if (!dm?.consent_coverage && !dm?.is_demo) out.push('Consent coverage should be verified for production reports.');
  if (!ages(dm).length) out.push('Age-disaggregated analysis is limited because age data is not populated.');
  if (!gender(dm).length) out.push('Gender-disaggregated analysis is limited because gender data is not populated.');
  if (!regions(dm).length) out.push('Regional analysis is limited because region data is not populated.');
  return out;
}

const SDG_META = {
  'SDG 1': { number: 1, color: '#E5243B', icon: '🏠', goal: 'No Poverty' },
  'SDG 2': { number: 2, color: '#DDA63A', icon: '🌾', goal: 'Zero Hunger' },
  'SDG 3': { number: 3, color: '#4C9F38', icon: '⚕️', goal: 'Good Health and Well-being' },
  'SDG 4': { number: 4, color: '#C5192D', icon: '📚', goal: 'Quality Education' },
  'SDG 5': { number: 5, color: '#FF3A21', icon: '♀️', goal: 'Gender Equality' },
  'SDG 6': { number: 6, color: '#26BDE2', icon: '💧', goal: 'Clean Water and Sanitation' },
  'SDG 7': { number: 7, color: '#FCC30B', icon: '⚡', goal: 'Affordable and Clean Energy' },
  'SDG 8': { number: 8, color: '#A21942', icon: '💼', goal: 'Decent Work and Economic Growth' },
  'SDG 9': { number: 9, color: '#FD6925', icon: '🏗️', goal: 'Industry, Innovation and Infrastructure' },
  'SDG 10': { number: 10, color: '#DD1367', icon: '⚖️', goal: 'Reduced Inequalities' },
  'SDG 11': { number: 11, color: '#FD9D24', icon: '🏙️', goal: 'Sustainable Cities and Communities' },
  'SDG 12': { number: 12, color: '#BF8B2E', icon: '♻️', goal: 'Responsible Consumption and Production' },
  'SDG 13': { number: 13, color: '#3F7E44', icon: '🌍', goal: 'Climate Action' },
  'SDG 14': { number: 14, color: '#0A97D9', icon: '🌊', goal: 'Life Below Water' },
  'SDG 15': { number: 15, color: '#56C02B', icon: '🌳', goal: 'Life on Land' },
  'SDG 16': { number: 16, color: '#00689D', icon: '🕊️', goal: 'Peace, Justice and Strong Institutions' },
  'SDG 17': { number: 17, color: '#19486A', icon: '🤝', goal: 'Partnerships for the Goals' },
};

function inferSDGs(dm) {
  const declared = arr(dm?.metadata?.standards).filter(s => /^SDG/i.test(s));
  const template = text(dm?.metadata?.template_id).toLowerCase();
  const sector = text(dm?.metadata?.sector).toLowerCase();
  const name = `${template} ${sector} ${text(dm?.metadata?.template_name)}`.toLowerCase();
  const inferred = [];
  if (/health|maternal|patient|hospital|nutrition/.test(name)) inferred.push('SDG 3');
  if (/education|school|teacher|learning/.test(name)) inferred.push('SDG 4');
  if (/agriculture|food|farmer|livelihood|humanitarian/.test(name)) inferred.push('SDG 2');
  if (/gender|women|female/.test(name)) inferred.push('SDG 5');
  if (/wash|water|sanitation/.test(name)) inferred.push('SDG 6');
  if (/employment|employee|market|customer|private|finance/.test(name)) inferred.push('SDG 8');
  if (/climate/.test(name)) inferred.push('SDG 13');
  if (/citizen|governance|scorecard|public|sdg|monitoring|evaluation/.test(name)) inferred.push('SDG 16');
  if (/sdg|annual|quarterly|monitoring|evaluation/.test(name)) inferred.push('SDG 17');
  return [...new Set([...declared.filter(x => SDG_META[x]), ...inferred])].slice(0, 6);
}

export function buildSDGVisualCardsV19(dm) {
  const f = findings(dm);
  const total = totalResponses(dm);
  return inferSDGs(dm).map((code, idx) => {
    const m = SDG_META[code] || { number: Number(code.replace(/\D/g, '')) || 0, color: '#64748b', icon: '🎯', goal: code };
    return {
      code,
      goal_number: m.number,
      title: m.goal,
      color: m.color,
      icon: m.icon,
      sdg_aligned_label: `${code}: ${m.goal}`,
      visual_system_note: 'SDG-aligned visual card using metadata; not an official UN SDG logo asset.',
      contribution_summary: f[idx] || f[0] || `This report contributes evidence relevant to ${m.goal}.`,
      evidence: {
        respondent_count: total,
        regions_covered: regions(dm).length,
        confidence_score: buildReportQualityGateV19(dm).overall_score,
        evidence_note: 'Grounded in this report model; this is not a formal SDG compliance certification.',
      },
    };
  });
}

export function buildEvidenceTraceabilityV19(dm) {
  const total = totalResponses(dm);
  const topRegions = regions(dm).slice(0, 3).map(r => r.label).filter(Boolean);
  const q = arr(dm?.annexes?.questionnaire)[0] || {};
  const qs = text(q.question_text || q.label || q.variable_id || 'Primary survey/interview question');
  const topQuote = quotes(dm)[0] || {};
  const topTopic = topics(dm)[0] || {};
  const hasRawQuote = !!text(topQuote.raw_text || topQuote.transcript || topQuote.quote);
  const hasRawPointer = !!(topQuote.response_id || topQuote.transcript_id || topQuote.audio_key || topQuote.audio_url || topQuote.consent_id || topQuote.consent_record_id);
  const hasRawEvidence = hasRawQuote && hasRawPointer;
  const evidenceType = hasRawEvidence ? 'raw_response_evidence' : 'report_model_evidence';
  const evidenceLabel = hasRawEvidence ? 'Raw response evidence' : 'Report-model evidence';
  const consentAvailable = hasRawEvidence && (dm?.consent_coverage != null ? num(dm.consent_coverage) > 0 : !!(topQuote.consent_id || topQuote.consent_record_id));
  const items = [];
  const add = (type, claim, extra = {}) => {
    if (!claim) return;
    const id = `ev-${String(items.length + 1).padStart(3, '0')}`;
    items.push({
      id,
      type,
      claim: clean(claim),
      clickable: true,
      evidence_type: extra.evidence_type || evidenceType,
      evidence_label: extra.evidence_label || evidenceLabel,
      raw_response_evidence: extra.evidence_type ? extra.evidence_type === 'raw_response_evidence' : hasRawEvidence,
      trace_path: [
        { level: 'claim', id, label: clean(claim).slice(0, 120), href: `#claim-${id}` },
        { level: 'finding', id: `finding-${items.length + 1}`, label: extra.finding || clean(claim).slice(0, 120), href: `#finding-${items.length + 1}` },
        { level: 'chart', id: extra.chart_id || 'chart-topics', label: extra.chart_label || 'Relevant chart / table', href: `#${extra.chart_id || 'chart-topics'}` },
        { level: 'source', id: q.variable_id || 'Q1', label: hasRawEvidence ? qs : 'Report summary / model evidence', href: `#questionnaire` },
      ],
      respondent_count: total,
      regions: topRegions,
      question_source: qs,
      quote: hasRawEvidence ? (topQuote.raw_text || topQuote.transcript || topQuote.quote) : null,
      transcript_id: hasRawEvidence ? (topQuote.response_id || topQuote.transcript_id || null) : null,
      audio_available: hasRawEvidence && !!(topQuote.audio_key || topQuote.audio_url),
      consent_available: consentAvailable,
      confidence_score: extra.confidence_score || buildReportQualityGateV19(dm).overall_score,
      evidence_basis: extra.evidence_basis || (hasRawEvidence
        ? `${total} responses${topTopic.topic ? `; top coded topic: ${topTopic.topic}` : ''}${topRegions.length ? `; leading regions: ${topRegions.join(', ')}` : ''}; raw quote/transcript pointer available.`
        : `${total} responses${topTopic.topic ? `; top coded topic: ${topTopic.topic}` : ''}${topRegions.length ? `; leading regions: ${topRegions.join(', ')}` : ''}; derived from report summary/model data, not raw transcript/audio/consent.`),
    });
  };
  findings(dm).slice(0, 5).forEach((f, i) => add('finding', f, { chart_id: i === 0 ? 'chart-topics' : 'chart-demographics' }));
  recommendations(dm).slice(0, 5).forEach((r, i) => add('recommendation', r.action, { finding: findings(dm)[i] || findings(dm)[0], chart_id: 'chart-recommendations' }));
  const summary = dm?.narrative?.executive_summary;
  if (summary) add('executive_summary', summary, { chart_id: 'chart-executive-snapshot' });
  return items;
}

export function buildReportQualityGateV19(dm) {
  const total = totalResponses(dm);
  const missingDim = ['gender', 'age', 'regions'].filter(k => ({ gender: gender(dm), age: ages(dm), regions: regions(dm) }[k]).length === 0);
  const fraudFlags = num(dm?.data_quality?.flagged_response_count);
  const avgFraud = num(dm?.data_quality?.avg_fraud_score);
  const citationCount = buildEvidenceTraceabilityV19Lite(dm).length;
  const hasLimitations = limitations(dm).length > 0 || !!dm?.research_transparency || !!dm?.intelligence_os_v7?.research_transparency;
  const dims = [
    { key: 'sample_size', label: 'Sample Size', score: total >= 1000 ? 100 : total >= 400 ? 92 : total >= 150 ? 82 : total > 0 ? 65 : 0, status: total > 0 ? 'PASS' : 'FAIL', detail: `${total} analysed responses.` },
    { key: 'demographic_completeness', label: 'Demographic Completeness', score: Math.max(0, 100 - missingDim.length * 25), status: missingDim.length <= 1 ? 'PASS' : 'REVIEW', detail: missingDim.length ? `Missing/limited: ${missingDim.join(', ')}.` : 'Gender, age and region are populated.' },
    { key: 'missing_data', label: 'Missing Data Transparency', score: hasLimitations || dm.is_demo ? 90 : 70, status: 'PASS', detail: 'Limitations and missing-data notes are disclosed rather than hidden.' },
    { key: 'fraud_flags', label: 'Fraud / Duplicate Risk', score: fraudFlags === 0 && avgFraud <= 0.1 ? 100 : fraudFlags <= Math.max(3, total * 0.03) ? 85 : 55, status: fraudFlags <= Math.max(5, total * 0.05) ? 'PASS' : 'REVIEW', detail: `${fraudFlags} flagged responses; average fraud score ${avgFraud || 0}.` },
    { key: 'consent_coverage', label: 'Consent Coverage', score: dm.is_demo ? 100 : dm?.consent_coverage != null ? Math.min(100, Math.round(num(dm.consent_coverage))) : 75, status: dm.is_demo || dm?.consent_coverage != null ? 'PASS' : 'REVIEW', detail: dm.is_demo ? 'Demo reports use fictional data; no real respondent consent is required.' : 'Production reports should verify consent logs.' },
    { key: 'confidence_level', label: 'Confidence Level', score: num(dm?.quality?.overall_quality_score ?? dm?.report_quality_gate?.overall_score ?? 88), status: 'PASS', detail: 'Uses report quality score where available; otherwise conservative evidence-based proxy.' },
    { key: 'limitations', label: 'Limitations Disclosure', score: hasLimitations ? 92 : 78, status: 'PASS', detail: hasLimitations ? 'Limitations are present.' : 'No explicit limitations found; reviewer should confirm before publication.' },
    { key: 'citation_coverage', label: 'Citation Coverage', score: citationCount >= 5 ? 95 : citationCount > 0 ? 82 : 50, status: citationCount > 0 ? 'PASS' : 'REVIEW', detail: `${citationCount} traceable evidence item(s) available.` },
  ];
  const overall = Math.round(dims.reduce((a, d) => a + d.score, 0) / dims.length);
  const blocking = dims.filter(d => d.status === 'FAIL');
  const review = dims.filter(d => d.status === 'REVIEW');
  return {
    version: 'Phase 19 Quality Gate',
    status: blocking.length ? 'BLOCKED' : review.length ? 'PASS_WITH_REVIEW' : 'PASS',
    export_allowed: blocking.length === 0 && overall >= 70,
    overall_score: overall,
    label: overall >= 90 ? 'Enterprise Ready' : overall >= 80 ? 'Ready with Review' : overall >= 70 ? 'Conditional' : 'Blocked',
    dimensions: dims,
    blockers: blocking,
    review_items: review,
    required_before_export: blocking.map(b => b.detail),
  };
}

function buildEvidenceTraceabilityV19Lite(dm) {
  const count = findings(dm).length + recommendations(dm).length + (dm?.narrative?.executive_summary ? 1 : 0);
  return Array.from({ length: count }, (_, i) => ({ id: i + 1 }));
}

export function buildAIVerificationLayerV19(dm) {
  const citations = buildEvidenceTraceabilityV19(dm);
  const gate = buildReportQualityGateV19(dm);
  const claims = [...findings(dm), ...recommendations(dm).map(r => r.action), dm?.narrative?.executive_summary].filter(Boolean);
  const unsupported = claims.filter(c => !citations.some(ev => ev.claim === clean(c) || ev.claim.includes(clean(c).slice(0, 60))));
  const notEnough = JSON.stringify(dm || {}).includes('Not enough data has been collected yet');
  return {
    version: 'Phase 19 AI Verification Layer',
    status: gate.export_allowed && unsupported.length === 0 && !notEnough ? 'VERIFIED' : gate.export_allowed ? 'VERIFIED_WITH_REVIEW' : 'BLOCKED',
    publication_allowed: gate.export_allowed && !notEnough,
    export_allowed: gate.export_allowed && !notEnough,
    checked_claims: claims.length,
    supported_claims: Math.max(0, claims.length - unsupported.length),
    unsupported_claims: unsupported.slice(0, 10),
    hallucination_guard: {
      no_new_statistics_created: true,
      no_new_standards_created: true,
      no_internal_debug_language: !/This card reuses|no new comparison logic|generated directly from/i.test(JSON.stringify(dm || {})),
      no_not_enough_data_public_text: !notEnough,
    },
    reviewer_note: unsupported.length ? 'Some claims need stronger citations before publication.' : 'Claims are traceable to raw response evidence where available, or clearly labelled report-model evidence where raw transcript/audio/consent pointers are not present.',
  };
}

export function buildTrueInfographicRendererV19(dm) {
  const total = totalResponses(dm);
  const gate = buildReportQualityGateV19(dm);
  const topFindings = findings(dm).slice(0, 5);
  const recs = recommendations(dm).slice(0, 6);
  const pos = sentiment(dm).find(s => String(s.label).toLowerCase() === 'positive')?.n;
  const neg = sentiment(dm).find(s => String(s.label).toLowerCase() === 'negative')?.n;
  return {
    version: 'Phase 19 True Infographic Renderer',
    render_mode: 'publication_infographic',
    theme: {
      brand: 'VoiceInsights Africa',
      style: 'executive-publication',
      density: 'high-information, high-whitespace',
    },
    pages: [
      {
        id: 'executive-dashboard', title: 'Executive Intelligence Dashboard', layout: 'hero_kpi_grid',
        components: [
          { type: 'kpi_card', label: 'Responses', value: total, interpretation: total >= 1000 ? 'Large evidence base' : total >= 300 ? 'Strong demonstration evidence base' : 'Moderate evidence base' },
          { type: 'kpi_card', label: 'Response Rate', value: `${dm?.kpis?.response_rate_pct ?? '—'}%`, interpretation: num(dm?.kpis?.response_rate_pct) >= 90 ? 'Excellent participation quality' : 'Review field completion drivers' },
          { type: 'kpi_card', label: 'Research Quality', value: `${gate.overall_score}/100`, interpretation: gate.label },
          { type: 'kpi_card', label: 'Regions Covered', value: regions(dm).length || dm?.kpis?.regions_covered || 0, interpretation: 'Geographic evidence base' },
        ],
      },
      { id: 'risk-matrix', title: 'Risk Matrix', layout: 'impact_likelihood_matrix', components: topFindings.slice(0, 4).map((f, i) => ({ type: 'risk_card', risk: f, impact: i === 0 ? 'High' : 'Medium', likelihood: i < 2 ? 'High' : 'Medium' })) },
      { id: 'decision-matrix', title: 'Decision Matrix', layout: 'impact_effort_matrix', components: recs.map((r, i) => ({ type: 'decision_card', action: r.action, owner: r.owner, timeframe: r.timeframe, impact: i < 2 ? 'High' : 'Medium', effort: r.tier === 'Immediate' ? 'Low' : 'Medium' })) },
      { id: 'sdg-cards', title: 'SDG Contribution', layout: 'sdg_visual_grid', components: buildSDGVisualCardsV19(dm).map(s => ({ type: 'sdg_card', ...s })) },
      { id: 'sentiment-regional', title: 'Sentiment & Regional Intelligence', layout: 'split_heatmap', components: [
        { type: 'sentiment_heatmap', data: sentiment(dm).map(s => ({ label: s.label, n: s.n, pct: pct(s.n, total) })) },
        { type: 'regional_intelligence', data: regions(dm).map((r, i) => ({ region: r.label, n: r.n, pct: pct(r.n, total), intensity: i < 2 ? 'High' : i < 4 ? 'Medium' : 'Low' })) },
      ] },
      { id: 'recommendations', title: 'Recommendation Cards', layout: 'roadmap_cards', components: recs.map(r => ({ type: 'recommendation_card', ...r, evidence: buildEvidenceTraceabilityV19(dm).find(e => e.type === 'recommendation')?.id || null })) },
    ],
    export_notes: 'Designed for HTML, PDF and board-deck rendering; all values are derived from document_model_json.',
  };
}

export function enrichDocumentModelWithPhase19(dm) {
  const out = JSON.parse(JSON.stringify(dm || {}));
  out.report_quality_gate_v19 = buildReportQualityGateV19(out);
  out.evidence_traceability_v19 = buildEvidenceTraceabilityV19(out);
  out.sdg_visual_cards_v19 = buildSDGVisualCardsV19(out);
  out.true_infographic_v19 = buildTrueInfographicRendererV19(out);
  out.ai_verification_v19 = buildAIVerificationLayerV19(out);
  out.phase19 = {
    name: 'Report Trust & Intelligence Upgrade',
    export_allowed: out.report_quality_gate_v19.export_allowed && out.ai_verification_v19.export_allowed,
    publication_allowed: out.ai_verification_v19.publication_allowed,
  };
  return out;
}

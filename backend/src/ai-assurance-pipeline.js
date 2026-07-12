// VoiceInsights Africa Enterprise Release 3(v215)
// Deterministic AI assurance pipeline. It never invents evidence and fails closed.

export const INSUFFICIENT_EVIDENCE = 'INSUFFICIENT_EVIDENCE';
const STAT_RE = /\b\d+(?:\.\d+)?\s*%|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g;
const QUOTE_RE = /[“"]([^”"]{12,})[”"]/g;

const arr = (v) => Array.isArray(v) ? v : [];
const txt = (v) => String(v ?? '').trim();
const norm = (v) => txt(v).toLowerCase().replace(/[^a-z0-9%]+/g, ' ').replace(/\s+/g, ' ').trim();
const unique = (xs) => [...new Set(xs.filter(Boolean))];
const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Number(n) || 0));

export function normalizeEvidenceRecord(input = {}) {
  return {
    evidence_id: txt(input.evidence_id || input.id),
    source_interview_id: txt(input.source_interview_id || input.interview_id || input.response_id),
    dataset_id: txt(input.dataset_id),
    dataset_version: txt(input.dataset_version || input.version),
    question_id: txt(input.question_id || input.variable_id),
    question_text: txt(input.question_text || input.question),
    respondent_group: txt(input.respondent_group || input.segment || input.group),
    quote: txt(input.quote || input.raw_text || input.transcript),
    value: input.value ?? null,
    statistic: txt(input.statistic),
    sample_size: Number.isFinite(Number(input.sample_size)) ? Number(input.sample_size) : null,
    source_type: txt(input.source_type || 'interview'),
    consent_verified: input.consent_verified === true,
    source_verified: input.source_verified === true,
    collected_at: txt(input.collected_at),
    checksum: txt(input.checksum),
  };
}

export function retrieveEvidence({ claim = '', evidence = [], citation_ids = [] } = {}) {
  const records = arr(evidence).map(normalizeEvidenceRecord);
  const wanted = new Set(arr(citation_ids).map(txt));
  if (wanted.size) return records.filter(e => wanted.has(e.evidence_id));
  const tokens = norm(claim).split(' ').filter(t => t.length > 3);
  return records
    .map(e => ({ e, score: tokens.filter(t => norm(`${e.question_text} ${e.quote} ${e.statistic}`).includes(t)).length }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(x => x.e);
}

export function validateCitations({ citation_ids = [], evidence = [] } = {}) {
  const ids = arr(citation_ids).map(txt).filter(Boolean);
  const records = arr(evidence).map(normalizeEvidenceRecord);
  const available = new Set(records.map(e => e.evidence_id).filter(Boolean));
  const missing = ids.filter(id => !available.has(id));
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  return {
    valid: ids.length > 0 && missing.length === 0 && duplicates.length === 0,
    cited_count: ids.length,
    missing: unique(missing),
    duplicates: unique(duplicates),
    status: ids.length === 0 || missing.length ? INSUFFICIENT_EVIDENCE : 'CITATIONS_VALID',
  };
}

function evidenceContainsStatistic(stat, records) {
  const needle = stat.replace(/\s+/g, '');
  return records.some(e => norm(`${e.statistic} ${e.value} ${e.quote}`).replace(/\s+/g, '').includes(needle));
}

function evidenceContainsQuote(quote, records) {
  const q = norm(quote);
  return records.some(e => {
    const source = norm(e.quote);
    return source && (source.includes(q) || q.includes(source));
  });
}

export function detectHallucinations({ claim = '', evidence = [], citation_ids = [], all_claims = [] } = {}) {
  const records = retrieveEvidence({ claim, evidence, citation_ids });
  const citations = validateCitations({ citation_ids, evidence });
  const statistics = txt(claim).match(STAT_RE) || [];
  const quotes = [...txt(claim).matchAll(QUOTE_RE)].map(m => m[1]);
  const fabricated_statistics = statistics.filter(s => !evidenceContainsStatistic(s, records));
  const invented_quotes = quotes.filter(q => !evidenceContainsQuote(q, records));
  const duplicate_findings = arr(all_claims)
    .filter(other => txt(other) !== txt(claim) && norm(other) === norm(claim));
  const empty_evidence = records.length === 0;
  const missing_citations = citations.cited_count === 0 || citations.missing.length > 0;
  const flags = {
    fabricated_statistics,
    unsupported_percentages: fabricated_statistics.filter(s => s.includes('%')),
    missing_citations,
    contradictions: [],
    invented_quotes,
    duplicate_findings: unique(duplicate_findings),
    empty_evidence,
  };
  const detected = fabricated_statistics.length > 0 || invented_quotes.length > 0 || missing_citations || empty_evidence || duplicate_findings.length > 0;
  return { detected, flags, status: detected ? INSUFFICIENT_EVIDENCE : 'NO_HALLUCINATION_SIGNAL' };
}

function extractDirectionalAssertions(text) {
  const n = norm(text);
  const subjects = ['access','satisfaction','coverage','quality','risk','performance','sentiment','participation','income','cost'];
  const direction = /\b(increase|increased|improved|higher|positive|grew|growth)\b/.test(n) ? 1
    : /\b(decrease|decreased|declined|lower|negative|worsened|reduced)\b/.test(n) ? -1 : 0;
  return subjects.filter(s => n.includes(s)).map(subject => ({ subject, direction }));
}

export function detectContradictions(claims = []) {
  const rows = arr(claims).map((claim, index) => ({ index, claim: txt(claim), assertions: extractDirectionalAssertions(claim) }));
  const contradictions = [];
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    for (const a of rows[i].assertions) {
      const b = rows[j].assertions.find(x => x.subject === a.subject);
      if (a.direction && b?.direction && a.direction !== b.direction) {
        contradictions.push({ subject: a.subject, claim_a_index: i, claim_b_index: j, claim_a: rows[i].claim, claim_b: rows[j].claim });
      }
    }
  }
  return { detected: contradictions.length > 0, contradictions };
}

export function calculateConfidence({ evidence = [], citation_validation, hallucination, contradiction_count = 0 } = {}) {
  const records = arr(evidence).map(normalizeEvidenceRecord);
  if (!records.length) return { score: 0, band: 'INSUFFICIENT', status: INSUFFICIENT_EVIDENCE, components: {} };
  const source = records.filter(e => e.source_verified).length / records.length;
  const consent = records.filter(e => e.consent_verified).length / records.length;
  const trace = records.filter(e => e.dataset_version && e.question_id && e.respondent_group && e.source_interview_id).length / records.length;
  const citations = citation_validation?.valid ? 1 : 0;
  const penalty = (hallucination?.detected ? 35 : 0) + Math.min(30, contradiction_count * 10);
  const score = clamp(Math.round((source * 25) + (consent * 10) + (trace * 30) + (citations * 25) + Math.min(10, records.length * 2) - penalty));
  return {
    score,
    band: score >= 90 ? 'VERY_HIGH' : score >= 75 ? 'HIGH' : score >= 60 ? 'MODERATE' : score >= 40 ? 'LOW' : 'INSUFFICIENT',
    status: score >= 60 ? 'CALCULATED' : INSUFFICIENT_EVIDENCE,
    components: { source_verification: Math.round(source * 100), consent_coverage: Math.round(consent * 100), trace_completeness: Math.round(trace * 100), citation_validity: citations * 100, penalty },
  };
}

export function verifyClaim(claimInput = {}, evidence = [], allClaims = []) {
  const claim = txt(claimInput.claim || claimInput.text || claimInput.finding);
  const citation_ids = arr(claimInput.citation_ids || claimInput.citations);
  const retrieved = retrieveEvidence({ claim, evidence, citation_ids });
  const citation_validation = validateCitations({ citation_ids, evidence });
  const hallucination = detectHallucinations({ claim, evidence, citation_ids, all_claims: allClaims });
  const contradictions = detectContradictions(allClaims);
  const claimContradictions = contradictions.contradictions.filter(c => c.claim_a === claim || c.claim_b === claim);
  hallucination.flags.contradictions = claimContradictions;
  if (claimContradictions.length) hallucination.detected = true;
  const confidence = calculateConfidence({ evidence: retrieved, citation_validation, hallucination, contradiction_count: claimContradictions.length });
  const verified = !!claim && citation_validation.valid && !hallucination.detected && confidence.score >= 60;
  return {
    claim_id: txt(claimInput.claim_id || claimInput.id), claim, claim_type: txt(claimInput.claim_type || 'finding'),
    citation_ids, evidence: retrieved, citation_validation, hallucination, confidence,
    verification_status: verified ? 'VERIFIED' : INSUFFICIENT_EVIDENCE,
    verified,
  };
}

export function runAIAssurancePipeline({ report_id = '', dataset = {}, claims = [], recommendations = [], governance = {} } = {}) {
  const evidence = arr(dataset.evidence || dataset.records).map(normalizeEvidenceRecord);
  const all = [...arr(claims), ...arr(recommendations)].map(x => txt(x.claim || x.text || x.finding || x.recommendation));
  const verifiedClaims = arr(claims).map(c => verifyClaim(c, evidence, all));
  const verifiedRecommendations = arr(recommendations).map(r => verifyClaim({ ...r, claim: r.claim || r.recommendation, claim_type: 'recommendation' }, evidence, all));
  const contradiction_scan = detectContradictions(all);
  const failures = [...verifiedClaims, ...verifiedRecommendations].filter(x => !x.verified);
  const traceable = [...verifiedClaims, ...verifiedRecommendations].every(x => x.evidence.every(e => e.source_interview_id && e.dataset_version && e.question_id && e.respondent_group));
  const assuranceScore = failures.length ? clamp(100 - failures.length * 18 - contradiction_scan.contradictions.length * 10) : 100;
  return {
    assurance_version: 'v215.0', report_id, dataset_id: txt(dataset.dataset_id), dataset_version: txt(dataset.version || dataset.dataset_version),
    claims: verifiedClaims, recommendations: verifiedRecommendations, contradiction_scan,
    governance: {
      model: txt(governance.model), prompt_version: txt(governance.prompt_version), temperature: Number(governance.temperature ?? 0),
      latency_ms: Number(governance.latency_ms || 0), cost: Number(governance.cost || 0), reviewer: txt(governance.reviewer),
      approval_status: txt(governance.approval_status || 'PENDING_HUMAN_APPROVAL'),
    },
    assurance_score: assuranceScore,
    evidence_traceable: traceable,
    publication_gate: {
      status: failures.length === 0 && traceable && governance.approval_status === 'APPROVED' ? 'PASS' : 'BLOCKED',
      publication_allowed: failures.length === 0 && traceable && governance.approval_status === 'APPROVED',
      blocking_reasons: [
        ...(failures.length ? [`${failures.length} unsupported or unverifiable claim(s)`] : []),
        ...(!traceable ? ['Evidence traceability is incomplete'] : []),
        ...(contradiction_scan.detected ? ['Contradictions require resolution'] : []),
        ...(governance.approval_status !== 'APPROVED' ? ['Human approval is required'] : []),
      ],
    },
    status: failures.length ? INSUFFICIENT_EVIDENCE : 'ASSURANCE_COMPLETE',
  };
}

export function buildEvidenceTrace(claimVerification = {}) {
  return arr(claimVerification.evidence).map(e => ({
    claim_id: claimVerification.claim_id,
    source_interview: e.source_interview_id,
    dataset_version: e.dataset_version,
    question: { id: e.question_id, text: e.question_text },
    respondent_group: e.respondent_group,
    quote: e.quote || null,
    confidence: claimVerification.confidence?.score ?? 0,
    verification_status: claimVerification.verification_status,
    evidence_id: e.evidence_id,
  }));
}

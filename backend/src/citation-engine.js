// ============================================================
// EVIDENCE & CITATION ENGINE (Phase 9, Task 9.6)
// ------------------------------------------------------------
// Attaches supporting evidence to conclusions/recommendations that
// already exist in a report's document model — grounded strictly in the
// SAME real data, never a new narrative generation. This is deliberately
// an ANNOTATION layer (asks Claude to point at which existing data point
// supports which existing claim) rather than a generator, so it cannot
// introduce a new unsupported claim — it can only cite or flag as
// uncited.
// ============================================================

export async function generateEvidenceCitations(env, { documentModel }) {
  const narrative = documentModel.narrative;
  if (!narrative || documentModel.kpis.total_responses === 0) {
    return { citations: [], note: 'No narrative conclusions exist yet to attach evidence to.' };
  }

  const claims = [
    ...(narrative.key_findings || []).map(text => ({ type: 'key_finding', text })),
    ...(narrative.risks || []).map(text => ({ type: 'risk', text })),
    ...(narrative.opportunities || []).map(text => ({ type: 'opportunity', text })),
    ...(documentModel.recommendations?.immediate || []).map(text => ({ type: 'recommendation_immediate', text })),
    ...(documentModel.recommendations?.medium_term || []).map(text => ({ type: 'recommendation_medium_term', text })),
  ];
  if (!claims.length) return { citations: [], note: 'No claims found in this report to cite.' };

  const evidencePool = {
    sentiment: documentModel.findings.sentiment,
    topics: documentModel.findings.topics,
    demographics: documentModel.demographics,
    data_quality: documentModel.data_quality,
    sample_quotes: documentModel.findings.representative_quotes,
  };

  const prompt = `Below is a list of CLAIMS already made in a research report, and the EVIDENCE POOL of real data that report was built from.

For EACH claim, identify which specific piece of evidence from the pool supports it, and assign a confidence level (high/medium/low). If a claim has NO clear supporting evidence in the pool, say so explicitly — do not invent a connection.

CLAIMS: ${JSON.stringify(claims)}
EVIDENCE POOL: ${JSON.stringify(evidencePool)}

Respond ONLY with a JSON array, no other text, one object per claim in the same order:
[{"claim": "...", "type": "...", "supporting_evidence": "a specific reference to the evidence pool, e.g. 'sentiment breakdown: 20 positive vs 5 negative' or a respondent quote", "confidence": "high|medium|low", "cited": true|false}]`;

  const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 2500, messages: [{ role: 'user', content: prompt }] }),
  });

  if (!claudeResp.ok) {
    throw new Error(`Claude API returned HTTP ${claudeResp.status} (${claudeResp.statusText || 'error'})`);
  }

  const data = await claudeResp.json();
  const textBlock = (data.content || []).map(c => c.text || '').join('');
  try {
    const citations = JSON.parse(textBlock.replace(/```json|```/g, '').trim());
    return { citations, note: null };
  } catch (e) {
    throw new Error('AI response was not valid JSON — citation generation failed, not silently defaulted');
  }
}

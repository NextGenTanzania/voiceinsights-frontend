// ============================================================
// AI NARRATIVE ENGINE (Phase 8, Task 8.3)
// ------------------------------------------------------------
// Writes the 8 requested narrative sections (Executive Summary, Key
// Findings, Discussion, Conclusions, Recommendations, Risks, Opportunities,
// Lessons Learned) in ONE Claude call — grounded ONLY in the ai_ready_package
// assembled by the Report Generator (Task 8.2). Never invents data.
//
// CRITICAL: follows the exact same reliability pattern proven in
// analyzeText() (Task 1.2.5's fix) — a non-2xx Claude response THROWS,
// never silently returns fabricated placeholder narrative. A report with
// missing AI sections (visibly marked as pending) is honest; a report with
// fake "the data shows positive trends" text is not.
// ============================================================

// ============================================================
// EDITORIAL STANDARDS INTEGRATION (Phase 11)
// ------------------------------------------------------------
// Formats a report_editorial_guidelines row (Phase 11) into additional
// prompt instructions. Returns an EMPTY string if no guideline is
// provided, so every function below is 100% backward compatible --
// existing behavior is completely unchanged when editorialGuideline is
// omitted, exactly as it was before Phase 11.
// ============================================================
function buildEditorialPromptSection(editorialGuideline) {
  if (!editorialGuideline) return '';
  const sr = editorialGuideline.section_rules || {};
  const sk = editorialGuideline.sector_knowledge || {};
  return `

PERMANENT EDITORIAL STANDARD FOR THIS REPORT TYPE (follow exactly):
Tone and voice: ${editorialGuideline.tone_and_voice}
Executive summary rule: ${sr.executive_summary || ''}
Discussion rule: ${sr.discussion || ''}
Recommendations rule: ${sr.recommendations || ''}
Conclusion rule: ${sr.conclusion || ''}
Evidence style rule: ${sr.evidence_style || ''}
Sector-typical risks to watch for: ${JSON.stringify(sk.common_risks || [])}
Things you must NEVER do for this report type: ${JSON.stringify(editorialGuideline.forbidden_behaviors || [])}`;
}

export async function writeNarrative(env, { aiReadyPackage, metadata, editorialGuideline }) {
  if (aiReadyPackage.total_responses === 0) {
    // Zero real responses — writing a "narrative" here would be pure
    // fabrication with nothing to ground it in. Return an honest, explicit
    // "not enough data" result rather than ever calling the model to invent one.
    const notEnough = 'Insufficient verified evidence available for this section.';
    return {
      executive_summary: notEnough, key_findings: [], discussion: notEnough, conclusions: notEnough,
      recommendations: { immediate: [], medium_term: [], long_term: [] },
      risks: [], opportunities: [], lessons_learned: notEnough,
    };
  }

  const prompt = `You are writing the AI-generated sections of a professional research report (in the style of an international consulting firm — UNDP/Gallup/Deloitte quality) for "${metadata.organization_name}", covering "${metadata.campaign_name || 'this project'}".

You must write ONLY from the real data provided below. Never invent statistics, quotes, or findings not present in this data. If the data is too thin to support a claim, say so explicitly rather than filling the gap with generic language.
${buildEditorialPromptSection(editorialGuideline)}

REAL DATA:
Total responses: ${aiReadyPackage.total_responses}
Response rate: ${aiReadyPackage.response_rate_pct}%
Top topics mentioned: ${JSON.stringify(aiReadyPackage.top_topics)}
Sentiment breakdown: ${JSON.stringify(aiReadyPackage.sentiment_breakdown)}
Sample respondent quotes (verbatim, real): ${JSON.stringify(aiReadyPackage.sample_quotes)}
Demographics: ${JSON.stringify(aiReadyPackage.demographics_summary)}
Data quality flags (responses flagged by the fraud engine): ${aiReadyPackage.data_quality_flags}

Respond ONLY with JSON in this exact shape, no other text:
{
  "executive_summary": "2-3 paragraphs, decision-maker-focused",
  "key_findings": ["finding 1 grounded in the data", "finding 2", "..."],
  "discussion": "1-2 paragraphs interpreting what the findings mean in context",
  "conclusions": "1 paragraph synthesizing the above",
  "recommendations": {
    "immediate": ["action grounded in a specific finding above"],
    "medium_term": ["..."],
    "long_term": ["..."]
  },
  "risks": ["a real risk suggested by the data, e.g. low response rate in a region, high fraud flags, negative sentiment cluster"],
  "opportunities": ["a real opportunity suggested by the data"],
  "lessons_learned": "1 paragraph — what this data collection round itself revealed about the research process (response patterns, channel performance, data quality), not just the subject matter"
}`;

  const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
  });

  // Same non-negotiable rule as analyzeText() (Task 1.2.5): a non-2xx
  // response is a REAL failure and must throw, never silently produce
  // fabricated narrative. The error message is short and never includes
  // headers or the API key.
  if (!claudeResp.ok) {
    throw new Error(`Claude API returned HTTP ${claudeResp.status} (${claudeResp.statusText || 'error'})`);
  }

  const data = await claudeResp.json();
  const textBlock = (data.content || []).map(c => c.text || '').join('');
  try {
    return JSON.parse(textBlock.replace(/```json|```/g, '').trim());
  } catch (e) {
    throw new Error('AI response was not valid JSON — narrative generation failed, not silently defaulted');
  }
}

// ============================================================
// EXECUTIVE REPORT STYLES (Phase 9, Task 9.1)
// ------------------------------------------------------------
// Rewrites the SAME real data (ai_ready_package) in a different tone for a
// different audience — never changes what the data says, only how it's
// worded. Deliberately a NEW function, not a modification of writeNarrative()
// above, per the instruction not to touch the existing Report Engine.
// Same reliability discipline: non-2xx throws, zero-data never calls Claude.
// ============================================================
export async function writeStyledNarrative(env, { aiReadyPackage, metadata, style, editorialGuideline }) {
  if (aiReadyPackage.total_responses === 0) {
    const notEnough = 'Insufficient verified evidence available for this section.';
    return {
      executive_summary: notEnough, key_findings: [], discussion: notEnough, conclusions: notEnough,
      recommendations: { immediate: [], medium_term: [], long_term: [] }, risks: [], opportunities: [], lessons_learned: notEnough,
    };
  }

  const prompt = `You are writing the AI-generated sections of a research report for "${metadata.organization_name}", covering "${metadata.campaign_name || 'this project'}".

AUDIENCE: ${style.audience_description}
REQUIRED TONE: ${style.tone_instruction}

You must write ONLY from the real data provided below. Never invent statistics, quotes, or findings not present in this data. The FACTS must be identical to what any other audience would be told — only the wording, framing, and emphasis should reflect the audience above.
${buildEditorialPromptSection(editorialGuideline)}

REAL DATA:
Total responses: ${aiReadyPackage.total_responses}
Response rate: ${aiReadyPackage.response_rate_pct}%
Top topics mentioned: ${JSON.stringify(aiReadyPackage.top_topics)}
Sentiment breakdown: ${JSON.stringify(aiReadyPackage.sentiment_breakdown)}
Sample respondent quotes (verbatim, real): ${JSON.stringify(aiReadyPackage.sample_quotes)}
Demographics: ${JSON.stringify(aiReadyPackage.demographics_summary)}
Data quality flags: ${aiReadyPackage.data_quality_flags}

Respond ONLY with JSON in this exact shape, no other text:
{
  "executive_summary": "...", "key_findings": ["..."], "discussion": "...", "conclusions": "...",
  "recommendations": { "immediate": ["..."], "medium_term": ["..."], "long_term": ["..."] },
  "risks": ["..."], "opportunities": ["..."], "lessons_learned": "..."
}`;

  const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
  });

  if (!claudeResp.ok) {
    throw new Error(`Claude API returned HTTP ${claudeResp.status} (${claudeResp.statusText || 'error'})`);
  }

  const data = await claudeResp.json();
  const textBlock = (data.content || []).map(c => c.text || '').join('');
  try {
    return JSON.parse(textBlock.replace(/```json|```/g, '').trim());
  } catch (e) {
    throw new Error('AI response was not valid JSON — styled narrative generation failed, not silently defaulted');
  }
}

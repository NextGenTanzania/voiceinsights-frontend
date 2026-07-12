// ============================================================
// RECOMMENDATIONS INTELLIGENCE (Phase 9, Task 9.5)
// ------------------------------------------------------------
// Produces a much richer, tiered recommendation structure than the basic
// immediate/medium/long-term arrays already in the document model
// (Task 8.3) — adds timeframe tiers, priority/difficulty scoring, standards
// alignment, and named responsible stakeholders. Grounded ONLY in real
// data; same reliability discipline (zero-data never calls Claude, a
// non-2xx response throws rather than fabricating).
// ============================================================

export async function generateTieredRecommendations(env, { aiReadyPackage, metadata, standards, editorialGuideline }) {
  if (aiReadyPackage.total_responses === 0) {
    const empty = [];
    return {
      immediate_actions: empty, plan_30_day: empty, plan_90_day: empty, strategic_actions: empty,
      policy_actions: empty, operational_actions: empty, budget_considerations: empty, risk_mitigation: empty,
      note: 'Insufficient verified evidence available to generate tiered recommendations.',
    };
  }

  // Phase 11: if this report type has a permanent editorial guideline, use
  // its SPECIFIC recommendation categories (Part D) and forbidden behaviors
  // instead of a generic instruction -- falls back to nothing extra if no
  // guideline exists, leaving the prompt otherwise identical to before.
  const editorialSection = editorialGuideline ? `

PERMANENT EDITORIAL STANDARD FOR THIS REPORT TYPE:
Tone: ${editorialGuideline.tone_and_voice}
This report type's applicable recommendation categories are: ${JSON.stringify(editorialGuideline.recommendation_categories || [])} -- only use categories relevant to this list where they naturally fit the tiered structure below.
Recommendations writing rule: ${(editorialGuideline.section_rules || {}).recommendations || ''}
Never do the following for this report type: ${JSON.stringify(editorialGuideline.forbidden_behaviors || [])}` : '';

  const prompt = `You are a senior consultant producing a tiered recommendations package for "${metadata.organization_name}" based on real survey data for "${metadata.campaign_name || 'this project'}".
${editorialSection}

REAL DATA:
Total responses: ${aiReadyPackage.total_responses}
Response rate: ${aiReadyPackage.response_rate_pct}%
Top topics: ${JSON.stringify(aiReadyPackage.top_topics)}
Sentiment breakdown: ${JSON.stringify(aiReadyPackage.sentiment_breakdown)}
Sample quotes: ${JSON.stringify(aiReadyPackage.sample_quotes)}
Demographics: ${JSON.stringify(aiReadyPackage.demographics_summary)}
Data quality flags: ${aiReadyPackage.data_quality_flags}
Relevant standards this report aligns to: ${JSON.stringify(standards || [])}

Every recommendation must be grounded in the data above — never invent a finding to justify a recommendation. Each recommendation needs a priority_score and difficulty_score from 1 (lowest) to 5 (highest), and an sdg_alignment array (empty if none of the data supports a specific SDG link).

Respond ONLY with JSON in this exact shape, no other text:
{
  "immediate_actions": [{"action": "...", "priority_score": 1-5, "difficulty_score": 1-5, "responsible_stakeholder": "...", "sdg_alignment": ["SDG 3", "..."]}],
  "plan_30_day": [{"action": "...", "priority_score": 1-5, "difficulty_score": 1-5, "responsible_stakeholder": "..."}],
  "plan_90_day": [{"action": "...", "priority_score": 1-5, "difficulty_score": 1-5, "responsible_stakeholder": "..."}],
  "strategic_actions": [{"action": "...", "priority_score": 1-5, "difficulty_score": 1-5}],
  "policy_actions": [{"action": "...", "responsible_stakeholder": "..."}],
  "operational_actions": [{"action": "...", "responsible_stakeholder": "..."}],
  "budget_considerations": ["a specific budget-relevant note grounded in the data"],
  "risk_mitigation": [{"risk": "...", "mitigation": "..."}]
}`;

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
    return JSON.parse(textBlock.replace(/```json|```/g, '').trim());
  } catch (e) {
    throw new Error('AI response was not valid JSON — tiered recommendations generation failed, not silently defaulted');
  }
}

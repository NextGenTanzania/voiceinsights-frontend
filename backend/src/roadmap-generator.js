// ============================================================
// IMPLEMENTATION ROADMAP GENERATOR (Phase 9, Task 9.8)
// ------------------------------------------------------------
// Turns a report's ALREADY-GENERATED recommendations (Task 8.3's basic
// tiers, or Task 9.5's tiered recommendations if available) into a
// concrete rollout plan: timeline, owners, milestones, dependencies,
// resources, budget notes, monitoring indicators, success measures.
// Deliberately builds FROM existing recommendations rather than
// generating new ones from scratch, so the roadmap can never recommend
// an action not already grounded in the report's real data.
// ============================================================

export async function generateImplementationRoadmap(env, { documentModel, tieredRecommendations, metadata }) {
  const hasBasicRecs = documentModel.recommendations && (
    documentModel.recommendations.immediate?.length || documentModel.recommendations.medium_term?.length || documentModel.recommendations.long_term?.length
  );
  const hasTieredRecs = tieredRecommendations && (
    tieredRecommendations.immediate_actions?.length || tieredRecommendations.plan_30_day?.length
  );
  if (!hasBasicRecs && !hasTieredRecs) {
    return { phases: [], note: 'No recommendations exist yet to build a roadmap from. Generate the report narrative first.' };
  }

  const recommendationsSource = hasTieredRecs ? tieredRecommendations : documentModel.recommendations;

  const prompt = `You are building a practical implementation roadmap for "${metadata.organization_name}" based ONLY on the recommendations already produced for "${metadata.campaign_name || 'this project'}" — do not invent new recommendations, only sequence and operationalize the ones given.

EXISTING RECOMMENDATIONS: ${JSON.stringify(recommendationsSource)}

Respond ONLY with JSON in this exact shape, no other text:
{
  "phases": [
    {
      "phase_name": "e.g. Phase 1: Immediate Response (Weeks 1-4)",
      "timeline": "a specific timeframe",
      "actions": ["action text, matching or closely derived from the recommendations given"],
      "owners": ["a role/stakeholder responsible, e.g. 'M&E Officer', 'Program Director'"],
      "milestones": ["a concrete, checkable milestone"],
      "dependencies": ["what must happen before this phase can start, or 'None' if standalone"],
      "resources_needed": ["e.g. 'Field staff time', 'Budget for X'"],
      "budget_notes": "a short note on cost implications, or 'No significant budget impact' if minimal",
      "monitoring_indicators": ["a specific, measurable indicator to track this phase's progress"],
      "success_measures": ["what 'done and working' looks like for this phase"]
    }
  ]
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
    throw new Error('AI response was not valid JSON — roadmap generation failed, not silently defaulted');
  }
}

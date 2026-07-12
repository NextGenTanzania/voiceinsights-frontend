// ============================================================
// AI REPORT ASSISTANT (Phase 9, Task 9.2)
// ------------------------------------------------------------
// Answers natural-language questions about ONE specific report, grounded
// STRICTLY in that report's own document_model_json — never general
// knowledge, never another report's data, never invented statistics.
// Same reliability discipline as the rest of the AI Narrative Engine:
// a non-2xx Claude response throws, never fabricates an answer.
// ============================================================

export async function askReportQuestion(env, { documentModel, question }) {
  if (!question || !question.trim()) {
    throw new Error('question is required');
  }
  if (documentModel.kpis.total_responses === 0) {
    return { answer: 'This report has no responses yet, so there is no data to answer questions about.', grounded: false };
  }

  // The full context this report's own data provides — deliberately NOT
  // narrative prose, so Claude reasons over structured facts rather than
  // re-reading already-written narrative and possibly drifting from the
  // underlying numbers.
  const context = {
    metadata: documentModel.metadata,
    kpis: documentModel.kpis,
    demographics: documentModel.demographics,
    findings: documentModel.findings,
    data_quality: documentModel.data_quality,
    recommendations: documentModel.recommendations,
    narrative: documentModel.narrative || null,
  };

  const prompt = `You are answering a question about ONE specific research report. You must answer ONLY using the REPORT DATA below — never general knowledge, never information about any other report or organization.

If the data below does not contain enough information to answer the question, say so explicitly (e.g. "This report does not include regional breakdowns for that indicator") rather than guessing, estimating, or inventing a number.

REPORT DATA:
${JSON.stringify(context)}

QUESTION: ${question}

Respond with a direct, concise answer. Use 2-4 sentences unless the question specifically asks for a list or comparison, in which case use a short list. Reference specific numbers from the data when relevant.`;

  const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
  });

  if (!claudeResp.ok) {
    throw new Error(`Claude API returned HTTP ${claudeResp.status} (${claudeResp.statusText || 'error'})`);
  }

  const data = await claudeResp.json();
  const answer = (data.content || []).map(c => c.text || '').join('').trim();
  if (!answer) throw new Error('Claude returned an empty response');
  return { answer, grounded: true };
}

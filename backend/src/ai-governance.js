const txt = v => String(v ?? '').trim();
export function buildAIGovernanceRecord(input = {}) {
  const required = ['model','prompt_version','dataset_id','dataset_version'];
  const missing = required.filter(k => !txt(input[k]));
  return {
    governance_version: 'v215.0', run_id: txt(input.run_id), report_id: txt(input.report_id), tenant_id: txt(input.tenant_id),
    model: txt(input.model), provider: txt(input.provider), prompt_version: txt(input.prompt_version), temperature: Number(input.temperature ?? 0),
    dataset_id: txt(input.dataset_id), dataset_version: txt(input.dataset_version), latency_ms: Number(input.latency_ms || 0),
    input_tokens: Number(input.input_tokens || 0), output_tokens: Number(input.output_tokens || 0), cost: Number(input.cost || 0), currency: txt(input.currency || 'USD'),
    reviewer: txt(input.reviewer), approval: txt(input.approval || 'PENDING'), approved_at: txt(input.approved_at), created_at: txt(input.created_at || new Date().toISOString()),
    valid: missing.length === 0, missing,
  };
}

export function approveAIRun(record, { reviewer, decision, reason = '', approved_at = new Date().toISOString() } = {}) {
  if (!txt(reviewer)) throw new Error('reviewer is required');
  if (!['APPROVED','REJECTED','CHANGES_REQUIRED'].includes(decision)) throw new Error('invalid approval decision');
  return { ...record, reviewer: txt(reviewer), approval: decision, approval_reason: txt(reason), approved_at, publication_eligible: decision === 'APPROVED' && record.valid === true };
}

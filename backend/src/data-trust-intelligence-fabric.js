// VoiceInsights Data Trust & Intelligence Fabric™
// A governed data layer for cataloguing, tracing, observing, protecting and operationalising data.

export const DATA_TRUST_CAPABILITIES = Object.freeze([
  'Data Catalog & Metadata Registry',
  'End-to-End Data Lineage',
  'Data Quality & Observability Center',
  'Privacy & Disclosure Control',
  'AI Governance & Model Assurance',
  'SDMX/DDI Interoperability',
  'Real-Time Decision Signals',
]);

export function validateCatalogAsset(input = {}) {
  const errors = [];
  if (!String(input.name || '').trim()) errors.push('name is required');
  if (!['dataset','survey','variable','indicator','report','model','data_product'].includes(input.asset_type)) errors.push('valid asset_type is required');
  if (!String(input.owner_user_id || '').trim()) errors.push('owner_user_id is required');
  if (!['public','internal','confidential','restricted','highly_restricted'].includes(input.classification || 'internal')) errors.push('valid classification is required');
  return { ok: errors.length === 0, errors };
}

export function validateLineageEdge(input = {}) {
  const errors = [];
  if (!input.from_asset_id) errors.push('from_asset_id is required');
  if (!input.to_asset_id) errors.push('to_asset_id is required');
  if (input.from_asset_id === input.to_asset_id) errors.push('lineage edge cannot reference the same asset');
  if (!['collected_from','transformed_to','aggregated_into','derived_from','visualised_as','supports_finding','supports_recommendation','published_in'].includes(input.relationship_type)) errors.push('valid relationship_type is required');
  return { ok: errors.length === 0, errors };
}

export function computeQualityStatus(checks = []) {
  if (!checks.length) return { status: 'NOT_MEASURED', score: null, failed: 0, warnings: 0 };
  const weighted = checks.reduce((acc, c) => {
    const weight = Number(c.weight || 1);
    const score = Math.max(0, Math.min(100, Number(c.score ?? (c.status === 'PASS' ? 100 : c.status === 'WARN' ? 60 : 0))));
    acc.total += score * weight; acc.weight += weight;
    if (c.status === 'FAIL') acc.failed += 1;
    if (c.status === 'WARN') acc.warnings += 1;
    return acc;
  }, { total: 0, weight: 0, failed: 0, warnings: 0 });
  const score = weighted.weight ? Math.round(weighted.total / weighted.weight) : null;
  const status = weighted.failed ? 'BLOCKED' : score >= 90 ? 'HEALTHY' : score >= 75 ? 'DEGRADED' : 'INCOMPLETE';
  return { status, score, failed: weighted.failed, warnings: weighted.warnings };
}

export function assessDisclosureRisk(input = {}) {
  const minGroup = Number(input.minimum_group_size || 5);
  const groupSize = Number(input.group_size || 0);
  const hasDirectIdentifiers = Boolean(input.has_direct_identifiers);
  const preciseGps = Boolean(input.precise_gps);
  const rawVoice = Boolean(input.raw_voice);
  const sensitive = Boolean(input.sensitive_attributes);
  const reasons = [];
  if (hasDirectIdentifiers) reasons.push('DIRECT_IDENTIFIERS_PRESENT');
  if (groupSize < minGroup) reasons.push('SMALL_GROUP_SUPPRESSION_REQUIRED');
  if (preciseGps) reasons.push('GPS_GENERALISATION_REQUIRED');
  if (rawVoice) reasons.push('VOICE_REIDENTIFICATION_REVIEW_REQUIRED');
  if (sensitive) reasons.push('SENSITIVE_ATTRIBUTE_REVIEW_REQUIRED');
  const risk = hasDirectIdentifiers || groupSize < minGroup ? 'HIGH' : (preciseGps || rawVoice || sensitive ? 'MEDIUM' : 'LOW');
  return {
    risk,
    decision: risk === 'LOW' ? 'APPROVED_WITH_STANDARD_CONTROLS' : 'REVIEW_REQUIRED',
    reasons,
    controls: [
      hasDirectIdentifiers && 'Remove or tokenize direct identifiers',
      groupSize < minGroup && `Suppress groups below ${minGroup}`,
      preciseGps && 'Aggregate or jitter precise coordinates',
      rawVoice && 'Use transcript/redacted excerpt unless explicitly approved',
      sensitive && 'Apply purpose limitation and restricted access',
    ].filter(Boolean),
  };
}

export function evaluateModelAssurance(input = {}) {
  const checks = {
    model_registered: Boolean(input.model_name && input.model_version),
    prompt_versioned: Boolean(input.prompt_version || input.task_type === 'transcription'),
    evaluation_dataset: Boolean(input.evaluation_dataset_id),
    citations_required: Boolean(input.citations_required),
    human_review: Boolean(input.human_review_required),
    rollback_defined: Boolean(input.rollback_version),
    bias_review: Boolean(input.bias_reviewed_at),
    privacy_review: Boolean(input.privacy_reviewed_at),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const score = Math.round((passed / Object.keys(checks).length) * 100);
  return { status: score >= 90 ? 'APPROVED' : score >= 70 ? 'CONDITIONAL' : 'NOT_READY', score, checks };
}

export function validateInteroperabilityContract(input = {}) {
  const errors = [];
  if (!input.standard || !['SDMX','DDI','FHIR','DHIS2','ODK','KoboToolbox','SurveyCTO','CSV','JSON','PowerBI','Tableau'].includes(input.standard)) errors.push('supported standard is required');
  if (!input.contract_version) errors.push('contract_version is required');
  if (!Array.isArray(input.fields) || !input.fields.length) errors.push('fields are required');
  if (!input.owner_user_id) errors.push('owner_user_id is required');
  return { ok: !errors.length, errors };
}

export function buildDecisionSignals(metrics = {}) {
  const signals = [];
  const push = (type, severity, title, detail, evidence = {}) => signals.push({ type, severity, title, detail, evidence });
  if (metrics.response_quality_drop_pct >= 10) push('QUALITY_DROP','HIGH','Response quality declined',`Quality dropped by ${metrics.response_quality_drop_pct}%`,{metric:'response_quality_drop_pct'});
  if (metrics.completion_stalled_hours >= 12) push('COLLECTION_STALLED','HIGH','Collection has stalled',`No meaningful completion growth for ${metrics.completion_stalled_hours} hours`,{metric:'completion_stalled_hours'});
  if (metrics.fraud_risk_increase_pct >= 15) push('FRAUD_RISK','CRITICAL','Fraud risk increased',`Fraud risk increased by ${metrics.fraud_risk_increase_pct}%`,{metric:'fraud_risk_increase_pct'});
  if (metrics.provider_error_rate_pct >= 5) push('PROVIDER_DEGRADED','HIGH','Channel delivery is degraded',`Provider error rate is ${metrics.provider_error_rate_pct}%`,{metric:'provider_error_rate_pct'});
  if (metrics.dataset_freshness_hours >= 48) push('DATA_STALE','MEDIUM','Dataset is stale',`Latest trusted refresh was ${metrics.dataset_freshness_hours} hours ago`,{metric:'dataset_freshness_hours'});
  if (metrics.indicator_threshold_breached) push('INDICATOR_THRESHOLD','HIGH','Indicator crossed a decision threshold',String(metrics.indicator_threshold_breached),{metric:'indicator_threshold_breached'});
  if (metrics.emerging_theme) push('EMERGING_THEME','MEDIUM','New theme emerging in voice responses',String(metrics.emerging_theme),{metric:'emerging_theme'});
  return signals;
}

export function buildDataTrustWorkspace(snapshot = {}) {
  const measured = (value) => value == null ? { value: null, label: 'Not yet measured' } : { value, label: String(value) };
  return {
    product_name: 'VoiceInsights Data Trust & Intelligence Fabric™',
    positioning: 'Govern, validate, trace, protect and transform data into decision-ready intelligence.',
    capabilities: DATA_TRUST_CAPABILITIES,
    metrics: {
      catalog_assets: measured(snapshot.catalog_assets),
      lineage_edges: measured(snapshot.lineage_edges),
      open_quality_incidents: measured(snapshot.open_quality_incidents),
      disclosure_reviews_pending: measured(snapshot.disclosure_reviews_pending),
      registered_ai_models: measured(snapshot.registered_ai_models),
      active_data_contracts: measured(snapshot.active_data_contracts),
      active_decision_signals: measured(snapshot.active_decision_signals),
    },
    trust_chain: ['Source','Raw Data','Validation','Cleaning','Transformation','Indicator','Analysis','Finding','Evidence','Recommendation','Report','Decision'],
    generated_at: new Date().toISOString(),
  };
}

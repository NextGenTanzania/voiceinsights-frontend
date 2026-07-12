// Evidence-aware chart specifications. A chart is emitted only from supplied data.
const arr = v => Array.isArray(v) ? v : [];
const txt = v => String(v ?? '').trim();
const TYPES = ['kpi_card','heat_map','benchmark','waterfall','trend','sentiment','geographical_map','executive_dashboard'];

export function buildVisualSpec({ type, title, data = [], source = {}, options = {} } = {}) {
  if (!TYPES.includes(type)) throw new Error(`Unsupported visual type: ${type}`);
  const rows = arr(data).filter(r => r && typeof r === 'object');
  const sourceOk = txt(source.dataset_id) && txt(source.dataset_version) && arr(source.evidence_ids).length > 0;
  const blocked = !rows.length || !sourceOk;
  return {
    visual_version: 'v215.0', type, title: txt(title),
    status: blocked ? 'INSUFFICIENT_EVIDENCE' : 'VERIFIED_VISUAL',
    render_allowed: !blocked,
    data: blocked ? [] : rows,
    source: { dataset_id: txt(source.dataset_id), dataset_version: txt(source.dataset_version), evidence_ids: arr(source.evidence_ids) },
    design: {
      audience: options.audience || 'executive', density: options.density || 'balanced',
      labels_required: true, source_note_required: true, accessible_table_required: true,
      zero_baseline_required: type === 'benchmark' || type === 'trend',
      uncertainty_display: options.uncertainty_display !== false,
    },
    blocking_reason: blocked ? 'Verified data and complete source metadata are required.' : null,
  };
}

export function buildConsultingVisualSuite(input = {}) {
  return {
    kpi_cards: arr(input.kpis).map(x => buildVisualSpec({ type: 'kpi_card', ...x })),
    heat_maps: arr(input.heat_maps).map(x => buildVisualSpec({ type: 'heat_map', ...x })),
    benchmarks: arr(input.benchmarks).map(x => buildVisualSpec({ type: 'benchmark', ...x })),
    waterfalls: arr(input.waterfalls).map(x => buildVisualSpec({ type: 'waterfall', ...x })),
    trends: arr(input.trends).map(x => buildVisualSpec({ type: 'trend', ...x })),
    sentiment: arr(input.sentiment).map(x => buildVisualSpec({ type: 'sentiment', ...x })),
    maps: arr(input.maps).map(x => buildVisualSpec({ type: 'geographical_map', ...x })),
    dashboards: arr(input.dashboards).map(x => buildVisualSpec({ type: 'executive_dashboard', ...x })),
  };
}
export { TYPES as VISUAL_TYPES };

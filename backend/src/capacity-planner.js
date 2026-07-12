export function estimateGrowth({ current = {}, daily = {}, horizonDays = 90 } = {}) {
  const growth = (key) => Number((current[key] || 0) + (daily[key] || 0) * horizonDays);
  return {
    horizon_days: horizonDays,
    projected_storage_gb: growth('storage_gb'),
    projected_database_rows: growth('database_rows'),
    projected_reports: growth('reports'),
    projected_ai_jobs: growth('ai_jobs'),
    projected_render_jobs: growth('render_jobs'),
    projected_sync_items: growth('sync_items'),
    generated_at: new Date().toISOString(),
  };
}

export function buildCapacityPlan(metrics = {}) {
  const current = {
    storage_gb: metrics.storage?.used_gb || 0,
    database_rows: metrics.database?.rows || 0,
    reports: metrics.reports?.total || 0,
    ai_jobs: metrics.ai?.total_jobs || 0,
    render_jobs: metrics.rendering?.total_jobs || 0,
    sync_items: metrics.sync?.total_items || 0,
  };
  const daily = {
    storage_gb: metrics.storage?.growth_gb_per_day || 0.05,
    database_rows: metrics.database?.growth_rows_per_day || 500,
    reports: metrics.reports?.generated_per_day || 20,
    ai_jobs: metrics.ai?.jobs_per_day || 200,
    render_jobs: metrics.rendering?.jobs_per_day || 50,
    sync_items: metrics.sync?.items_per_day || 1000,
  };
  const projections = [30, 90, 180, 365].map(horizonDays => estimateGrowth({ current, daily, horizonDays }));
  const risks = [];
  if ((metrics.rendering?.queue_utilisation_pct || 0) > 80) risks.push('Rendering queue utilisation is above 80%; scale renderer capacity.');
  if ((metrics.storage?.used_gb || 0) > 800) risks.push('R2 storage has crossed 800GB; review retention and lifecycle policies.');
  if ((metrics.database?.growth_rows_per_day || 0) > 100000) risks.push('D1 row growth is high; review archiving and query indexes.');
  return { current, daily_growth_assumptions: daily, projections, risks, recommendation: risks.length ? 'Scale or optimize before the next growth milestone.' : 'Capacity is currently within expected operating envelope.' };
}

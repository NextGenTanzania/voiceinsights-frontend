// Merges a hand-crafted narrative+recommendations JSON file into an
// existing report's document_model_json, WITHOUT touching any other
// field (KPIs, demographics, charts, branding, annexes all stay exactly
// as the real Report Engine generated them). Outputs a safe, properly
// SQL-escaped UPDATE statement to stdout — never executes directly, so
// the exact SQL can be reviewed before running.
//
// Usage: node scripts/merge-narrative.js <current_document_model.json> <narrative.json> <report_id>

import { readFileSync } from 'fs';

const [, , currentModelPath, narrativePath, reportId] = process.argv;
const currentModel = JSON.parse(readFileSync(currentModelPath, 'utf8'));
const narrativeContent = JSON.parse(readFileSync(narrativePath, 'utf8'));

currentModel.narrative = {
  executive_summary: narrativeContent.executive_summary,
  key_findings: narrativeContent.key_findings,
  discussion: narrativeContent.discussion,
  conclusions: narrativeContent.conclusions,
  risks: narrativeContent.risks,
  opportunities: narrativeContent.opportunities,
  lessons_learned: narrativeContent.lessons_learned,
};
currentModel.recommendations = narrativeContent.recommendations;

const escapedJson = JSON.stringify(currentModel).replace(/'/g, "''");
console.log(`UPDATE generated_reports SET document_model_json = '${escapedJson}', updated_at = datetime('now') WHERE id = '${reportId}';`);

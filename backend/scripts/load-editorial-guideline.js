// Reads one editorial-guidelines/<template_id>.json file and outputs the
// corresponding safe, escaped SQL INSERT/UPDATE for report_editorial_guidelines.
// Usage: node scripts/load-editorial-guideline.js <template_id>

import { readFileSync } from 'fs';

const templateId = process.argv[2];
const guideline = JSON.parse(readFileSync(`tests/editorial-guidelines/${templateId}.json`, 'utf8'));

function esc(v) { return JSON.stringify(v).replace(/'/g, "''"); }

const sql = `INSERT INTO report_editorial_guidelines (template_id, tone_and_voice, section_rules_json, sector_knowledge_json, recommendation_categories_json, forbidden_behaviors_json)
VALUES ('${templateId}', '${esc(guideline.tone_and_voice).slice(1, -1)}', '${esc(guideline.section_rules)}', '${esc(guideline.sector_knowledge)}', '${esc(guideline.recommendation_categories)}', '${esc(guideline.forbidden_behaviors)}')
ON CONFLICT(template_id) DO UPDATE SET
  tone_and_voice = excluded.tone_and_voice,
  section_rules_json = excluded.section_rules_json,
  sector_knowledge_json = excluded.sector_knowledge_json,
  recommendation_categories_json = excluded.recommendation_categories_json,
  forbidden_behaviors_json = excluded.forbidden_behaviors_json,
  updated_at = datetime('now');`;

console.log(sql);

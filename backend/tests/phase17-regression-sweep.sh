#!/bin/bash
# Phase 17 PART A.2: Full Regression Sweep across all 16 Showcase Reports.
# Real curl calls against every endpoint listed in the task, recording
# HTTP status for each (report x endpoint) pair.

BASE="http://localhost:8799"
TOKEN=$(cat /tmp/demo_admin_token_v2.txt)
IDS_FILE="/tmp/all_16_ids.txt"
RESULTS="/tmp/regression_sweep_results.txt"
> "$RESULTS"

while IFS='|' read -r id name; do
  id=$(echo "$id" | xargs)
  name=$(echo "$name" | xargs)
  echo "=== $name ($id) ===" >> "$RESULTS"

  # Public Viewer (no auth)
  c=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/public/demo-reports/$id")
  echo "public_viewer: $c" >> "$RESULTS"

  # Internal Viewer (auth)
  c=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/reports/$id" -H "Authorization: Bearer $TOKEN")
  echo "internal_viewer: $c" >> "$RESULTS"

  # Multi-format renders (internal, authenticated)
  for fmt in executive_summary management_report donor_brief policy_brief infographic statistical_annex dataset_appendix ai_talking_points; do
    c=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/reports/$id/format/$fmt" -H "Authorization: Bearer $TOKEN")
    echo "format_$fmt: $c" >> "$RESULTS"
  done

  # Technical Report = same as internal_viewer (document_model_json), no separate endpoint

  # Executive Infographic Engine data
  c=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/reports/$id/infographic-data" -H "Authorization: Bearer $TOKEN")
  echo "infographic_data: $c" >> "$RESULTS"

  # Quality Score
  c=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/reports/$id/quality-score" -H "Authorization: Bearer $TOKEN")
  echo "quality_score: $c" >> "$RESULTS"

  # Benchmark
  c=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/reports/$id/benchmark" -H "Authorization: Bearer $TOKEN")
  echo "benchmark: $c" >> "$RESULTS"

  # Tiered Recommendations (cached read — safe, no regeneration)
  c=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/reports/$id/tiered-recommendations" -H "Authorization: Bearer $TOKEN")
  echo "tiered_recommendations: $c" >> "$RESULTS"

  # Roadmap (cached read)
  c=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/reports/$id/roadmap" -H "Authorization: Bearer $TOKEN")
  echo "roadmap: $c" >> "$RESULTS"

  # Evidence/Citations (cached read)
  c=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/reports/$id/citations" -H "Authorization: Bearer $TOKEN")
  echo "citations: $c" >> "$RESULTS"

  # Report Assistant (rate-limited 20/hr — one call per report is safe)
  c=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/reports/$id/ask" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"question":"Summarize this report"}')
  echo "report_assistant: $c" >> "$RESULTS"

  echo "" >> "$RESULTS"
done < "$IDS_FILE"

echo "SWEEP COMPLETE"

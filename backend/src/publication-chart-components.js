// Publication Chart Components — Publication Experience (PX) Release 4, Part 5.
//
// Hand-rolled SVG/HTML chart generators for the Browser Rendering V2
// publication family. There is zero prior chart-drawing precedent anywhere
// in this codebase (confirmed by audit) — every "chart type" mentioned
// elsewhere is a label string in a marketing-copy array, never a renderer.
// These are the first real ones, built server-side as static SVG/HTML+CSS
// because Puppeteer renders static markup, not interactive client-side
// charts — no charting library is used or needed.
//
// Governing rule, unchanged from every other file in this family: every
// number drawn here must trace to a real field on the governed model.
// Several chart types explicitly requested elsewhere (choropleth maps,
// bullet charts, heatmaps, systems maps, theory-of-change diagrams) are
// deliberately NOT implemented in this file — the audit behind this release
// confirmed no real data exists anywhere in this codebase to back them
// honestly, and inventing the missing structure (map boundaries, numeric
// targets, a 2D indicator matrix, a causal graph) would mean fabricating
// data, which this project does not do. See the PX Release 4 plan for the
// full reasoning per chart type.
import { vrdsTokens } from './vrds-foundation.js';
import { escapeHtml } from './publication-render-utils.js';

export const PUBLICATION_CHART_COMPONENTS_VERSION = 'publication-chart-components-v1';

// Global Certification Phase 2: every chart SVG below rendered with zero
// accessible name (confirmed by direct audit — no aria-label/role/<title>
// anywhere in this file). `report.accessibility.wcag_target` has declared
// "WCAG 2.2 AA" since PX Release 5 without any enforcing code behind it in
// this file. `chartA11yLabel` builds a real, non-fabricated accessible name
// from the same data each chart already draws from — never a generic
// placeholder — applied as `role="img" aria-label="..."` on each <svg>
// root, the standard technique for a non-interactive, non-text-containing
// SVG (WCAG 1.1.1 Non-text Content).
function chartA11yLabel(text) {
  return escapeHtml(text);
}

const { colors, riskColors, confidenceColors } = vrdsTokens;

// ------------------------------------------------------------------
// Radar chart — a real multi-axis numeric object (e.g. assurance.components:
// evidence_quality, statistical_quality, visualization_quality,
// storytelling_quality, decision_support, accessibility) plotted as a
// polygon. Requires 3+ real axes; degrades to a plain list otherwise rather
// than drawing a meaningless 1- or 2-point "polygon".
// ------------------------------------------------------------------
export function radarChart(scores = {}, { size = 220, maxValue = 100 } = {}) {
  const entries = Object.entries(scores).filter(([, v]) => Number.isFinite(Number(v)));
  if (entries.length < 3) {
    return entries.length
      ? `<ul class="chart-fallback-list">${entries.map(([k, v]) => `<li>${escapeHtml(k.replaceAll('_', ' '))}: ${escapeHtml(v)}</li>`).join('')}</ul>`
      : '';
  }
  const cx = size / 2, cy = size / 2, r = size / 2 - 28;
  const n = entries.length;
  const angleFor = i => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pointFor = (i, value) => {
    const ratio = Math.max(0, Math.min(1, Number(value) / maxValue));
    const a = angleFor(i);
    return [cx + Math.cos(a) * r * ratio, cy + Math.sin(a) * r * ratio];
  };
  const axisLines = entries.map((_, i) => {
    const a = angleFor(i);
    return `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(a) * r}" y2="${cy + Math.sin(a) * r}" stroke="${colors.slate100}" stroke-width="1"/>`;
  }).join('');
  const labels = entries.map(([k], i) => {
    const a = angleFor(i);
    const lx = cx + Math.cos(a) * (r + 18);
    const ly = cy + Math.sin(a) * (r + 18);
    const anchor = Math.cos(a) > 0.3 ? 'start' : Math.cos(a) < -0.3 ? 'end' : 'middle';
    return `<text x="${lx}" y="${ly}" font-size="9" fill="${colors.slate500}" text-anchor="${anchor}" dominant-baseline="middle">${escapeHtml(k.replaceAll('_', ' '))}</text>`;
  }).join('');
  // Two or more genuinely low (or zero) axes can land on, or very near, the
  // exact centre point — confirmed on the real model (two components both
  // scoring 0) — where they become visually indistinguishable from a broken
  // render rather than a real, honestly-zero score. Fanning coincident
  // points apart by a few px keeps every dot visible; the printed value
  // label below is what a reader should trust, not the dot's exact spot.
  const seenPoints = new Map();
  const points = entries.map(([, v], i) => {
    const [x, y] = pointFor(i, v);
    const key = `${Math.round(x)},${Math.round(y)}`;
    const collisionIndex = seenPoints.get(key) || 0;
    seenPoints.set(key, collisionIndex + 1);
    if (!collisionIndex) return [x, y];
    const ring = Math.ceil(collisionIndex / 2);
    const sign = collisionIndex % 2 === 1 ? 1 : -1;
    return [x + sign * ring * 5, y - sign * ring * 5];
  });
  const polygonPoints = points.map(p => p.join(',')).join(' ');
  const dots = points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="${colors.blue700}"/>`).join('');
  const valueLabels = entries.map(([, v], i) => {
    const [x, y] = points[i];
    return `<text x="${x}" y="${y - 8}" font-size="8" font-weight="700" fill="${colors.blue700}" text-anchor="middle">${escapeHtml(Math.round(Number(v)))}</text>`;
  }).join('');
  const a11yLabel = chartA11yLabel(`Radar chart. ${entries.map(([k, v]) => `${k.replaceAll('_', ' ')}: ${Math.round(Number(v))}`).join(', ')}.`);
  return `<svg class="radar-chart" role="img" aria-label="${a11yLabel}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    ${axisLines}
    <polygon points="${polygonPoints}" fill="${colors.blue700}" fill-opacity="0.18" stroke="${colors.blue700}" stroke-width="2"/>
    ${dots}
    ${valueLabels}
    ${labels}
  </svg>`;
}

// ------------------------------------------------------------------
// Waffle chart — a real percentage (e.g. full_publication.demographics
// location/sex/age shares) as a 10x10 grid of filled/unfilled cells.
// ------------------------------------------------------------------
export function waffleChart(percentage, label = '', { cellSize = 10, gap = 2, color = colors.blue700 } = {}) {
  if (percentage == null || !Number.isFinite(Number(percentage))) return '';
  const pct = Math.max(0, Math.min(100, Math.round(Number(percentage))));
  const cells = Array.from({ length: 100 }, (_, i) => {
    const row = Math.floor(i / 10), col = i % 10;
    const x = col * (cellSize + gap), y = row * (cellSize + gap);
    const filled = i < pct;
    return `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="1.5" fill="${filled ? color : colors.slate100}"/>`;
  }).join('');
  const side = 10 * (cellSize + gap) - gap;
  const a11yLabel = chartA11yLabel(`${label || 'Waffle chart'}: ${pct} percent.`);
  return `<div class="waffle-chart">
    <svg role="img" aria-label="${a11yLabel}" viewBox="0 0 ${side} ${side}" width="${side}" height="${side}">${cells}</svg>
    <div class="waffle-chart-label"><span class="text-h3" style="color:${color};">${pct}%</span>${label ? `<span class="caption">${escapeHtml(label)}</span>` : ''}</div>
  </div>`;
}

// ------------------------------------------------------------------
// Dumbbell chart — two real values per category (e.g. a region's own score
// vs. the real national average, already computed in buildRegionalSpread).
// ------------------------------------------------------------------
export function dumbbellChart(items = [], { width = 320, labelA = 'A', labelB = 'B', maxValue = 100 } = {}) {
  if (!items.length) return '';
  const rowHeight = 28, leftPad = 110, chartWidth = width - leftPad - 20;
  const height = items.length * rowHeight + 20;
  const xFor = v => leftPad + (Math.max(0, Math.min(maxValue, Number(v) || 0)) / maxValue) * chartWidth;
  const rows = items.map((item, i) => {
    const y = 10 + i * rowHeight + rowHeight / 2;
    const xa = xFor(item.valueA), xb = xFor(item.valueB);
    return `
      <text x="0" y="${y}" font-size="10" fill="${colors.slate900}" dominant-baseline="middle">${escapeHtml(item.label)}</text>
      <line x1="${xa}" y1="${y}" x2="${xb}" y2="${y}" stroke="${colors.slate100}" stroke-width="3"/>
      <circle cx="${xa}" cy="${y}" r="4.5" fill="${colors.slate500}"/>
      <circle cx="${xb}" cy="${y}" r="4.5" fill="${colors.blue700}"/>`;
  }).join('');
  const a11yLabel = chartA11yLabel(`Dumbbell chart comparing ${labelA} and ${labelB}. ${items.map(item => `${item.label}: ${item.valueA} vs ${item.valueB}`).join(', ')}.`);
  return `<div class="dumbbell-chart">
    <svg role="img" aria-label="${a11yLabel}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${rows}</svg>
    <div class="dumbbell-chart-legend"><span><i style="background:${colors.slate500}"></i>${escapeHtml(labelA)}</span><span><i style="background:${colors.blue700}"></i>${escapeHtml(labelB)}</span></div>
  </div>`;
}

// ------------------------------------------------------------------
// Lollipop chart — a stylistic alternative to a ranked bar list; the same
// already-real ranked data (recommendations, regional scores) with no new
// fields required.
// ------------------------------------------------------------------
export function lollipopChart(items = [], { width = 320, maxValue = 100, color = colors.blue700 } = {}) {
  if (!items.length) return '';
  const rowHeight = 26, leftPad = 130, chartWidth = width - leftPad - 30;
  const height = items.length * rowHeight + 10;
  const xFor = v => leftPad + (Math.max(0, Math.min(maxValue, Number(v) || 0)) / maxValue) * chartWidth;
  const rows = items.map((item, i) => {
    const y = 8 + i * rowHeight + rowHeight / 2;
    const x = xFor(item.value);
    return `
      <text x="0" y="${y}" font-size="10" fill="${colors.slate900}" dominant-baseline="middle">${escapeHtml(item.label)}</text>
      <line x1="${leftPad}" y1="${y}" x2="${x}" y2="${y}" stroke="${colors.slate100}" stroke-width="2"/>
      <circle cx="${x}" cy="${y}" r="5" fill="${color}"/>
      <text x="${x + 10}" y="${y}" font-size="9" fill="${colors.slate500}" dominant-baseline="middle">${escapeHtml(item.value)}</text>`;
  }).join('');
  const a11yLabel = chartA11yLabel(`Ranked chart. ${items.map(item => `${item.label}: ${item.value}`).join(', ')}.`);
  return `<svg class="lollipop-chart" role="img" aria-label="${a11yLabel}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${rows}</svg>`;
}

// ------------------------------------------------------------------
// Treemap — proportional areas from real counts (e.g. evidence grouped by
// region, or recommendations grouped by priority tier). A simple
// single-row, width-proportional slice rather than a full squarified
// packing algorithm — honest about real proportions without the added
// complexity of a recursive packer this codebase has no prior need for.
// ------------------------------------------------------------------
export function treemap(items = [], { width = 340, height = 90 } = {}) {
  const real = items.filter(i => Number(i.value) > 0);
  const total = real.reduce((s, i) => s + Number(i.value), 0);
  if (!total) return '';
  const palette = [colors.blue700, colors.teal700, colors.gold500, colors.slate500, colors.blue800, colors.teal600];
  let x = 0;
  const rects = real.map((item, i) => {
    const w = (Number(item.value) / total) * width;
    const rect = `<rect x="${x}" y="0" width="${w}" height="${height}" fill="${palette[i % palette.length]}"/>` +
      (w > 40 ? `<text x="${x + 6}" y="18" font-size="10" fill="#fff">${escapeHtml(item.label)}</text><text x="${x + 6}" y="32" font-size="9" fill="#fff" fill-opacity="0.85">${escapeHtml(item.value)}</text>` : '');
    x += w;
    return rect;
  }).join('');
  const a11yLabel = chartA11yLabel(`Proportional breakdown across ${real.length} categories. ${real.map(item => `${item.label}: ${item.value}`).join(', ')}.`);
  return `<svg class="treemap-chart" role="img" aria-label="${a11yLabel}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${rects}</svg>`;
}

// ------------------------------------------------------------------
// Simplified two-column flow diagram (Sankey-style, not a full multi-stage
// Sankey) — real categorical groupings only, e.g. recommendation priority
// tier -> implementation timeline bucket, both already computed elsewhere
// in the composer (priorityToAxis / parseTimelineBucket groupings).
// ------------------------------------------------------------------
export function flowDiagram(flows = [], { width = 340, height = 160, leftLabel = '', rightLabel = '' } = {}) {
  const real = flows.filter(f => Number(f.count) > 0);
  if (!real.length) return '';
  const leftNodes = [...new Set(real.map(f => f.from))];
  const rightNodes = [...new Set(real.map(f => f.to))];
  const total = real.reduce((s, f) => s + Number(f.count), 0);
  const nodeWidth = 10, colGap = width - nodeWidth * 2 - 40;
  const layout = (nodes, x) => {
    let y = 10;
    const map = new Map();
    for (const n of nodes) {
      const nodeTotal = real.filter(f => f.from === n || f.to === n).reduce((s, f) => s + Number(f.count), 0);
      const h = Math.max(6, (nodeTotal / total) * (height - 20));
      map.set(n, { y, h, x });
      y += h + 6;
    }
    return map;
  };
  const leftMap = layout(leftNodes, 20);
  const rightMap = layout(rightNodes, 20 + nodeWidth + colGap);
  const leftCursor = new Map(leftNodes.map(n => [n, leftMap.get(n).y]));
  const rightCursor = new Map(rightNodes.map(n => [n, rightMap.get(n).y]));
  const bands = real.map(f => {
    const l = leftMap.get(f.from), r = rightMap.get(f.to);
    const bandH = Math.max(2, (Number(f.count) / total) * (height - 20));
    const y1 = leftCursor.get(f.from), y2 = rightCursor.get(f.to);
    leftCursor.set(f.from, y1 + bandH);
    rightCursor.set(f.to, y2 + bandH);
    const x1 = l.x + nodeWidth, x2 = r.x;
    const midX = (x1 + x2) / 2;
    return `<path d="M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2} L${x2},${y2 + bandH} C${midX},${y2 + bandH} ${midX},${y1 + bandH} ${x1},${y1 + bandH} Z" fill="${colors.blue700}" fill-opacity="0.28"/>`;
  }).join('');
  const nodeRects = (map) => [...map.entries()].map(([n, { x, y, h }]) =>
    `<rect x="${x}" y="${y}" width="${nodeWidth}" height="${h}" fill="${colors.blue700}"/><text x="${x + nodeWidth + 4}" y="${y + h / 2}" font-size="9" fill="${colors.slate900}" dominant-baseline="middle">${escapeHtml(n)}</text>`
  ).join('');
  const rightNodeRects = [...rightMap.entries()].map(([n, { x, y, h }]) =>
    `<rect x="${x}" y="${y}" width="${nodeWidth}" height="${h}" fill="${colors.teal700}"/><text x="${x - 4}" y="${y + h / 2}" font-size="9" fill="${colors.slate900}" text-anchor="end" dominant-baseline="middle">${escapeHtml(n)}</text>`
  ).join('');
  const a11yLabel = chartA11yLabel(`Flow diagram${leftLabel || rightLabel ? ` from ${leftLabel} to ${rightLabel}` : ''}. ${real.map(f => `${f.from} to ${f.to}: ${f.count}`).join(', ')}.`);
  return `<div class="flow-diagram">
    ${leftLabel || rightLabel ? `<div class="flow-diagram-labels"><span>${escapeHtml(leftLabel)}</span><span>${escapeHtml(rightLabel)}</span></div>` : ''}
    <svg role="img" aria-label="${a11yLabel}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${bands}${nodeRects(leftMap)}${rightNodeRects}</svg>
  </div>`;
}

// ------------------------------------------------------------------
// Uncertainty band — a confidence score positioned within its REAL
// classification band range (from classifyVRDSConfidence's own thresholds:
// 90/75/60/40), not a fabricated statistical confidence interval. Reuses
// classifyVRDSConfidence rather than reimplementing its banding logic.
// ------------------------------------------------------------------
const CONFIDENCE_BAND_RANGES = [
  { level: 'insufficient', min: 0, max: 40 },
  { level: 'low', min: 40, max: 60 },
  { level: 'moderate', min: 60, max: 75 },
  { level: 'strong', min: 75, max: 90 },
  { level: 'excellent', min: 90, max: 100 },
];

export function uncertaintyBand(score, band, { width = 240 } = {}) {
  const n = Number(score);
  if (!Number.isFinite(n) || !band) return '';
  const range = CONFIDENCE_BAND_RANGES.find(r => r.level === band.level) || CONFIDENCE_BAND_RANGES[0];
  const segments = CONFIDENCE_BAND_RANGES.map(r => {
    const x = (r.min / 100) * width, w = ((r.max - r.min) / 100) * width;
    const isCurrent = r.level === range.level;
    return `<rect x="${x}" y="6" width="${w}" height="10" fill="${isCurrent ? band.color : colors.slate100}" fill-opacity="${isCurrent ? 1 : 0.6}"/>`;
  }).join('');
  const markerX = (Math.max(0, Math.min(100, n)) / 100) * width;
  const a11yLabel = chartA11yLabel(`Confidence level: ${n} percent, classified as ${range.level}.`);
  return `<svg class="uncertainty-band" role="img" aria-label="${a11yLabel}" viewBox="0 0 ${width} 26" width="${width}" height="26">
    ${segments}
    <line x1="${markerX}" y1="0" x2="${markerX}" y2="22" stroke="${colors.slate900}" stroke-width="2"/>
    <text x="${markerX}" y="24" font-size="8" fill="${colors.slate900}" text-anchor="middle">${escapeHtml(n)}%</text>
  </svg>`;
}

// ------------------------------------------------------------------
// Scenario fan — VPX Release 1. An independent editorial review found
// Scenarios & Outlook was the one page in the whole publication with no
// visual anchor at all (three plain text cards). This diverges 2+ real,
// already-assigned qualitative confidence labels (e.g. "High",
// "Moderate", "Low-moderate" — every one of this model's scenario
// objects already carries one) into arms of different length from one
// shared origin. Arm length encodes ORDINAL RANK ONLY; no numeric
// probability or percentage is invented or displayed anywhere — the real
// label is the only text rendered, matching the same "honest alternative,
// never fabricate" discipline as every other chart in this file.
// ------------------------------------------------------------------
const SCENARIO_CONFIDENCE_RANK = { high: 3, moderate: 2, 'low-moderate': 1, low: 1 };
const SCENARIO_CONFIDENCE_COLOR = { high: confidenceColors.excellent, moderate: confidenceColors.moderate, 'low-moderate': confidenceColors.low, low: confidenceColors.low };

// Product Experience Evolution Phase 2C (Editorial Art Direction): the
// original version drew each scenario as one bare stroked line — three
// sticks radiating from a point, with no reference scale, closer to a
// sketch than a published forecasting graphic. Real institutional fan
// charts (Bank of England Inflation Report, IMF WEO) communicate a widening
// band of confidence, not a single line, and always carry a faint scale a
// reader can calibrate against. This redraws each arm as a filled wedge
// (a real, if simple, "confidence cone") sized by the SAME real ordinal
// rank as before — no new data, no invented probability — and adds three
// faint concentric reference arcs purely as a reading aid (a scale, not a
// data series), so the chart reads as a measuring instrument rather than
// three disconnected sticks.
export function scenarioFan(scenarios = [], { width = 320, height = 150 } = {}) {
  const real = scenarios.filter(s => s.name && s.confidence);
  if (real.length < 2) return '';
  const rankOf = c => SCENARIO_CONFIDENCE_RANK[String(c).toLowerCase()] || 1;
  const maxRank = Math.max(...real.map(s => rankOf(s.confidence)));
  const originX = 16, originY = height / 2;
  const maxLen = width - originX - 120;
  const angleStep = real.length > 1 ? 26 / (real.length - 1) : 0;
  const startAngle = -13;
  const wedgeSpreadDeg = 6;
  const arcAt = r => `M ${(originX + r).toFixed(1)} ${originY.toFixed(1)} A ${r} ${r} 0 0 1 ${(originX + r * Math.cos((13 * Math.PI) / 180)).toFixed(1)} ${(originY + r * Math.sin((13 * Math.PI) / 180)).toFixed(1)}`;
  const referenceArcs = [0.34, 0.67, 1].map(f => `<path d="${arcAt(maxLen * f)}" fill="none" stroke="${colors.slate500}" stroke-opacity="0.18" stroke-width="1"/>`).join('');
  // Phase 2C fix: two arms with close ordinal ranks land at close angles and
  // near-identical lengths, so their two-line labels can overlap illegibly
  // when placed exactly at each arm's own endpoint (confirmed by directly
  // viewing a real render — "Targeted reform" collided with "Accelerated
  // reform"'s confidence line). This computes every endpoint first, then
  // walks them top-to-bottom enforcing a minimum label gap, exactly the
  // de-collision pass a real graphics desk would run before publishing —
  // the arm/wedge/dot stay at the true data point; only the text block
  // moves, with a thin leader line added whenever it moves more than a
  // few pixels so the label-to-arm mapping stays unambiguous.
  const endpoints = real.map((s, i) => {
    const angle = ((startAngle + i * angleStep) * Math.PI) / 180;
    const len = Math.max(30, (rankOf(s.confidence) / maxRank) * maxLen);
    return { s, angle, len, x2: originX + Math.cos(angle) * len, y2: originY + Math.sin(angle) * len };
  });
  const minLabelGap = 26;
  let prevLabelY = -Infinity;
  const withLabelY = endpoints.slice().sort((a, b) => a.y2 - b.y2).map(e => {
    const labelY = Math.max(e.y2, prevLabelY + minLabelGap);
    prevLabelY = labelY;
    return { ...e, labelY };
  });
  const byOriginalOrder = new Map(withLabelY.map(e => [e.s, e]));
  const arms = real.map(s => {
    const { angle, len, x2, y2, labelY } = byOriginalOrder.get(s);
    const spread = (wedgeSpreadDeg * Math.PI) / 180;
    const xTop = originX + Math.cos(angle - spread / 2) * len, yTop = originY + Math.sin(angle - spread / 2) * len;
    const xBot = originX + Math.cos(angle + spread / 2) * len, yBot = originY + Math.sin(angle + spread / 2) * len;
    const color = SCENARIO_CONFIDENCE_COLOR[String(s.confidence).toLowerCase()] || colors.slate500;
    const labelMoved = Math.abs(labelY - y2) > 3;
    const leader = labelMoved ? `<line x1="${(x2 + 6).toFixed(1)}" y1="${y2.toFixed(1)}" x2="${(x2 + 10).toFixed(1)}" y2="${labelY.toFixed(1)}" stroke="${colors.slate500}" stroke-opacity="0.4" stroke-width="1"/>` : '';
    return `<path d="M ${originX} ${originY} L ${xTop.toFixed(1)} ${yTop.toFixed(1)} L ${xBot.toFixed(1)} ${yBot.toFixed(1)} Z" fill="${color}" fill-opacity="0.22"/>
      <line x1="${originX}" y1="${originY}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="5" fill="${color}"/>
      ${leader}
      <text x="${x2 + 10}" y="${(labelY - 5).toFixed(1)}" font-size="10" font-weight="700" fill="${colors.slate900}">${escapeHtml(s.name)}</text>
      <text x="${x2 + 10}" y="${(labelY + 9).toFixed(1)}" font-size="9" fill="${colors.slate500}">${escapeHtml(s.confidence)} confidence</text>`;
  }).join('');
  const a11yLabel = chartA11yLabel(`Scenario comparison. ${real.map(s => `${s.name}: ${s.confidence} confidence`).join(', ')}.`);
  return `<svg class="scenario-fan" role="img" aria-label="${a11yLabel}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    ${referenceArcs}
    ${arms}
    <circle cx="${originX}" cy="${originY}" r="4" fill="${colors.slate900}"/>
  </svg>`;
}

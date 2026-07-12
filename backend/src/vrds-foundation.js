export const VRDS_VERSION = '1.0.0-phase-a';

export const vrdsTokens = Object.freeze({
  colors: {
    blue900: '#071A33', blue800: '#0B2D57', blue700: '#124C8C', teal700: '#007C7A', teal600: '#009C96',
    gold500: '#D9A441', green600: '#1F8A4C', amber500: '#E5A100', orange600: '#E67E22', red600: '#C0392B',
    slate900: '#111827', slate700: '#374151', slate500: '#6B7280', slate100: '#F3F6FA', white: '#FFFFFF'
  },
  evidenceColors: {
    raw: '#1F8A4C', reportModel: '#124C8C', syntheticDemo: '#7C3AED', limited: '#E5A100', none: '#6B7280'
  },
  confidenceColors: {
    excellent: '#1F8A4C', strong: '#009C96', moderate: '#E5A100', low: '#E67E22', insufficient: '#C0392B'
  },
  riskColors: { low: '#1F8A4C', medium: '#E5A100', high: '#E67E22', critical: '#C0392B' },
  spacing: { 4: 4, 8: 8, 12: 12, 16: 16, 24: 24, 32: 32, 48: 48, 64: 64, 96: 96 },
  radius: { sm: 6, md: 10, card: 16, panel: 24, page: 28 },
  grid: { htmlColumns: 12, pdfColumns: 6, pptColumns: 12, maxWidth: 1440, sidebarWidth: 280, evidencePanelWidth: 360 },
  typography: {
    fontSans: 'Inter, Segoe UI, Roboto, Arial, sans-serif',
    scale: { displayXL: 56, displayL: 48, displayM: 40, h1: 34, h2: 28, h3: 24, h4: 20, bodyLarge: 18, body: 16, bodySmall: 14, caption: 12, footnote: 10 },
    lineHeight: { tight: 1.08, heading: 1.18, body: 1.55, caption: 1.35 }
  }
});

export const vrdsExportTokens = Object.freeze({
  pdf: { pageSize: 'A4', marginMm: 18, headerMm: 12, footerMm: 10, minDpi: 300, grayscaleSafe: true },
  letter: { pageSize: 'US Letter', marginIn: 0.72, grayscaleSafe: true },
  pptx: { layout: 'LAYOUT_WIDE', width: 13.333, height: 7.5, safeZonePx: 96, maxWordsPerSlide: 45 },
  html: { maxWidth: 1440, sidebarWidth: 280, evidencePanelWidth: 360, mobileBreakpoint: 768 }
});

export const vrdsComponents = Object.freeze([
  'cover', 'executiveSnapshot', 'executiveBrief', 'kpiCard', 'insightCard', 'evidenceCard',
  'recommendationCard', 'riskCard', 'opportunityCard', 'methodologyCard', 'qualityCard', 'sdgCard',
  'timeline', 'decisionMatrix', 'riskMatrix', 'confidenceBadge', 'navigationSidebar', 'assistantPanel'
]);

export function classifyVRDSConfidence(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return { label: 'Not assessed', level: 'insufficient', color: vrdsTokens.confidenceColors.insufficient };
  if (n >= 90) return { label: 'Excellent', level: 'excellent', color: vrdsTokens.confidenceColors.excellent };
  if (n >= 75) return { label: 'Strong', level: 'strong', color: vrdsTokens.confidenceColors.strong };
  if (n >= 60) return { label: 'Moderate', level: 'moderate', color: vrdsTokens.confidenceColors.moderate };
  if (n >= 40) return { label: 'Low', level: 'low', color: vrdsTokens.confidenceColors.low };
  return { label: 'Insufficient', level: 'insufficient', color: vrdsTokens.confidenceColors.insufficient };
}

export function getVRDSEvidenceStyle(evidenceType = '') {
  const text = String(evidenceType).toLowerCase();
  if (text.includes('raw')) return { label: 'Raw-source evidence', level: 'raw', color: vrdsTokens.evidenceColors.raw };
  if (text.includes('synthetic') || text.includes('demo')) return { label: 'Synthetic demo evidence', level: 'syntheticDemo', color: vrdsTokens.evidenceColors.syntheticDemo };
  if (text.includes('limited') || text.includes('insufficient')) return { label: 'Insufficient verified evidence', level: 'limited', color: vrdsTokens.evidenceColors.limited };
  return { label: 'Report-model evidence', level: 'reportModel', color: vrdsTokens.evidenceColors.reportModel };
}

export function getVRDSComponentSpec(name) {
  const specs = {
    cover: { required: ['title', 'reportType', 'organization', 'country', 'date', 'status'], optional: ['version', 'classification'] },
    executiveSnapshot: { required: ['kpis', 'decisionRequired', 'confidence'], optional: ['riskLevel', 'evidenceQuality'] },
    executiveBrief: { required: ['headline', 'keyFindings', 'criticalRisks', 'recommendedDecisions', 'confidence'], optional: ['expectedImpact'] },
    kpiCard: { required: ['label', 'value', 'interpretation'], optional: ['trend', 'target', 'evidenceType'] },
    insightCard: { required: ['headline', 'interpretation', 'evidenceBasis'], optional: ['affectedGroup', 'implication'] },
    evidenceCard: { required: ['claim', 'evidenceType', 'confidence'], optional: ['question', 'quote', 'audio', 'consent'] },
    recommendationCard: { required: ['action', 'priority', 'owner', 'timeline', 'evidenceBasis'], optional: ['expectedImpact', 'dependency'] },
    riskCard: { required: ['risk', 'likelihood', 'severity', 'mitigation'], optional: ['owner', 'affectedGroup'] },
    opportunityCard: { required: ['opportunity', 'evidence', 'expectedBenefit'], optional: ['difficulty', 'owner'] },
    methodologyCard: { required: ['sampleSize', 'geography', 'channels', 'limitations'], optional: ['consentCoverage', 'confidenceLevel'] },
    qualityCard: { required: ['score', 'dimensions'], optional: ['missingData', 'fraudFlags', 'biasRisk'] },
    sdgCard: { required: ['goalNumber', 'goalLabel', 'contribution', 'evidenceType'], optional: ['target'] },
    timeline: { required: ['phase', 'action', 'owner'], optional: ['dependency', 'status'] },
    decisionMatrix: { required: ['impact', 'effort', 'actions'], optional: ['owner'] },
    riskMatrix: { required: ['likelihood', 'impact', 'risks'], optional: ['mitigation'] },
    confidenceBadge: { required: ['score', 'label'], optional: ['explanation'] },
    navigationSidebar: { required: ['sections'], optional: ['progress'] },
    assistantPanel: { required: ['actions'], optional: ['evidenceContext'] }
  };
  return specs[name] || null;
}

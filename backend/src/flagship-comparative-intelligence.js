// Comparative Intelligence — PX Release 10, Part 4.
//
// Pure arithmetic over real, already-governed data (regional primary_score,
// evidence confidence_score) — no external benchmark, no invented prior
// period, no fabricated trend. Where the brief asks for a comparison this
// model genuinely cannot support (e.g. "strongest improvement" needs a
// prior-period regional score, which does not exist anywhere in this
// governed model), this module says so explicitly rather than inventing
// a plausible-sounding number — the same discipline every other file in
// this family already follows for missing fields.
export const FLAGSHIP_COMPARATIVE_INTELLIGENCE_VERSION = 'flagship-comparative-intelligence-v1';

function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function compareRegionalPerformance(regional = []) {
  if (!regional.length) return null;
  const byScore = [...regional].sort((a, b) => b.primary_score - a.primary_score);
  const highest = byScore[0];
  const lowest = byScore[byScore.length - 1];
  const scores = regional.map(r => r.primary_score);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const med = median(scores);
  const byDistanceFromMean = [...regional].sort((a, b) => Math.abs(a.primary_score - mean) - Math.abs(b.primary_score - mean));
  return {
    highest: { name: highest.name, score: highest.primary_score },
    lowest: { name: lowest.name, score: lowest.primary_score },
    largestDisparity: highest.primary_score - lowest.primary_score,
    aboveMedian: regional.filter(r => r.primary_score > med).map(r => r.name),
    belowMedian: regional.filter(r => r.primary_score < med).map(r => r.name),
    median: med,
    mostConsistent: { name: byDistanceFromMean[0].name, score: byDistanceFromMean[0].primary_score },
    leastConsistent: { name: byDistanceFromMean[byDistanceFromMean.length - 1].name, score: byDistanceFromMean[byDistanceFromMean.length - 1].primary_score },
    // Honestly unavailable rather than fabricated: no prior-period regional
    // score exists anywhere in this governed model to compare against.
    strongestImprovement: null,
    strongestImprovementRationale: 'Not available — this publication carries one measurement period per region, not a prior-period score to compare against.',
  };
}

export function compareEvidenceStrength(evidence = []) {
  const withScores = evidence.filter(e => Number.isFinite(e?.confidence_score));
  if (!withScores.length) return null;
  const sorted = [...withScores].sort((a, b) => b.confidence_score - a.confidence_score);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  return {
    strongestEvidence: { id: strongest.id, confidence_score: strongest.confidence_score, region: strongest.region },
    largestUncertainty: { id: weakest.id, confidence_score: weakest.confidence_score, region: weakest.region },
  };
}

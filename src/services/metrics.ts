import { getBackend } from '../storage/index.js';
import type { AccuracyStats } from '../storage/types.js';

export type { AccuracyStats } from '../storage/types.js';

const LEVEL_NAMES: Record<number, string> = {
  0: 'Cold start',
  1: 'Normal',
  2: 'Confident',
  3: 'Auto-recycle',
};

export function loadStats(): AccuracyStats {
  return getBackend().loadStats();
}

export function saveStats(stats: AccuracyStats): void {
  getBackend().saveStats(stats);
}

export const DEFAULT_MAX_ERROR_RATE = 0.05;
export const DEFAULT_FN_WEIGHT = 2;   // FNs (wrongly ignored) penalized 2x by default
export const DEFAULT_FP_WEIGHT = 1;   // FPs (wrongly sent to review/inbox) baseline

export interface Metrics {
  level: number;
  levelName: string;
  lifetimeTotal: number;
  lifetimePrecision: number;
  lifetimeRecall: number;
  rollingTotal: number;
  rollingPrecision: number;
  rollingRecall: number;
  rollingFpRate: number;
  rollingFnRate: number;
  rollingErrorRate: number;     // weighted error rate used for demotion gate
  maxErrorRate: number;
  fnWeight: number;
  fpWeight: number;
  errorExceeded: boolean;
  reviewIgnoredPasses: number;
  lastReviewIgnored: string | null;
  lifetime: { tp: number; fp: number; tn: number; fn: number };
  rolling: { tp: number; fp: number; tn: number; fn: number };
}

export function computeMetrics(stats: AccuracyStats): Metrics {
  const lt = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (const source of Object.values(stats.lifetime)) {
    lt.tp += source.tp;
    lt.fp += source.fp;
    lt.tn += source.tn;
    lt.fn += source.fn;
  }
  const ltTotal = lt.tp + lt.fp + lt.tn + lt.fn;
  const ltPrecision = lt.tp + lt.fp > 0 ? lt.tp / (lt.tp + lt.fp) : 0;
  const ltRecall = lt.tp + lt.fn > 0 ? lt.tp / (lt.tp + lt.fn) : 0;

  const rw = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (const entry of stats.rolling_window || []) {
    if (entry.signal in rw) rw[entry.signal as keyof typeof rw]++;
  }
  const rwTotal = rw.tp + rw.fp + rw.tn + rw.fn;
  const rwPrecision = rw.tp + rw.fp > 0 ? rw.tp / (rw.tp + rw.fp) : 0;
  const rwRecall = rw.tp + rw.fn > 0 ? rw.tp / (rw.tp + rw.fn) : 0;
  const rwFpRate = rwTotal > 0 ? rw.fp / rwTotal : 0;
  const rwFnRate = rwTotal > 0 ? rw.fn / rwTotal : 0;
  const fnWeight = stats.fn_weight ?? DEFAULT_FN_WEIGHT;
  const fpWeight = stats.fp_weight ?? DEFAULT_FP_WEIGHT;
  const maxErrorRate = stats.max_error_rate ?? DEFAULT_MAX_ERROR_RATE;

  // Weighted error rate: weight per error, normalized so that an "all errors" window
  // with the heavier class scores 1.0. This keeps maxErrorRate interpretable as a
  // fraction of the window regardless of weight choice.
  const maxWeight = Math.max(fnWeight, fpWeight, 1);
  const rollingErrorRate = rwTotal > 0
    ? (rw.fn * fnWeight + rw.fp * fpWeight) / (rwTotal * maxWeight)
    : 0;

  return {
    level: stats.autonomy_level,
    levelName: LEVEL_NAMES[stats.autonomy_level] || 'Unknown',
    lifetimeTotal: ltTotal,
    lifetimePrecision: ltPrecision,
    lifetimeRecall: ltRecall,
    rollingTotal: rwTotal,
    rollingPrecision: rwPrecision,
    rollingRecall: rwRecall,
    rollingFpRate: rwFpRate,
    rollingFnRate: rwFnRate,
    rollingErrorRate,
    maxErrorRate,
    fnWeight,
    fpWeight,
    errorExceeded: rwTotal >= 20 && rollingErrorRate > maxErrorRate,
    reviewIgnoredPasses: stats.review_ignored_passes,
    lastReviewIgnored: stats.last_review_ignored,
    lifetime: lt,
    rolling: rw,
  };
}

export function addSignal(
  stats: AccuracyStats,
  source: 'instapaper' | 'rss',
  signal: 'tp' | 'fp' | 'tn' | 'fn',
  title: string
): void {
  const src = stats.lifetime[source];
  if (!src) {
    console.warn(`Unknown signal source: ${source}, defaulting to rss`);
    stats.lifetime.rss[signal]++;
    return;
  }
  src[signal]++;

  stats.rolling_window.push({
    date: new Date().toISOString().slice(0, 10),
    source,
    signal,
    title,
  });

  // Trim to rolling window size. Read-modify-write is safe here because
  // synchronous code runs atomically in Node's event loop.
  if (stats.rolling_window.length > 50) {
    stats.rolling_window = stats.rolling_window.slice(-50);
  }
}


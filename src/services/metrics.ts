import { readFileSync, writeFileSync, existsSync } from 'fs';
import yaml from 'js-yaml';
import { CONFIG } from '../config.js';

export interface AccuracyStats {
  autonomy_level: number;
  lifetime: {
    instapaper: { tp: number; fp: number; tn: number; fn: number };
    rss: { tp: number; fp: number; tn: number; fn: number };
  };
  rolling_window: Array<{ date: string; source: string; signal: string; title: string }>;
  review_ignored_passes: number;
  last_review_ignored: string | null;
}

const LEVEL_NAMES: Record<number, string> = {
  0: 'Cold start',
  1: 'Normal',
  2: 'Confident',
  3: 'Auto-recycle',
};

export function loadStats(): AccuracyStats {
  if (!existsSync(CONFIG.accuracyStats)) {
    return {
      autonomy_level: 0,
      lifetime: {
        instapaper: { tp: 0, fp: 0, tn: 0, fn: 0 },
        rss: { tp: 0, fp: 0, tn: 0, fn: 0 },
      },
      rolling_window: [],
      review_ignored_passes: 0,
      last_review_ignored: null,
    };
  }
  return yaml.load(readFileSync(CONFIG.accuracyStats, 'utf-8')) as AccuracyStats;
}

export function saveStats(stats: AccuracyStats): void {
  writeFileSync(CONFIG.accuracyStats, yaml.dump(stats, { sortKeys: false }));
}

export interface Metrics {
  level: number;
  levelName: string;
  lifetimeTotal: number;
  lifetimePrecision: number;
  lifetimeRecall: number;
  rollingTotal: number;
  rollingPrecision: number;
  rollingRecall: number;
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

  return {
    level: stats.autonomy_level,
    levelName: LEVEL_NAMES[stats.autonomy_level] || 'Unknown',
    lifetimeTotal: ltTotal,
    lifetimePrecision: ltPrecision,
    lifetimeRecall: ltRecall,
    rollingTotal: rwTotal,
    rollingPrecision: rwPrecision,
    rollingRecall: rwRecall,
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
  const src = stats.lifetime[source] || stats.lifetime.rss;
  src[signal]++;

  stats.rolling_window.push({
    date: new Date().toISOString().slice(0, 10),
    source,
    signal,
    title,
  });

  // Keep rolling window at max 50
  while (stats.rolling_window.length > 50) {
    stats.rolling_window.shift();
  }
}

export function levelName(level: number): string {
  return LEVEL_NAMES[level] || 'Unknown';
}

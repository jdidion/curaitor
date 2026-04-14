import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeMetrics, addSignal } from '../services/metrics.js';
import type { AccuracyStats } from '../storage/types.js';

function makeEmptyStats(overrides?: Partial<AccuracyStats>): AccuracyStats {
  return {
    autonomy_level: 0,
    lifetime: {
      instapaper: { tp: 0, fp: 0, tn: 0, fn: 0 },
      rss: { tp: 0, fp: 0, tn: 0, fn: 0 },
    },
    rolling_window: [],
    review_ignored_passes: 0,
    last_review_ignored: null,
    ...overrides,
  };
}

describe('computeMetrics', () => {
  it('returns all zeros with no division errors when stats are empty', () => {
    const stats = makeEmptyStats();
    const m = computeMetrics(stats);
    expect(m.lifetimeTotal).toBe(0);
    expect(m.lifetimePrecision).toBe(0);
    expect(m.lifetimeRecall).toBe(0);
    expect(m.rollingTotal).toBe(0);
    expect(m.rollingPrecision).toBe(0);
    expect(m.rollingRecall).toBe(0);
    expect(m.level).toBe(0);
    expect(m.levelName).toBe('Cold start');
  });

  it('computes correct precision and recall with balanced stats', () => {
    const stats = makeEmptyStats({
      lifetime: {
        instapaper: { tp: 10, fp: 2, tn: 5, fn: 3 },
        rss: { tp: 5, fp: 1, tn: 10, fn: 2 },
      },
    });
    const m = computeMetrics(stats);
    // tp=15, fp=3, tn=15, fn=5
    expect(m.lifetimeTotal).toBe(38);
    expect(m.lifetime.tp).toBe(15);
    expect(m.lifetime.fp).toBe(3);
    expect(m.lifetime.tn).toBe(15);
    expect(m.lifetime.fn).toBe(5);
  });

  it('computes precision as TP / (TP + FP)', () => {
    const stats = makeEmptyStats({
      lifetime: {
        instapaper: { tp: 8, fp: 2, tn: 0, fn: 0 },
        rss: { tp: 0, fp: 0, tn: 0, fn: 0 },
      },
    });
    const m = computeMetrics(stats);
    expect(m.lifetimePrecision).toBeCloseTo(0.8);  // 8 / (8+2)
  });

  it('computes recall as TP / (TP + FN)', () => {
    const stats = makeEmptyStats({
      lifetime: {
        instapaper: { tp: 6, fp: 0, tn: 0, fn: 4 },
        rss: { tp: 0, fp: 0, tn: 0, fn: 0 },
      },
    });
    const m = computeMetrics(stats);
    expect(m.lifetimeRecall).toBeCloseTo(0.6);  // 6 / (6+4)
  });

  it('aggregates rolling window signals correctly', () => {
    const stats = makeEmptyStats({
      rolling_window: [
        { date: '2026-04-01', source: 'rss', signal: 'tp', title: 'A' },
        { date: '2026-04-02', source: 'rss', signal: 'fp', title: 'B' },
        { date: '2026-04-03', source: 'instapaper', signal: 'tp', title: 'C' },
        { date: '2026-04-04', source: 'rss', signal: 'fn', title: 'D' },
      ],
    });
    const m = computeMetrics(stats);
    expect(m.rollingTotal).toBe(4);
    expect(m.rolling.tp).toBe(2);
    expect(m.rolling.fp).toBe(1);
    expect(m.rolling.fn).toBe(1);
    expect(m.rolling.tn).toBe(0);
    expect(m.rollingPrecision).toBeCloseTo(2 / 3);  // 2 / (2+1)
    expect(m.rollingRecall).toBeCloseTo(2 / 3);     // 2 / (2+1)
  });

  it('reports autonomy level and name', () => {
    const stats = makeEmptyStats({ autonomy_level: 2 });
    const m = computeMetrics(stats);
    expect(m.level).toBe(2);
    expect(m.levelName).toBe('Confident');
  });

  it('reports review_ignored_passes and last_review_ignored', () => {
    const stats = makeEmptyStats({
      review_ignored_passes: 3,
      last_review_ignored: '2026-04-01',
    });
    const m = computeMetrics(stats);
    expect(m.reviewIgnoredPasses).toBe(3);
    expect(m.lastReviewIgnored).toBe('2026-04-01');
  });
});

describe('addSignal', () => {
  it('increments the correct source counter for instapaper tp', () => {
    const stats = makeEmptyStats();
    addSignal(stats, 'instapaper', 'tp', 'Test Article');
    expect(stats.lifetime.instapaper.tp).toBe(1);
    expect(stats.lifetime.rss.tp).toBe(0);
  });

  it('increments the correct source counter for rss fp', () => {
    const stats = makeEmptyStats();
    addSignal(stats, 'rss', 'fp', 'RSS Article');
    expect(stats.lifetime.rss.fp).toBe(1);
  });

  it('appends entry to rolling window', () => {
    const stats = makeEmptyStats();
    addSignal(stats, 'instapaper', 'tn', 'Ignored Article');
    expect(stats.rolling_window).toHaveLength(1);
    expect(stats.rolling_window[0].source).toBe('instapaper');
    expect(stats.rolling_window[0].signal).toBe('tn');
    expect(stats.rolling_window[0].title).toBe('Ignored Article');
    expect(stats.rolling_window[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('caps rolling window at 50 entries', () => {
    const stats = makeEmptyStats({
      rolling_window: Array.from({ length: 50 }, (_, i) => ({
        date: '2026-04-01',
        source: 'rss',
        signal: 'tp',
        title: `Article ${i}`,
      })),
    });
    expect(stats.rolling_window).toHaveLength(50);
    addSignal(stats, 'rss', 'fp', 'Article 50');
    expect(stats.rolling_window).toHaveLength(50);
    // Oldest entry was removed, newest is at the end
    expect(stats.rolling_window[49].title).toBe('Article 50');
    expect(stats.rolling_window[0].title).toBe('Article 1');
  });

  it('logs warning and falls back to rss for unknown source', () => {
    const stats = makeEmptyStats();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Cast to bypass type checking for the unknown source test
    addSignal(stats, 'unknown' as any, 'tp', 'Mystery Article');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown signal source')
    );
    // Falls back to rss
    expect(stats.lifetime.rss.tp).toBe(1);
    expect(stats.lifetime.instapaper.tp).toBe(0);
    warnSpy.mockRestore();
  });
});

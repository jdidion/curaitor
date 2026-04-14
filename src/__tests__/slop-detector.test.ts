import { describe, it, expect } from 'vitest';
import { detectSlop, isLikelySlop } from '../services/slop-detector.js';

describe('detectSlop', () => {
  it('returns score near 0 and label clean for plain human text', () => {
    const text = 'The researchers collected blood samples from 200 patients and ran a standard PCR assay to measure cfDNA concentration across three timepoints.';
    const result = detectSlop(text);
    expect(result.score).toBeLessThan(0.15);
    expect(result.label).toBe('clean');
    expect(result.isSlop).toBe(false);
  });

  it('scores higher and flags tier 1 vocabulary like delve and tapestry', () => {
    const text = 'Let us delve into the rich tapestry of this innovative landscape and explore the nuanced paradigm that underpins modern ecosystems in a holistic manner.';
    const result = detectSlop(text);
    expect(result.score).toBeGreaterThan(0.15);
    expect(result.signals.some(s => s.type === 'vocabulary' && s.severity === 'high')).toBe(true);
    expect(['mild', 'slop', 'heavy-slop']).toContain(result.label);
  });

  it('flags filler phrases like "Here is the thing"', () => {
    const text = "Here's the thing about modern software development: you need to understand the underlying systems before you can build anything meaningful on top of them.";
    const result = detectSlop(text);
    expect(result.signals.some(s => s.type === 'phrase')).toBe(true);
  });

  it('flags filler phrase "Let that sink in"', () => {
    const text = 'Over forty percent of enterprise deployments fail within the first year of production use across all major cloud providers. Let that sink in.';
    const result = detectSlop(text);
    expect(result.signals.some(s => s.type === 'phrase')).toBe(true);
  });

  it('flags structural pattern "It is not X, it is Y"', () => {
    const text = "It's not about writing more code. It's about writing better abstractions that compose cleanly across module boundaries in large systems.";
    const result = detectSlop(text);
    expect(result.signals.some(s => s.type === 'structure')).toBe(true);
  });

  it('flags significance inflation when multiple inflated words appear', () => {
    const text = 'This revolutionary tool is truly game-changing and represents an unprecedented shift in how we approach groundbreaking solutions for modern software teams.';
    const result = detectSlop(text);
    expect(result.signals.some(s => s.type === 'inflation')).toBe(true);
  });

  it('increases score when hasSourceLink is false', () => {
    const text = 'This new framework provides a comprehensive approach to building distributed systems with automatic failover and integrated monitoring for production workloads.';
    const withLink = detectSlop(text, { hasSourceLink: true });
    const withoutLink = detectSlop(text, { hasSourceLink: false });
    expect(withoutLink.score).toBeGreaterThan(withLink.score);
    expect(withoutLink.signals.some(s => s.type === 'substance')).toBe(true);
  });

  it('labels pure slop text with multiple signals as heavy-slop', () => {
    const text = [
      "Here's the thing about this groundbreaking, game-changing paradigm.",
      'Let us delve into the rich tapestry of this innovative landscape.',
      "It's not about code. It's about the holistic ecosystem.",
      'This unprecedented, revolutionary approach will seamlessly transform everything.',
      "The result? A comprehensive, nuanced framework that leverages cutting-edge technology.",
      'Let that sink in. Make no mistake, this is truly transformative and unparalleled.',
    ].join(' ');
    const result = detectSlop(text);
    expect(result.label).toBe('heavy-slop');
    expect(result.isSlop).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.6);
  });

  it('returns score 0 for short text under 10 words', () => {
    const text = 'Short text here.';
    const result = detectSlop(text);
    expect(result.score).toBe(0);
    expect(result.label).toBe('clean');
    expect(result.signals).toHaveLength(0);
  });

  it('does not trigger on "landscaping" when checking for "landscape" (word boundary)', () => {
    const text = 'The landscaping company finished the backyard renovation last week and the results look great from every angle in natural light.';
    const result = detectSlop(text);
    const landscapeSignals = result.signals.filter(
      s => s.type === 'vocabulary' && s.detail === 'landscape'
    );
    expect(landscapeSignals).toHaveLength(0);
  });

  it('detects multi-word phrase "shed light"', () => {
    const text = 'This research aims to shed light on the underlying mechanisms of cellular repair in damaged tissues across multiple organ systems in mammals.';
    const result = detectSlop(text);
    expect(result.signals.some(s => s.detail === 'shed light')).toBe(true);
  });
});

describe('isLikelySlop', () => {
  it('combines title and summary for scoring', () => {
    const title = 'A Comprehensive Deep Dive into the Innovative Landscape';
    const summary = 'This article delves into the tapestry of modern paradigms and leverages robust holistic approaches to navigate the ecosystem.';
    const result = isLikelySlop(title, summary);
    expect(result.score).toBeGreaterThan(0);
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it('treats github.com URLs as having a source link', () => {
    const title = 'New variant caller released';
    const summary = 'A simple tool for calling somatic variants from whole genome sequencing data using standard alignment formats.';
    const withGithub = isLikelySlop(title, summary, 'https://github.com/org/repo');
    const withoutUrl = isLikelySlop(title, summary);
    // github URL means hasSourceLink=true, no URL means hasSourceLink=false
    // The substance penalty should not apply when github URL is present
    const substanceSignalWithUrl = withGithub.signals.some(s => s.type === 'substance');
    expect(substanceSignalWithUrl).toBe(false);
  });

  it('treats non-academic URLs as lacking a source link', () => {
    const title = 'New variant caller released';
    const summary = 'A simple tool for calling somatic variants from whole genome sequencing data using standard alignment formats.';
    const result = isLikelySlop(title, summary, 'https://medium.com/some-article');
    // medium.com is not in the academic/repo pattern, so hasSourceLink=false
    // but the substance signal only fires when hasSourceLink is explicitly false
    // isLikelySlop passes the boolean result of the regex test
    const substanceSignal = result.signals.some(s => s.type === 'substance');
    expect(substanceSignal).toBe(true); // medium.com doesn't match academic pattern, so flagged
  });
});

/**
 * Slop detector — scores articles for AI-generated content likelihood.
 * Synthesized from: salvage skill vocabulary tiers, skill-deslop rubric,
 * tropes.fyi patterns, and slopcop anti-patterns.
 */

// --- Tier 1: near-certain AI signals (always flag) ---
const TIER1_WORDS = new Set([
  'delve', 'tapestry', 'landscape', 'paradigm', 'leverage', 'robust', 'seamless',
  'ecosystem', 'holistic', 'nuanced', 'compelling', 'innovative', 'crucial',
  'multifaceted', 'embark', 'testament', 'spearhead', 'foster', 'underpin',
  'underscore', 'harnessing', 'utilize', 'facilitate', 'endeavor', 'commendable',
  'noteworthy', 'intricate', 'pivotal', 'realm', 'comprehensive', 'indispensable',
  'groundbreaking', 'cutting-edge', 'thought-provoking', 'reimagine', 'resonate',
  'game-changing', 'unlock', 'navigate', 'shed light', 'pave the way',
  'double-edged sword', 'deep dive', 'the power of', 'the art of',
]);

// --- Tier 2: AI signals when clustered (3+ triggers) ---
const TIER2_WORDS = new Set([
  'amplify', 'bolster', 'catalyze', 'curate', 'demystify', 'elevate', 'empower',
  'envision', 'galvanize', 'juxtapose', 'optimize', 'orchestrate', 'proliferate',
  'propel', 'revolutionize', 'streamline', 'synergy', 'synthesize', 'tailor',
  'transcend', 'unpack', 'unveil', 'burgeoning', 'discerning', 'ever-evolving',
  'forward-thinking', 'granular', 'meticulous', 'overarching', 'seminal',
  'transformative', 'unparalleled',
]);

// --- Throat-clearing and filler phrases ---
const FILLER_PATTERNS = [
  /here'?s the (?:thing|deal|kicker)/i,
  /here'?s (?:what|why|where|how)/i,
  /let(?:'s| me) (?:break this down|unpack|explore|dive|delve)/i,
  /think of it (?:as|like)/i,
  /imagine a world/i,
  /in today'?s (?:fast|rapid|ever)/i,
  /in an era of/i,
  /it'?s (?:important|worth) (?:to note|noting)/i,
  /at the end of the day/i,
  /let that sink in/i,
  /full stop\./i,
  /make no mistake/i,
  /the (?:uncomfortable|real|hard) truth/i,
];

// --- Structural patterns ---
const STRUCTURAL_PATTERNS = [
  /it'?s not [\w\s]+[.—–-] it'?s/i,             // negative parallelism
  /not [\w\s]+\. not [\w\s]+\. (?:just|a|but)/i, // not X. not Y. Z.
  /the (?:result|worst part|scary part|kicker)\?/i, // self-posed rhetorical
  /\?\s+[\w]+\./,                                   // question answered immediately
];

// --- Significance inflation ---
const INFLATION_WORDS = new Set([
  'revolutionary', 'game-changing', 'groundbreaking', 'unprecedented',
  'transformative', 'disruptive', 'paradigm-shifting', 'world-class',
  'best-in-class', 'state-of-the-art', 'next-generation', 'bleeding-edge',
]);

export interface SlopSignal {
  type: 'vocabulary' | 'phrase' | 'structure' | 'inflation' | 'substance';
  detail: string;
  severity: 'high' | 'medium' | 'low';
}

export interface SlopResult {
  score: number;          // 0-1 (0 = human, 1 = pure slop)
  label: 'clean' | 'mild' | 'slop' | 'heavy-slop';
  signals: SlopSignal[];
  isSlop: boolean;        // score >= 0.5
}

export function detectSlop(text: string, opts?: { hasSourceLink?: boolean }): SlopResult {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  const wordCount = words.length;
  const signals: SlopSignal[] = [];

  if (wordCount < 10) {
    return { score: 0, label: 'clean', signals: [], isSlop: false };
  }

  let score = 0;

  // --- Tier 1 vocabulary (word-boundary matching to avoid false positives) ---
  let tier1Count = 0;
  for (const word of TIER1_WORDS) {
    const regex = word.includes(' ')
      ? new RegExp(word, 'i')  // multi-word phrases use simple includes
      : new RegExp(`\\b${word}\\b`, 'i');  // single words use word boundaries
    if (regex.test(text)) {
      tier1Count++;
      if (tier1Count <= 3) {
        signals.push({ type: 'vocabulary', detail: word, severity: 'high' });
      }
    }
  }
  score += Math.min(tier1Count * 0.08, 0.4);

  // --- Tier 2 clusters (word-boundary matching) ---
  let tier2Count = 0;
  for (const word of TIER2_WORDS) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(text)) tier2Count++;
  }
  if (tier2Count >= 3) {
    score += Math.min((tier2Count - 2) * 0.05, 0.2);
    signals.push({ type: 'vocabulary', detail: `${tier2Count} tier-2 words clustered`, severity: 'medium' });
  }

  // --- Filler phrases ---
  let fillerCount = 0;
  for (const pattern of FILLER_PATTERNS) {
    if (pattern.test(text)) {
      fillerCount++;
      if (fillerCount <= 2) {
        const match = text.match(pattern);
        signals.push({ type: 'phrase', detail: match?.[0] || 'filler phrase', severity: 'high' });
      }
    }
  }
  score += Math.min(fillerCount * 0.1, 0.3);

  // --- Structural patterns ---
  for (const pattern of STRUCTURAL_PATTERNS) {
    if (pattern.test(text)) {
      score += 0.1;
      signals.push({ type: 'structure', detail: 'AI structural pattern', severity: 'medium' });
    }
  }

  // --- Significance inflation ---
  let inflationCount = 0;
  for (const word of INFLATION_WORDS) {
    if (lower.includes(word)) inflationCount++;
  }
  if (inflationCount >= 2) {
    score += Math.min(inflationCount * 0.06, 0.2);
    signals.push({ type: 'inflation', detail: `${inflationCount} inflated claims`, severity: 'medium' });
  }

  // --- Substance check (no source links = suspicious) ---
  if (opts?.hasSourceLink === false) {
    score += 0.15;
    signals.push({ type: 'substance', detail: 'no source link (repo/paper/tool)', severity: 'medium' });
  }

  // --- Em-dash density ---
  const emDashCount = (text.match(/[—–]/g) || []).length;
  const emDashDensity = emDashCount / (wordCount / 100);
  if (emDashDensity > 2) {
    score += 0.05;
    signals.push({ type: 'structure', detail: `high em-dash density (${emDashCount})`, severity: 'low' });
  }

  // --- Uniform sentence length ---
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  if (sentences.length >= 5) {
    const lengths = sentences.map((s) => s.trim().split(/\s+/).length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((a, b) => a + (b - avg) ** 2, 0) / lengths.length;
    if (variance < 10 && avg > 10) {
      score += 0.05;
      signals.push({ type: 'structure', detail: 'uniform sentence rhythm', severity: 'low' });
    }
  }

  // Clamp
  score = Math.min(score, 1);

  const label = score < 0.15 ? 'clean' : score < 0.35 ? 'mild' : score < 0.6 ? 'slop' : 'heavy-slop';

  return {
    score: Math.round(score * 100) / 100,
    label,
    signals,
    isSlop: score >= 0.5,
  };
}

/**
 * Quick check for article triage — scores title + summary.
 * Returns true if article should be downweighted or recycled.
 */
export function isLikelySlop(title: string, summary: string, url?: string): SlopResult {
  const hasSourceLink = url ? /github\.com|arxiv|doi\.org|biorxiv|nature\.com/.test(url) : false;
  return detectSlop(`${title}\n\n${summary}`, { hasSourceLink });
}

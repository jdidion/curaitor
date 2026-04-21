# Recycle Storage Scale Plan

**Status:** Design. Not yet implemented.
**Owner:** jdidion
**Updated:** 2026-04-21

## Problem

The `Curaitor/Recycle.md` log tracks every article dismissed during triage/review (≈527 entries as of 2026-04-21; growing ~5–20/day). Two operations are becoming O(n):

1. **Dedup probe during triage/discover.** `scripts/triage-write.py` now parses Recycle.md line-by-line to extend the known-URL set (shipped in PR #8, 2026-04-20). Linear scan per triage run. Fine at 1K lines, slow at 10K, untenable at 100K.
2. **Display in the dashboard.** The webapp's recycle route reads the entire file to render counts and recent entries. Same linear cost.

At current growth rate the file crosses 10K entries in ~2 years. We want a solution that stays fast without forcing a premature storage rewrite.

## Goals

- **Fast dedup lookup** (O(log n) or O(1)) as the set grows.
- **Keep markdown as the human-readable source of truth** on the Obsidian backend. Operators should still be able to grep, search, and read the log in Obsidian.
- **No migration pain.** Existing Recycle.md keeps working; new writes transparently upgrade the layout.
- **Backend-appropriate.** Obsidian backend and SQLite backend pick different physical layouts for the same logical operations.

## Non-goals

- Changing the `RecycleEntry` type or the `StorageBackend.{loadRecycle,appendRecycle,clearRecycle,recycleCount}` interface. These stay stable.
- Providing a query language over recycle history (e.g., "show me all recycled biorxiv articles from Q1"). If needed, build on top.
- Cross-backend federation. Each backend owns its own physical layout.

## Approach per backend

### ObsidianBackend (markdown + derived index)

**Physical layout:**

```
<vault>/
├── Curaitor/
│   ├── Recycle.md                  # hot file: last 30 days, human-readable
│   └── Recycle/
│       ├── 2025-11.md              # monthly archives, same line format
│       ├── 2025-12.md
│       ├── 2026-01.md
│       └── ...
└── .curaitor/
    └── recycle-index.tsv           # derived: normalized_url \t month \t title
```

**Writes** (`appendRecycle`):
1. Append one markdown line to `Curaitor/Recycle.md` (unchanged from today's behavior).
2. Append one TSV row to `.curaitor/recycle-index.tsv`.

**Reads** (`loadRecycle`):
- Aggregate hot file + all monthly archives in reverse chronological order. For callers that only need counts (`recycleCount`), read the TSV line count — no markdown parsing needed.

**Dedup probe** (new helper `hasRecycled(url): boolean`):
- Normalize the URL.
- Binary-search or hash-lookup against `.curaitor/recycle-index.tsv`. Loading the TSV once per triage run and keeping it in memory is O(n) space but O(1) amortized per probe across a batch.

**Rotation** (runs on first append of a new month, or lazily on `loadRecycle`):
- Move lines in `Curaitor/Recycle.md` older than 30 days into the appropriate `Curaitor/Recycle/YYYY-MM.md` file.
- Deduplicate by normalized URL within each monthly file (the same article can get recycled multiple times; keep the most recent entry in the month file).
- Rebuild `.curaitor/recycle-index.tsv` from scratch if it's out of sync (checksum mismatch) or missing.

**Tradeoffs:**
- ✓ Human-browsable: Recycle.md stays the natural reading surface; monthly files are obvious to explore in Obsidian's file tree.
- ✓ Atomic writes are append-only on both markdown and TSV; no locking needed for single-writer.
- ✗ TSV drift: if the user edits Recycle.md manually, the TSV may mismatch. Rebuild-on-checksum-mismatch handles this, but it's a linear rebuild.
- ✗ Cross-process writes (triage cron + dashboard user both appending): rely on append-only atomicity via `fs.appendFileSync` + crash recovery (rebuild TSV on mismatch). Not a hot loop.

### SQLiteBackend

**Physical layout:**

A `recycle` table already exists in the SQLite schema (per the earlier migration plan: `id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, url TEXT, category TEXT, is_duplicate INTEGER, created_at TEXT`). Extend with:

```sql
CREATE TABLE recycle (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  url_normalized TEXT NOT NULL,
  category TEXT DEFAULT 'Uncategorized',
  is_duplicate INTEGER DEFAULT 0,
  tag TEXT,                        -- "(duplicate)", "(duplicate from Recycle)", "(slop)", etc.
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_recycle_url_normalized ON recycle(url_normalized);
CREATE INDEX idx_recycle_created_at ON recycle(created_at DESC);
```

**Writes** (`appendRecycle`):
- Single `INSERT`. Normalize URL in application code (same function the dedup probe uses).

**Reads** (`loadRecycle`):
- `SELECT ... ORDER BY created_at DESC LIMIT ?` for bounded callers; full `SELECT *` only if the caller genuinely wants everything.

**Dedup probe** (`hasRecycled`):
- `SELECT 1 FROM recycle WHERE url_normalized = ? LIMIT 1`. Index-backed, O(log n).

**Markdown regeneration** (opt-in): a CLI `npm run export:recycle-md -- --out <path>` emits the same markdown format for callers that need a human-readable snapshot (Obsidian sync from SQLite-backed installations, exports for the /cu:export future work, etc.).

**Tradeoffs:**
- ✓ Single indexed lookup for dedup, O(log n) across millions of rows.
- ✓ Natural sort/filter/search in SQL (e.g., "all recycled entries with tag `slop`").
- ✗ Loses direct human browsability; users have to use the dashboard or an export. Acceptable since SQLite backend is explicitly opt-in.

## Interface changes

**`StorageBackend` interface (`src/storage/types.ts`) gains:**

```typescript
interface StorageBackend {
  // ... existing methods ...

  // Fast membership test. MUST normalize the URL the same way triage-write.py does.
  hasRecycled(url: string): boolean;

  // Optional: bounded recent view for dashboard rendering.
  loadRecycleRecent(limit: number): RecycleEntry[];
}
```

Existing `loadRecycle()`, `appendRecycle()`, `clearRecycle()`, `recycleCount()` stay the same shape. Implementations gain internal indexing per the sections above.

**Script-side** (`scripts/triage-write.py`): already does URL normalization + Recycle.md parsing. Swap it to call a small Python helper that reads `.curaitor/recycle-index.tsv` for O(1) lookup when the TSV exists; fall back to today's line-by-line parse when it doesn't. This keeps the tool dependency-free (no better-sqlite3 in Python).

## Migration

- **First-run on existing vault:** a one-shot `scripts/recycle-reindex.py` walks the existing flat Recycle.md, builds `.curaitor/recycle-index.tsv`, and partitions into monthly files. Safe to re-run.
- **SQLite backend:** `npm run import -- --from obsidian --to sqlite` (already planned in the storage migration spec) populates the new `recycle` table with normalized URLs.

## When to build

- **Triggered when Recycle.md crosses ~5K entries or dedup probes exceed 100ms wall time per triage batch** (measured in `triage-write.py` summary output).
- Until then, the current flat-file implementation is fine. No premature optimization.

## Validation

- **Performance:** microbenchmark `hasRecycled` at 1K, 10K, 100K rows on both backends. Expect <1ms p99 on the indexed path.
- **Correctness:** round-trip test — recycle 500 URLs, verify all 500 dedup on next triage batch, verify manual-edit robustness by corrupting the TSV and re-running (should rebuild silently).
- **User-visible:** no change to the dashboard, to triage summaries, or to Recycle.md reading experience on the Obsidian backend.

## Open questions

1. Should `is_duplicate` in the SQLite schema be replaced by a generic `tag` column (which matches the markdown tags `(duplicate)`, `(duplicate from Recycle)`, `(slop)`, `(clean)`)? **Tentative answer:** yes — add `tag` and drop `is_duplicate`. Migration renames.
2. Monthly vs quarterly archives on the Obsidian backend? **Tentative answer:** monthly is finer-grained and individual files stay <1MB even at 1K entries/month (unlikely).
3. Should `.curaitor/recycle-index.tsv` live inside the Obsidian vault (`.curaitor/` hidden folder) or outside (`~/.curaitor/`)? **Tentative answer:** inside the vault, so it syncs with the vault and Obsidian ignores dotfolders by default.

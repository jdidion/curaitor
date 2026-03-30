# /discover — Surface new articles from RSS feeds

Fetch recent articles from configured RSS feeds, evaluate for cross-disciplinary relevance, and route to Obsidian folders.

## Arguments
$ARGUMENTS — Optional: number of days to look back (default 7), or a category filter (e.g., "ai", "genomics").

## Step 1: Load preferences and feeds

Read two files from the curaitor repo (`~/projects/curaitor/`):
1. `config/reading-prefs.md` — learned preferences
2. `config/feeds.yaml` — RSS feed list

If `feeds.yaml` has no feeds configured, tell the user to export OPML from Feedly or add feeds manually.

## Step 2: Fetch articles from each feed

For each feed in `feeds.yaml`:
1. WebFetch the RSS feed URL
2. Parse article titles, URLs, dates, and descriptions/abstracts
3. Filter to articles within the lookback period (default 7 days)

## Step 3: Deduplicate

Check Obsidian for existing notes with matching URLs (search via `mcp__obsidian__search_notes`). Skip articles already triaged.

## Step 4: Evaluate each article

For each new article, evaluate against `reading-prefs.md`:

- **Summary** (from RSS description/abstract — do NOT WebFetch full text in unattended mode to save time)
- **Category**: `ai-tooling` | `genomics` | `methods` | `general`
- **Confidence**: `high-interested` | `uncertain` | `high-not-interested`
- **Cross-disciplinary check**:
  - Does this paper introduce a method from another field applicable to cfDNA/genomics?
  - Does this AI tool solve a problem the user faces in bioinformatics pipelines?
  - Is this a novel approach or just incremental work?

## Step 5: Route to Obsidian

Same three-tier routing as `/triage`:
- **High confidence interested** → Obsidian `Inbox/`
- **Uncertain** → Obsidian `Review/`
- **High confidence not interested** → Obsidian `Ignored/`

Note format same as `/triage`, but `source: rss` and include `feed_name` in frontmatter.

## Step 6: Present summary

```
Discovered 42 new articles across 12 feeds:
  5 → Inbox     ★ (titles listed)
  8 → Review    ? (titles listed)
 29 → Ignored   (count only)

Top picks:
1. "Title" — why this is relevant
2. "Title" — why this is relevant
...
```

## Rules
- Only evaluate based on RSS title/description/abstract — don't WebFetch full articles (too slow for many feeds)
- Always read `reading-prefs.md` first
- Always deduplicate against existing Obsidian notes
- Be terse — summary table, not play-by-play

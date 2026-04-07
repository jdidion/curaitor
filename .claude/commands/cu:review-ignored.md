# /review-ignored — Check ignored articles for false negatives

Batch-scan ignored articles to catch false negatives. This is a high-throughput triage pass, NOT an article-by-article review — present grouped summaries so the user can dismiss entire categories at a glance.

## Arguments
$ARGUMENTS — Optional: number of days to look back (default 30).

## Step 1: Load and read all notes

1. Read `config/reading-prefs.md` from `~/projects/curaitor/`
2. List notes in `Curaitor/Ignored/` folder via `mcp__obsidian__list_directory`
3. Filter to notes within the lookback period (from frontmatter `date_triaged`)
4. Batch-read all matching notes (use `mcp__obsidian__read_multiple_notes`)

## Step 2: Group by ignore reason and present batches

Cluster articles by their ignore reason/category, then present as grouped summaries. Print ALL output completely before asking for input.

```
Ignored articles (last 30 days): 42 total, 6 categories

━━ Marketing/product announcements (14) ━━
  Enterprise AI platforms, SaaS launch posts, vendor comparisons
  Sample: "Acme AI Platform Launch", "Top 10 Enterprise LLM Tools"

━━ Incremental benchmarks, no new method (8) ━━
  Papers comparing existing tools on standard datasets
  Sample: "Benchmarking CNV Callers on WGS Data", "GATK vs DeepVariant 2026"

━━ Non-applicable LLM content (7) ━━
  OpenAI/Gemini-specific tutorials, prompt engineering listicles
  Sample: "GPT-4 Fine-tuning Guide", "Gemini 2.5 vs GPT-5"

━━ News/opinion, no technical depth (6) ━━
  Industry commentary, funding announcements, executive interviews
  Sample: "AI Startup Raises $50M", "The Future of Genomics in 2027"

━━ Duplicates/outdated (4) ━━
  Topics already covered by a newer or better article in Inbox
  Sample: "Intro to RAG" (superseded by existing Inbox article)

━━ Potentially interesting — flagged for review (3) ━━
  These didn't clearly fit an ignore pattern:
   1. "Novel statistical framework for somatic CNV detection" — tagged incremental but uses new method
      → My suggestion: Rescue — novel method, not just a benchmark
   2. "Building AI agents with persistent memory" — tagged non-applicable but relevant to dev tooling
      → My suggestion: Rescue — directly relevant to your AI agent work
   3. "cfDNA fragmentomics for early cancer detection" — tagged news but has methods section
      → My suggestion: Rescue — has real methods, cfDNA is a core interest

Dismiss entire categories or rescue specific articles.
Examples: "all good", "rescue 1,3 from flagged", "show me the benchmarks list"
```

## Step 3: Process user response

- **"all good"** / **"none"** → confirm all as correctly ignored (**true negatives**). For each confirmed article: append `- [title](url)` to `Curaitor/Recycle.md`, then delete the note from `Curaitor/Ignored/`. Use confirmed ignores as signal that triage is working correctly for these patterns.
- **"rescue N,N"** or article numbers from the flagged list → move to `Curaitor/Review/` (**false negatives**). Agent analyzes WHY triage wrongly ignored these and updates preferences to decrease the false-negative rate.
- **"show me [category]"** → expand that category to show all titles, let user pick
- **"rescue [category] N,N"** → rescue specific articles from an expanded category
- Any rescued article: move from `Curaitor/Ignored/` to `Curaitor/Review/` via `mcp__obsidian__move_note`

## Step 4: Update preferences and summarize

For **false negatives** (rescued articles), update `config/reading-prefs.md`:
```
- YYYY-MM-DD: FN — user interested in "Title" despite [pattern]. Triage was wrong because: [analysis]. Adjust: [new rule]
```

For **true negatives** (confirmed ignores), optionally reinforce correct patterns:
```
- YYYY-MM-DD: TN — confirmed 14 marketing/announcement articles correctly ignored. Pattern holding.
```

Print summary:
```
Reviewed 42 ignored articles:
  3 rescued → moved to Curaitor/Review/ (FN — triage too aggressive)
  39 confirmed ignored → recycled (TN — triage correct)

Preferences updated:
  ~ FN: CNV papers ARE interesting if they use a novel statistical framework
  ~ FN: Dev tooling articles about AI agents are relevant even if not Claude-specific
  ~ TN: Marketing/announcements pattern confirmed (14 articles)
```

## Rules
- **Batch, don't enumerate** — never list all articles individually unless the user asks to expand a category
- Group by ignore reason so entire categories can be dismissed at once
- Proactively flag articles that seem like potential false negatives in a separate "flagged" group
- Only update preferences when a clear pattern correction emerges
- Print all text output FIRST, then prompt — never use AskUserQuestion

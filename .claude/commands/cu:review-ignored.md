# /review-ignored — Check ignored articles for false negatives

Scan recently ignored articles and present them for quick review to catch false negatives and refine preferences.

## Arguments
$ARGUMENTS — Optional: number of days to look back (default 30).

## Step 1: Load context

1. Read `config/reading-prefs.md` from `~/projects/curaitor/`
2. List notes in `Ignored/` folder via `mcp__obsidian__list_directory`
3. Filter to notes within the lookback period (from frontmatter `date_triaged`)

## Step 2: Present ignored articles

Show a compact list with Claude's original ignore reason:

```
Ignored articles (last 30 days): 23 total

 1. "Enterprise AI Platform for..." — SaaS marketing, no technical content
 2. "GPT-4 Fine-tuning Guide" — OpenAI-specific, not applicable to Claude
 3. "Novel CNV caller using..." — incremental benchmark, no new method
 ...

Any of these look like false negatives? Enter numbers (e.g., "3,7,12") or "none".
```

## Step 3: Process corrections

For each false negative flagged by the user:
1. Read the full Obsidian note
2. Move from `Ignored/` to `Inbox/` (or `Review/` if user wants to read more)
3. Update `config/reading-prefs.md` with a correction:
   ```
   - YYYY-MM-DD: CORRECTION — user was interested in "Title" despite [pattern]. Adjust: [new rule]
   ```

## Step 4: Summary

```
Reviewed 23 ignored articles:
  2 recovered as false negatives → moved to Inbox
  21 confirmed ignored

Preferences updated:
  ~ Adjusted: CNV papers ARE interesting if they use a novel statistical framework (not just benchmarks)
```

## Rules
- Keep the list compact — title + reason only
- Don't re-evaluate articles, just present the original ignore reason
- Only update preferences when a clear pattern correction emerges

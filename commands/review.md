# /review — Interactive article review session

Browse articles from the Review queue one at a time in the cmux browser, discuss with Claude, and give feedback.

## Arguments
$ARGUMENTS — Optional: number of articles to review (default: all in queue), or "ignored" to review the Ignored folder instead.

## Step 1: Load context

1. Read `config/reading-prefs.md` from `~/projects/curaitor/`
2. Read the `Review/` queue from Obsidian using `mcp__obsidian__list_directory` on the `Review` folder
3. If $ARGUMENTS is "ignored", read `Ignored/` folder instead

If the queue is empty, tell the user and exit.

## Step 2: Present queue overview

```
Review queue: 8 articles

1. [ai-tooling]  "CLI-Anything: Making ALL Software Agent-Native" (LinkedIn)
2. [genomics]    "UPDhmm: detecting uniparental disomy from NGS trio data" (DOI)
3. [methods]     "PScnv: personalized self-normalizing CNV detection" (DOI)
...

Starting with #1. Press 'q' to quit at any time.
```

## Step 3: For each article

### a. Open in cmux browser
Run this to open the article URL in the cmux integrated browser:
```bash
cmux browse "ARTICLE_URL"
```

### b. Present Claude's assessment
Show in the terminal:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Article 1/8: "CLI-Anything: Making ALL Software Agent-Native"
Category: ai-tooling | Source: LinkedIn
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Summary
(from the Obsidian note)

## Claude's assessment
(relevance to user's work, potential applications, any concerns)

## Verdict options
  y  — Interested → move to Inbox
  n  — Not interested → move to Ignored
  s  — Save to Zotero
  q  — Quit review session
  ?  — Ask Claude a question about this article
```

### c. Interactive discussion
If the user types a question (anything other than y/n/s/q), answer based on the article content. If needed, WebFetch the full article for more detail.

### d. Process verdict
- **y** → Move note from `Review/` to `Inbox/` using `mcp__obsidian__move_note`, update frontmatter verdict
- **n** → Move to `Ignored/`, update frontmatter
- **s** → Save to Zotero via API, move to `Inbox/`, add zotero_key to frontmatter
- **q** → Stop reviewing, show session summary

### e. Update preferences
After each verdict, consider whether the decision reveals a new preference pattern. If it does, append to `config/reading-prefs.md` under "## Learned patterns":
```
- YYYY-MM-DD: User [interested in / not interested in] [pattern]. Example: "Article Title"
```

Only add a pattern if it's genuinely informative — don't log every single decision.

## Step 4: Session summary

After reviewing all articles or quitting:
```
Review session complete:
  3 → Inbox
  2 → Ignored
  1 → Zotero
  2 remaining in Review queue

Preferences updated:
  + Added: interested in terminal-native AI tools that replace browser-based workflows
  + Added: not interested in enterprise-only SaaS tools
```

## Rules
- Always open the article in cmux browser before presenting the assessment
- Wait for user input after each article — this is interactive, not batch
- Keep assessments concise — 3-4 sentences max
- Only update reading-prefs.md when a pattern is genuinely new/informative
- If cmux is not available, fall back to just showing the URL for the user to open manually

# curaitor — AI-Powered Article Discovery, Triage & Review

An article reading assistant that automates discovery and triage while keeping you in the loop for what matters.

## Commands

- `/cu:triage` — Process Instapaper saves: fetch, evaluate, route to Obsidian, archive
- `/cu:discover` — Surface new articles from RSS feeds with semantic relevance evaluation
- `/cu:review` — Interactive review: browse Review queue in cmux browser, discuss, give verdicts
- `/cu:read` — Deep reading: read Inbox articles with full summary, RAG discussion, save or discard
- `/cu:review-ignored` — Check Ignored folder for false negatives
- `/cu:seed-preferences` — One-time: analyze Zotero + Instapaper history to build initial preferences

## Setup

1. Copy `.env.example` to `.env` and fill in your API credentials
2. Install: `pip install requests-oauthlib`
3. Run `claude` in this directory — all `/cu:*` commands are available
4. Run `/cu:seed-preferences` to initialize from your reading history

## Credentials

Load from `.env` in the repo root (gitignored):

```python
from requests_oauthlib import OAuth1Session
import os

creds = {}
env_path = os.path.join(os.path.dirname(os.path.abspath('.')), '.env')
for path in ['.env', os.path.expanduser('~/.instapaper-credentials')]:
    if os.path.exists(path):
        with open(path) as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    k, v = line.strip().split('=', 1)
                    creds[k] = v
        break

session = OAuth1Session(
    creds['INSTAPAPER_CONSUMER_KEY'],
    client_secret=creds['INSTAPAPER_CONSUMER_SECRET'],
    resource_owner_key=creds['INSTAPAPER_ACCESS_TOKEN'],
    resource_owner_secret=creds['INSTAPAPER_ACCESS_SECRET'],
)
```

### Instapaper API endpoints
- `POST /api/1/bookmarks/list` — list bookmarks (params: folder_id, limit)
- `POST /api/1/bookmarks/get_text` — get article text (params: bookmark_id)
- `POST /api/1/bookmarks/archive` — archive bookmark (params: bookmark_id)

## Obsidian integration

Articles are stored as notes with structured frontmatter. Access via Obsidian MCP tools.

### Folders
- **Inbox/** — high-confidence interesting, ready to read
- **Review/** — uncertain, needs human review
- **Ignored/** — confident not interesting
- **Library/** — permanently saved articles from deep read sessions

### Note format
```markdown
---
title: "Article Title"
url: https://...
source: instapaper
bookmark_id: 12345
date_triaged: 2026-03-30
category: ai-tooling
verdict: read-now
tags: [ai, dev-tools]
---

## Summary
2-3 sentence summary.

## Verdict: Read Now
Why this is worth reading.
```

## Three-tier confidence routing

Read `config/reading-prefs.md` before every evaluation:
- **High confidence interested** → Obsidian `Inbox/`
- **Uncertain** → Obsidian `Review/`
- **High confidence not interested** → Obsidian `Ignored/`

In unattended mode (cron), NEVER prompt — uncertain always goes to `Review/`.

## CRITICAL: Do not use AskUserQuestion during review

NEVER use AskUserQuestion during `/cu:review` or `/cu:review-ignored`. It only supports 4 options and interrupts text output mid-sentence. Instead:
- Print all text output completely FIRST
- Then print the verdict menu as plain text
- Wait for the user to type their response as free text

## Interactive review

Menu (printed as text, not AskUserQuestion):
```
!:deep-read  ?:discuss  y:inbox  c:clip  r:zotero  n:ignore  skip  q:quit
```

Users can type inline commands:
- `! compare this to our current approach` — deep read with context
- `? does this support hg38?` — discuss before deciding
- Or bare keys: `y`, `n`, `c`, `r`, `skip`, `q`

### Verdicts
- **!** — Deep read: save permanently (papers→Zotero, others→Library/), fetch full text, interactive RAG discussion, save discussion notes when done
- **?** — Discuss: fetch full text, answer questions, re-show menu when user says "done"
- **y** — Inbox: move to Inbox/, star GitHub repo if detected, add to Tools & Projects catalog
- **c** — Clip: add repo/tool to Tools & Projects catalog only, move article to Ignored/ (only shown when repo/tool detected)
- **r** — Zotero: save as reference via Zotero API
- **n** — Ignored: not interested
- **skip** — Leave in Review/
- **q** — Quit, show session summary

### GitHub repo detection
Before opening each article, check if the URL or title contains a GitHub/GitLab repo link. If detected:
- Offer to open the repo instead of the article
- On **y**, **!**, or **c**: star via `gh api user/starred/OWNER/REPO -X PUT`
- Add to `Tools & Projects.md` in Obsidian vault root

### Tools & Projects catalog
Maintained at vault root as `Tools & Projects.md`. Organized by category:
```markdown
## Genomics & Bioinformatics
- [Helicase](https://github.com/owner/helicase) — SIMD-vectorized FASTQ/FASTA parsing

## AI & Development Tools
- [beads](https://github.com/steveyegge/beads) — Persistent structured memory for coding agents
```

## cmux browser

For interactive review in [cmux](https://github.com/manaflow-ai/cmux):

```bash
# Open URL in browser pane (returns surface:NN)
cmux browser open "https://example.com"

# Navigate existing surface
cmux browser goto "https://new-url.com" --surface surface:NN

# Wait for load
cmux browser wait --load-state complete --surface surface:NN --timeout-ms 5000

# Get DOM snapshot
cmux browser snapshot --compact --surface surface:NN

# Interact with elements (ref IDs from snapshot)
cmux browser click "REF_ID" --surface surface:NN
cmux browser fill "REF_ID" "value" --surface surface:NN
```

Track `surface:NN` from first open, reuse for all subsequent commands. Do NOT use `cmux browse`.

If cmux is not available, fall back to printing the URL for the user to open manually.

## LinkedIn authentication

Many articles are LinkedIn posts requiring login:
- Use Bitwarden CLI if available: `bw get username/password linkedin.com` (requires BW_SESSION)
- Pre-authenticate at session start if LinkedIn URLs are in the review queue
- User may need to approve 2FA via phone

## Auto-tagging and topic linking

### Tagging
When writing ANY Obsidian note (triage, discover, or review), always generate semantic tags from the article content. Tags should be:
- Lowercase, hyphenated (e.g., `variant-calling`, `ai-agents`, `cfDNA`)
- A mix of broad (`genomics`, `machine-learning`) and specific (`bloom-filters`, `nanopore-basecalling`)
- 3-8 tags per article
- Stored in frontmatter `tags` array

### Topic detection
Before finalizing an article note, search Obsidian for existing topic notes that match the article's tags:
1. Use `mcp__obsidian__search_notes` to find notes tagged with the same terms
2. Look in `Topics/` folder for existing topic notes
3. If matching topics are found, mention them when presenting the article:
   ```
   Related topics: [[Variant Calling Methods]], [[AI-Assisted Development]]
   ```

### Topic linking
When a match is found during `/cu:review`:
- Add the topic names to the article note as `related_topics` in frontmatter
- Add `[[wiki-links]]` to the related topics in the note body
- Offer to append a backlink in the topic note (e.g., under a "## Related Articles" section)

When the user asks to "create a new topic" during review:
1. Create a note in `Topics/{Topic Name}.md` with frontmatter tags
2. Add the current article as the first related article
3. Ask the user for a brief description of the topic scope
4. Search Obsidian for other existing articles that match the topic's tags and offer to link them

### Tag consistency
When generating tags, first check what tags already exist in the vault by scanning recent notes. Prefer existing tags over creating new synonyms (e.g., if `variant-calling` exists, don't create `variant-callers`).

## Preference learning

`config/reading-prefs.md` contains natural language rules. After each review verdict, if the decision reveals a genuinely new pattern, append to `## Learned patterns`:
```
- YYYY-MM-DD: User [interested in / not interested in] [pattern]. Example: "Title"
```
Only log informative patterns — not every decision.

## Feeds

`config/feeds.yaml` lists RSS feeds for `/cu:discover`. Add/remove by editing the file.

## Scheduling (unattended)

```bash
# Triage Instapaper every 6 hours
0 */6 * * * cd ~/projects/curaitor && claude -p "/cu:triage" --permission-mode bypassPermissions >> ~/curaitor-triage.log 2>&1

# Discover from feeds daily at 6am
0 6 * * * cd ~/projects/curaitor && claude -p "/cu:discover" --permission-mode bypassPermissions >> ~/curaitor-discover.log 2>&1
```

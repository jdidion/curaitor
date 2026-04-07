# /cu:review — Interactive article review session

Browse articles from the Review queue one at a time in the cmux browser, discuss with Claude, and give feedback.

## Arguments
$ARGUMENTS — Optional: number of articles to review (default: all), or "ignored" to review the Ignored folder.

## Step 1: Load context

1. Read `~/projects/curaitor/config/reading-prefs.md`
2. List notes in `Curaitor/Review/` folder via `mcp__obsidian__list_directory`
3. If $ARGUMENTS is "ignored", list `Curaitor/Ignored/` folder instead

If the queue is empty, tell the user and exit.

## Step 2: LinkedIn pre-authentication

Many Review articles are LinkedIn posts. Check if any articles have linkedin.com URLs. If so, authenticate at the start of the session:

1. Open LinkedIn in cmux browser:
   ```bash
   cmux browser open "https://www.linkedin.com/login"
   ```
2. Track the returned `surface:NN` ID for all subsequent browser commands
3. Use Bitwarden CLI to fill credentials (look up the LinkedIn item in Bitwarden):
   ```bash
   cmux browser fill "EMAIL_REF" "$(bw get username linkedin.com)" --surface surface:NN
   cmux browser fill "PASSWORD_REF" "$(bw get password linkedin.com)" --surface surface:NN
   ```
4. User may need to approve 2FA on their phone — wait for confirmation

Skip this step if no LinkedIn articles in the queue or if BW_SESSION is not set.

## Step 3: Present queue overview

```
Review queue: 18 articles

1. [ai-tooling]  "Optimize LLM Efficiency with Sequencing Tool"
2. [ai-tooling]  "Structural Metadata Reconstruction Attack on LLMs"
3. [ai-tooling]  "Introducing Axion: AI-Friendly Programming Language"
...

Starting with #1.
```

## Step 4: For each article

### a. Read the Obsidian note
Use `mcp__obsidian__read_note` to get the full note including frontmatter.

### b. Detect GitHub/GitLab repos

Before opening, check if the article URL or title contains a GitHub/GitLab repo link:
- URL matches `github.com/{owner}/{repo}` or `gitlab.com/{owner}/{repo}`
- Title contains "GitHub -" or "GitLab -" followed by `{owner}/{repo}`
- Article text/description contains a `github.com/{owner}/{repo}` link

If a repo is detected, extract the `owner/repo` and note it. When presenting the article, offer to open the repo instead:

```
  Repo detected: github.com/steveyegge/beads
  [r] Open repo instead  |  [a] Open article  |  [b] Open both
```

Default to the repo URL for GitHub/GitLab-linked articles.

### c. Open in cmux browser
```bash
cmux browser open "ARTICLE_URL"  # or REPO_URL if user chose [r]
# or if reusing existing surface:
cmux browser goto "URL" --surface surface:NN
cmux browser wait --load-state complete --surface surface:NN --timeout-ms 5000
```

### d. Present Claude's assessment
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Article 1/18: "Optimize LLM Efficiency with Sequencing Tool"
Category: ai-tooling | Source: instapaper
Repo: github.com/davidtarjan/pi-mono (if detected)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Summary
(from the Obsidian note)

## Why review?
(from the Obsidian note)

## My suggestion
(one sentence: what Claude would do with this article and why, e.g. "Recycle — this is a product announcement with no technical depth" or "Inbox — novel method directly applicable to your cfDNA work")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### e. Ask for verdict

Do NOT use AskUserQuestion — it only supports 4 options max. Instead, print the menu as text and wait for the user to type their response:

```
!:deep-read  ?:discuss  y:inbox  c:clip  r:zotero  a:recycle  skip  q:quit
```

Only include **c** if a repo or tool website was detected.

The user can type:
- A bare key: `y`, `n`, `s`, `c`, `skip`, `q`
- **`! <comment>`** — deep read with an initial note/context (e.g., `! compare this to our current approach`)
- **`? <question>`** — ask a specific question (e.g., `? does this support hg38?`)
- Any other free text — treated as a question about the article, answer it, then re-show the menu

### f. Handle verdict

- **!** → **Deep read mode** (see below). If repo detected: star it and add to Tools catalog.
- **?** → **Discussion mode**: fetch the full article text via WebFetch or `cmux browser snapshot`, then enter a conversational loop where the user asks questions and Claude answers from the article content. When the user is done asking questions (says "done", "ok", "next", or similar), re-present the verdict options so they can make a final decision.
- **y** → move to `Curaitor/Inbox/`, update frontmatter. If repo detected: star it via `gh api user/starred/{owner}/{repo} -X PUT` and add to Tools catalog. **True positive**.
- **c** → **Clip**: add the repo/tool to `Tools & Projects.md` in Obsidian (star the repo if GitHub), then delete the article from `Curaitor/Review/`. **True positive**.
- **r** → save to Zotero via API, move to `Curaitor/Inbox/`, add zotero_key to frontmatter. **True positive**.
- **a** → **Recycle**: not keeping. Append `- [title](url)` to `Curaitor/Recycle.md`, delete note from `Curaitor/Review/`. **False positive** — analyze why triage wrongly routed this to Review and update preferences.
- **skip** → leave in `Curaitor/Review/`. **True positive**.
- **q** → stop, show session summary

### f. Star GitHub repos (on y or !)

If a GitHub repo was detected and the user chose `y` or `!`:
1. Star the repo:
   ```bash
   gh api user/starred/OWNER/REPO -X PUT
   ```
2. Get repo description:
   ```bash
   gh api repos/OWNER/REPO --jq '.description'
   ```
3. Add to the **Tools & Projects** catalog in Obsidian (see below)

For GitLab repos, use the GitLab MCP `gitlab_star_project` if available, otherwise skip starring.

### g. Update Tools & Projects catalog

Maintain `Tools & Projects.md` at the root of the Obsidian vault. This is an organized collection of tools and projects discovered through curaitor.

Read the existing note via `mcp__obsidian__read_note` (path: `Tools & Projects.md`). If it doesn't exist, create it.

Format: organized by category, each entry is one line with name as a link and short description.

```markdown
# Tools & Projects

## Genomics & Bioinformatics
- [Helicase](https://github.com/owner/helicase) — SIMD-vectorized FASTQ/FASTA parsing
- [RabbitVar](https://github.com/LeiHaoa/RabbitVar) — Fast germline + somatic variant caller

## AI & Development Tools
- [beads](https://github.com/steveyegge/beads) — Persistent structured memory for coding agents
- [CLI-Anything](https://github.com/HKUDS/CLI-Anything) — Make any software agent-native via CLI

## Data & Infrastructure
- [Seqa23](https://github.com/...) — Rust crate for querying genomic files across clouds
```

Append the new entry under the appropriate category. If the category doesn't exist, create it. Keep entries sorted alphabetically within each category.

### e. Deep read mode (!)

When the user types `!`, this means "I'm interested AND I want to read and discuss this right now":

1. **Save permanently:**
   - If it's a paper (DOI, bioRxiv, arXiv, nature.com, etc.): save to Zotero via API
   - If it's a blog/tool/LinkedIn post: move to `Library/` folder in Obsidian (create if needed)

2. **Fetch full content:**
   - WebFetch the full article text
   - For papers: fetch abstract + full text if accessible
   - For GitHub repos: read the README
   - For LinkedIn posts: use cmux browser snapshot to get full DOM content
   - Store the fetched content in working memory for the discussion

3. **Interactive RAG discussion:**
   - Present a structured summary (key findings, methods, implications)
   - Then say: "What would you like to discuss about this article?"
   - Answer user's questions from the article content
   - The user may ask things like:
     - "How does this compare to X?"
     - "Could we use this method in our pipeline?"
     - "What are the limitations?"
     - "Summarize the methods section"
   - Continue the discussion until the user says "done" or "next"

4. **Save discussion notes:**
   - When the user finishes discussing, compile the key points from the conversation:
     - User's takeaways and insights
     - Connections to their work
     - Action items or follow-ups mentioned
   - If saved to Zotero: add as a note on the Zotero entry via API
   - If saved to Obsidian Library/: append a `## Discussion Notes` section to the note with date

5. **Update the Obsidian note** with final verdict and move from `Curaitor/Review/` to `Library/` or `Curaitor/Inbox/`

### f. Update preferences
After each verdict, if the decision reveals a genuinely new preference pattern, append to `~/projects/curaitor/config/reading-prefs.md` under "## Learned patterns":
```
- YYYY-MM-DD: User [interested in / not interested in] [pattern]. Example: "Article Title"
```
Only add patterns that are informative — don't log every decision.

## Step 5: Session summary

```
Review session complete:
  3 → Inbox
  2 → Recycled (FP)
  1 → Zotero (TP)
  2 → Library (deep read, TP)
  10 remaining in Curaitor/Review/

Deep reads:
  "Article Title" — 3 discussion notes saved
  "Article Title" — 2 discussion notes saved

Preferences updated:
  + interested in terminal-native AI tools
  + not interested in enterprise SaaS tools
```

## Rules
- Always open the article in cmux browser before presenting
- Wait for user input after each article
- Keep assessments concise — 3-4 sentences max
- If cmux is not available, show the URL for manual opening
- Only update reading-prefs.md when a pattern is genuinely new
- In deep read mode, be thorough — the user wants to engage deeply with the material
- For cmux browser: use `cmux browser open`, `cmux browser goto`, `cmux browser snapshot`, `cmux browser wait` (NOT `cmux browse`)
- Track the surface:NN ID from the first `cmux browser open` and reuse it

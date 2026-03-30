# curaitor

AI-powered article discovery, triage, and interactive review — built as a [Claude Code](https://claude.ai/claude-code) plugin.

curaitor helps researchers and knowledge workers stay on top of their reading by automating the tedious parts of article discovery and triage while keeping the human in the loop for what matters: deciding what's worth reading and discussing it deeply.

## How it works

```
RSS feeds ──> /cu:discover ──> Obsidian vault (Inbox / Review / Ignored)
                                     ^
Instapaper ──> /cu:triage ───────────┘──> Instapaper Archive
                                     |
                               /cu:review (interactive)
                                     |
                          cmux browser + Claude discussion
                                     |
                          reading-prefs.md updated
                          Zotero / Obsidian Library saved
                          GitHub repos starred
```

### Three-tier confidence routing

Every article is evaluated against your learned preferences:

- **Inbox/** — Claude is confident you'll want this. Auto-routed, ready to read.
- **Review/** — Claude is uncertain. Queued for your interactive review.
- **Ignored/** — Claude is confident you won't want this. Periodically review for false negatives.

### Preference learning

curaitor learns your interests over time. Every time you give feedback during `/cu:review`, Claude updates `config/reading-prefs.md` with what your decision reveals. Over time, the uncertain tier shrinks.

## Commands

| Command | Mode | What it does |
|---------|------|-------------|
| `/cu:triage` | Unattended | Fetch Instapaper saves, evaluate, route to Obsidian, archive |
| `/cu:discover` | Unattended | Scan RSS feeds for new articles, evaluate, route to Obsidian |
| `/cu:review` | Interactive | Browse Review queue in cmux browser, discuss with Claude, give verdicts |
| `/cu:review-ignored` | Interactive | Check Ignored folder for false negatives |
| `/cu:seed-preferences` | Interactive | One-time setup: analyze reading history to build initial preferences |

### Review verdicts

During `/cu:review`, you have these options for each article:

| Key | Action |
|-----|--------|
| `y` | Interested — move to Inbox. Star GitHub repo if detected. |
| `n` | Not interested — move to Ignored. |
| `s` | Save to reference manager (Zotero). |
| `!` | **Deep read** — save permanently, fetch full text, discuss interactively with Claude, save discussion notes. |
| `skip` | Leave in Review for later. |
| `q` | Quit review session. |

When an article links to a GitHub/GitLab repo, curaitor detects it and offers to open the repo directly. On `y` or `!`, the repo is starred and added to a **Tools & Projects** catalog in your Obsidian vault.

## Setup

### Prerequisites

- [Claude Code](https://claude.ai/claude-code) CLI
- [Obsidian](https://obsidian.md) with an MCP server configured (for note storage)
- [cmux](https://github.com/manaflow-ai/cmux) (optional, for interactive browser review)
- Python 3 with `requests-oauthlib` (`pip install requests-oauthlib`)

### 1. Clone the repo

```bash
git clone https://github.com/jdidion/curaitor.git ~/projects/curaitor
```

### 2. Set up workspaces

curaitor uses two separate workspaces so that unattended and interactive modes have isolated Claude sessions:

```bash
# Interactive review workspace
mkdir -p ~/projects/curaitor-review/.claude/commands
# Copy commands from curaitor/commands/ and rename with cu: prefix
# Create CLAUDE.md with your configuration (see below)

# Unattended triage workspace
mkdir -p ~/projects/curaitor-triage/.claude/commands
# Same process
```

Each workspace needs a `CLAUDE.md` that tells Claude about your setup — see the examples in the repo.

### 3. Configure credentials

Create a `local-credentials.env` in each workspace (gitignored):

```bash
# Instapaper API (get keys at instapaper.com/developers)
INSTAPAPER_CONSUMER_KEY=your_consumer_key
INSTAPAPER_CONSUMER_SECRET=your_consumer_secret
INSTAPAPER_ACCESS_TOKEN=your_access_token
INSTAPAPER_ACCESS_SECRET=your_access_secret
INSTAPAPER_RSS_URL=https://www.instapaper.com/rss/your_id/your_token
```

To get Instapaper access tokens, you need to do a one-time xAuth exchange:

```python
from requests_oauthlib import OAuth1Session

session = OAuth1Session('CONSUMER_KEY', client_secret='CONSUMER_SECRET')
resp = session.post('https://www.instapaper.com/api/1/oauth/access_token',
    data={'x_auth_username': 'you@email.com',
          'x_auth_password': 'your_password',
          'x_auth_mode': 'client_auth'})
print(resp.text)  # oauth_token=X&oauth_token_secret=Y
```

### 4. Import RSS feeds

Export OPML from your feed reader (Feedly, Inoreader, etc.) and have Claude parse it:

```
Paste: "Import feeds from ~/Downloads/export.opml, only the Science folder"
```

Or manually edit `config/feeds.yaml`:

```yaml
feeds:
  - name: Nature Genetics
    url: http://feeds.nature.com/ng/rss/current
    category: science
  - name: arXiv cs.AI
    url: https://rss.arxiv.org/rss/cs.AI
    category: ai
```

### 5. Seed preferences

Run the one-time preference seeding to analyze your existing reading history:

```bash
cd ~/projects/curaitor-review && claude
# then: /cu:seed-preferences
```

This analyzes your Zotero library and Instapaper archive to build initial preference rules.

### 6. Schedule unattended runs (optional)

```bash
# Triage Instapaper every 6 hours
0 */6 * * * cd ~/projects/curaitor-triage && claude -p "/cu:triage" --permission-mode bypassPermissions >> ~/curaitor-triage.log 2>&1

# Discover from feeds daily at 6am
0 6 * * * cd ~/projects/curaitor-triage && claude -p "/cu:discover" --permission-mode bypassPermissions >> ~/curaitor-discover.log 2>&1
```

## Customization

### Using a different link-saving tool

curaitor is built around Instapaper but can be adapted to other tools:

**Pocket:**
- Replace the Instapaper API calls with [Pocket API](https://getpocket.com/developer/)
- Pocket uses OAuth 2.0 (simpler than Instapaper's OAuth 1.0a)
- Key endpoints: `/v3/get` (list), `/v3/send` (archive/delete)
- Update `cu:triage.md` to use Pocket's list endpoint and archive action

**Raindrop.io:**
- [Raindrop API](https://developer.raindrop.io/) uses OAuth 2.0 or a test token
- Endpoints: `GET /raindrops/{collectionId}` (list), `PUT /raindrop/{id}` (update)
- Supports folders/collections natively

**Readwise Reader:**
- [Readwise API](https://readwise.io/api_deets) with token auth
- Endpoints: `/api/v3/list/` (list documents), export highlights
- Has built-in RSS feed ingestion — could replace both Instapaper and Feedly

**No link-saving tool (RSS only):**
- Remove `/cu:triage` entirely
- Use only `/cu:discover` with `config/feeds.yaml`
- Articles go directly to Obsidian without an Instapaper middleman

To adapt: edit the API calls in `commands/triage.md` and the credential loading in `CLAUDE.md`. The evaluation logic, Obsidian routing, and preference learning are tool-agnostic.

### Using a different reference manager

curaitor saves papers to Zotero but can be adapted:

**Zotero (default):**
- [Zotero Web API](https://www.zotero.org/support/dev/web_api/v3/start)
- Store API key and library ID in `local-credentials.env`
- Save items via `POST /users/{userId}/items`
- Add discussion notes via `POST /users/{userId}/items` with `parentItem` set

**Mendeley:**
- [Mendeley API](https://dev.mendeley.com/) with OAuth 2.0
- `POST /documents` to save, `POST /annotations` for notes
- Supports PDF attachment upload

**Paperpile:**
- No public API currently — use the browser extension or BibTeX export
- For curaitor integration: save to Obsidian `Library/` with BibTeX frontmatter, import to Paperpile manually

**Plain Obsidian (no reference manager):**
- All papers saved to `Library/` folder in Obsidian with full citation metadata in frontmatter
- Discussion notes saved inline in the Obsidian note
- Use Obsidian's search and tags for organization

To adapt: edit the Zotero API calls in `commands/review.md` (the `s` and `!` handlers) and update `CLAUDE.md`.

### Using a different note system

curaitor routes articles to Obsidian via MCP, but the pattern works with other tools:

**Notion:**
- Use a [Notion MCP server](https://github.com/modelcontextprotocol/servers) or the [Notion API](https://developers.notion.com/)
- Map Inbox/Review/Ignored to Notion databases or pages
- Frontmatter properties → Notion database properties

**Apple Notes / Bear / other:**
- If an MCP server exists, swap out the Obsidian MCP calls
- If not, write notes as local markdown files and sync separately

**Local markdown files (no MCP):**
- Replace `mcp__obsidian__write_note` with `Write` tool calls to a local directory
- Loses real-time Obsidian sync but works anywhere

To adapt: replace the `mcp__obsidian__*` tool calls in all command files with your note system's equivalent.

### Using different RSS sources

The `config/feeds.yaml` format is simple — any RSS/Atom feed URL works:

```yaml
feeds:
  - name: Hacker News Front Page
    url: https://hnrss.org/frontpage
    category: tech
  - name: arXiv cs.LG
    url: https://rss.arxiv.org/rss/cs.LG
    category: ai
  - name: PubMed search for "cell-free DNA"
    url: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/erss.cgi?rss_guid=1234
    category: genomics
```

You can also add non-RSS sources by modifying `commands/discover.md` to call additional APIs (Semantic Scholar, PubMed E-utilities, etc.).

## Architecture

```
~/projects/curaitor/              # Shared repo (GitHub)
  ├── CLAUDE.md                   # Plugin docs
  ├── commands/                   # Canonical command definitions
  ├── config/
  │   ├── feeds.yaml              # RSS feeds (committed)
  │   └── reading-prefs.md        # Learned preferences (gitignored)
  └── .gitignore

~/projects/curaitor-review/       # Interactive workspace (local)
  ├── CLAUDE.md                   # Full context for interactive Claude
  ├── local-credentials.env       # API tokens (gitignored)
  └── .claude/commands/           # Namespaced commands (cu:review, etc.)

~/projects/curaitor-triage/       # Unattended workspace (local)
  ├── CLAUDE.md                   # Context for unattended Claude
  ├── local-credentials.env       # API tokens (gitignored)
  └── .claude/commands/           # Namespaced commands (cu:triage, etc.)
```

The two workspaces reference `~/projects/curaitor/config/` for shared state (preferences and feeds).

## License

MIT

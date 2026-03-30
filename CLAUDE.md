# curaitor — AI-Powered Article Discovery & Triage

A Claude Code plugin for automated article discovery, triage, and interactive review.

## Commands

- `/cu:triage` — Process Instapaper saves: fetch, evaluate, route to Obsidian, archive in Instapaper
- `/cu:discover` — Surface new articles from RSS feeds with semantic relevance evaluation
- `/cu:review` — Interactive article review: browse articles in cmux, discuss with Claude, give feedback
- `/cu:review-ignored` — Review ignored articles for false negatives
- `/cu:seed-preferences` — One-time setup: analyze Zotero + Instapaper history to build initial preferences

## Architecture

### Three-tier confidence routing
All articles are evaluated against learned preferences (`config/reading-prefs.md`):
- **High confidence interested** → Obsidian `Inbox/`
- **Uncertain** → Obsidian `Review/` (for interactive `/cu:review`)
- **High confidence not interested** → Obsidian `Ignored/`
- **Library/** — permanently saved articles from deep read sessions

### Obsidian integration
Articles are stored as notes with structured frontmatter (title, url, source, category, verdict, tags).
Access via Obsidian MCP tools.

### Instapaper API
Credentials stored in `~/.instapaper-credentials` (not in repo).
- OAuth 1.0a + xAuth for authentication
- `/bookmarks/list` — fetch unread bookmarks
- `/bookmarks/get_text` — get processed article text
- `/bookmarks/archive` — archive after triage

### Feeds
RSS feed list: `config/feeds.yaml`
Add/remove feeds by editing the file or asking Claude.

### Preference learning
`config/reading-prefs.md` contains natural language rules that improve over time.
Every `/cu:review` feedback interaction updates preferences.

### GitHub integration
When articles link to GitHub repos:
- Repos are starred via `gh api` on `y` or `!` verdicts
- Added to `Tools & Projects.md` catalog in Obsidian vault root

## Credentials (not in repo)
- `~/.instapaper-credentials` — Instapaper API tokens
- `~/.zotero-key` — Zotero API key + library ID

## Workspaces

This repo contains the shared config and canonical command definitions.
Two separate workspaces reference this config:

- **curaitor-review** — Interactive review sessions (cmux browser + Claude discussion)
- **curaitor-triage** — Unattended cron runs (triage + discover, no user prompts)

## Unattended mode
Run via cron with `--permission-mode bypassPermissions`. Uncertain articles go to `Review/` instead of prompting.

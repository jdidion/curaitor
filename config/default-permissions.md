# Curaitor Review Plugin — Default Permissions

Permissions observed during interactive review sessions that are safe to auto-allow in a sandboxed deployment. These are non-destructive or core to the plugin's function.

## Read-only tools (always safe)

| Tool | Scope | Notes |
|------|-------|-------|
| `Read` | `~/projects/curaitor/config/*`, credential files | Reading preferences, feed config, credentials |
| `Glob` | Any | File pattern matching, no side effects |
| `Grep` | Any | Content search, no side effects |
| `WebFetch` | Any URL | Read-only web fetching for article content |

## Obsidian MCP (core function — all safe)

| Tool | Notes |
|------|-------|
| `mcp__obsidian__list_directory` | Listing vault folders |
| `mcp__obsidian__read_note` | Reading article notes |
| `mcp__obsidian__write_note` | Creating/updating notes in Inbox/, Review/, Ignored/, Library/, Topics/ |
| `mcp__obsidian__move_note` | Moving articles between folders (verdict routing) |
| `mcp__obsidian__update_frontmatter` | Updating tags, verdict, category metadata |
| `mcp__obsidian__search_notes` | Finding related topics/articles |
| `mcp__obsidian__get_vault_stats` | Vault overview |
| `mcp__obsidian__manage_tags` | Tag operations |

These are all bounded to the Obsidian vault. Worst case is a misrouted note, which is trivially reversible.

## Bash — scoped allowlist

These specific command patterns were used and are safe:

```
# cmux browser commands (display-only, no mutation)
cmux browser open *
cmux browser goto *
cmux browser wait *
cmux browser snapshot *
cmux browser click *
cmux browser fill *

# GitHub CLI — read operations + starring (easily reversible)
gh api repos/*/--jq *          # read repo metadata
gh api user/starred/*-X PUT    # star a repo

# Python — Instapaper API (bounded operations)
/opt/homebrew/bin/python3 -c *  # used for OAuth-signed API calls

# Bitwarden — credential lookup (read-only, requires BW_SESSION)
bw get username *
bw get password *
```

### Bash commands that should still prompt

| Command pattern | Why |
|----------------|-----|
| `pip3 install *` | Package installation, environment mutation |
| `git *` | No git operations in normal review flow |
| Any `rm`, `mv` on filesystem | Direct vault writes bypass Obsidian MCP |
| `bw *` (first use per session) | User wants to approve Bitwarden access explicitly |

## File writes — scoped paths

| Tool | Allowed paths | Notes |
|------|--------------|-------|
| `Write` | `~/projects/curaitor/config/reading-prefs.md` | Appending learned patterns |
| `Write` | `~/projects/curaitor-review/*.md` | Session notes, export files |
| `Edit` | `~/projects/curaitor/config/reading-prefs.md` | Updating preferences |

Direct filesystem writes to the Obsidian vault (`/Users/*/Google Drive/Obsidian/`) should be allowed for batch operations (triage of 50+ articles) but should use the MCP tools for interactive single-note operations.

## Tools NOT used / should remain gated

| Tool | Reason |
|------|--------|
| `mcp__obsidian__delete_note` | Destructive — notes should be moved to Ignored, not deleted |
| `mcp__slack-mcp__send_slack_message` | External side effect, needs explicit approval |
| Any Jira/GitLab write operations | Out of scope for review sessions |
| `mcp__obsidian__move_file` | Moves non-note files; not needed for review |

## Summary

The plugin's core loop (read article → open in browser → present → route based on verdict) is inherently safe. The only mutations are:
1. Writing/moving Obsidian notes between folders
2. Starring GitHub repos
3. Archiving Instapaper bookmarks
4. Appending to reading-prefs.md

All are low-risk and easily reversible. Auto-allow everything above; prompt for anything else.

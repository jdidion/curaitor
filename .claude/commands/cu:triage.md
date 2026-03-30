# /triage — Process Instapaper saves

Fetch unread Instapaper bookmarks, evaluate each article, route to Obsidian folders, and archive in Instapaper.

## Arguments
$ARGUMENTS — Optional: specific URL(s) to triage manually. If empty, fetch from Instapaper API.

## Step 1: Load preferences

Read `config/reading-prefs.md` from the curaitor repo (at `~/projects/curaitor/config/reading-prefs.md`).
These are learned preferences that guide confidence routing.

## Step 2: Fetch bookmarks from Instapaper

Source credentials from `~/.instapaper-credentials`, then authenticate and list bookmarks.

If no access token exists yet, do the xAuth token exchange first:

```bash
source ~/.instapaper-credentials
# xAuth token exchange (one-time, save tokens to ~/.instapaper-credentials)
curl -s -X POST "https://www.instapaper.com/api/1/oauth/access_token" \
  --user "$INSTAPAPER_CONSUMER_KEY:$INSTAPAPER_CONSUMER_SECRET" \
  -d "x_auth_username=YOUR_EMAIL&x_auth_password=YOUR_PASSWORD&x_auth_mode=client_auth"
```

If tokens already exist, list unread bookmarks:

```bash
source ~/.instapaper-credentials
# Use OAuth 1.0a signed request to list bookmarks
# The response includes bookmark_id, title, url, description for each bookmark
```

NOTE: OAuth 1.0a request signing is complex. Use a Python one-liner with `requests_oauthlib` or `oauth1` for signing:

```bash
python3 -c "
from requests_oauthlib import OAuth1Session
import json, os

creds_path = os.path.expanduser('~/.instapaper-credentials')
creds = {}
with open(creds_path) as f:
    for line in f:
        if '=' in line:
            k, v = line.strip().split('=', 1)
            creds[k] = v

session = OAuth1Session(
    creds['INSTAPAPER_CONSUMER_KEY'],
    client_secret=creds['INSTAPAPER_CONSUMER_SECRET'],
    resource_owner_key=creds.get('INSTAPAPER_ACCESS_TOKEN', ''),
    resource_owner_secret=creds.get('INSTAPAPER_ACCESS_SECRET', ''),
)

# List unread bookmarks (up to 500)
resp = session.post('https://www.instapaper.com/api/1/bookmarks/list', data={'limit': 500})
bookmarks = json.loads(resp.text)
# Filter to just bookmarks (not user/meta objects)
articles = [b for b in bookmarks if b.get('type') == 'bookmark']
print(json.dumps(articles, indent=2))
"
```

If this fails with auth errors, the access token exchange hasn't been done yet. Ask the user for their Instapaper email/password to perform the one-time xAuth exchange.

## Step 3: Evaluate each article

For each bookmark, fetch the article text:

```bash
python3 -c "
from requests_oauthlib import OAuth1Session
import os

# ... same session setup as above ...
resp = session.post('https://www.instapaper.com/api/1/bookmarks/get_text', data={'bookmark_id': BOOKMARK_ID})
print(resp.text)  # Returns HTML of processed article
"
```

Or use WebFetch on the article URL as a simpler alternative.

For each article, evaluate and assign:

- **Summary** (2-3 sentences)
- **Category**: `ai-tooling` | `genomics` | `methods` | `general`
- **Confidence**: `high-interested` | `uncertain` | `high-not-interested`
- **Verdict**: `read-now` | `save-reference` | `review` | `skip` | `obsolete`
- **Obsolescence check** (ai-tooling only):
  - Is this tool/technique now a native Claude Code feature?
  - Has model capability growth made it unnecessary?
  - Is there a better-known alternative?
- **Relevance** (brief note on connection to user's work)

Match against preferences in `reading-prefs.md` to determine confidence level.

## Step 4: Route to Obsidian

Use the Obsidian MCP to write notes. Route based on confidence:

- **High confidence interested** → write to `Inbox/` folder
- **Uncertain** → write to `Review/` folder
- **High confidence not interested** → write to `Ignored/` folder

Note format:
```markdown
---
title: "Article Title"
url: https://...
source: instapaper
bookmark_id: 12345
date_saved: 2026-03-29
date_triaged: 2026-03-29
category: ai-tooling
confidence: high-interested
verdict: read-now
tags: [ai, claude-code, dev-tools]
---

## Summary
2-3 sentence summary.

## Verdict: Read Now
Why this is worth reading.

## Key takeaways
- Bullet points
```

Use the `mcp__obsidian__write_note` tool. The note path should be `{folder}/{sanitized-title}.md`.

## Step 5: Archive in Instapaper

After writing the Obsidian note, archive the bookmark:

```bash
python3 -c "
from requests_oauthlib import OAuth1Session
# ... session setup ...
resp = session.post('https://www.instapaper.com/api/1/bookmarks/archive', data={'bookmark_id': BOOKMARK_ID})
print(resp.status_code)
"
```

## Step 6: Present summary

After processing all bookmarks, show a summary table:

```
Triaged 15 articles:
  3 → Inbox     ★ (titles listed)
  7 → Review    ? (titles listed)
  3 → Ignored   ✗ (titles + reasons)
  2 → Obsolete  ⊘ (titles + what replaced them)

All 15 archived in Instapaper.
```

## Rules
- Always read `reading-prefs.md` before evaluating
- Never delete Instapaper bookmarks — only archive
- If Instapaper API auth fails, fall back to RSS feed URL stored in `~/.instapaper-credentials` as `INSTAPAPER_RSS_URL`
- If `requests_oauthlib` is not installed, install it: `pip install requests-oauthlib`
- Be terse in output — summary table, not play-by-play

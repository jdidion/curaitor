# KB Transfer Format v1 (CKT-1)

**Status:** Draft
**Purpose:** Portable, async transfer of knowledge between personal Curaitor KBs
**Scope:** Topics and their attached links/articles; **not** preferences, autonomy state, triage rules, or credentials
**Envelope:** [Pod v1](SPEC-pod-envelope.md) — CKT is a payload kind (`payload.kind: "ckt"`) carried inside a Pod. This spec defines the payload body; Pod defines identity, integrity, routing, and versioning of the bundle as a whole.

---

## Goals

- **Async, one-shot:** sender produces a file, recipient imports it. No live connection, no shared service.
- **Self-contained:** bundle carries everything needed to reconstruct the subject topic on the receiver. No external fetches required at import time.
- **Content-addressable:** identical bundles produce identical hashes; two users exporting the same topic produce comparable output.
- **Merge-aware:** importer can detect and resolve conflicts (same link from two senders, topic already exists locally, etc.).
- **Backend-agnostic:** producible/consumable by Obsidian-backend or SQLite-backend installs; neutral format in between.
- **Extensible:** future backends (Dolt per issue #16, direct P2P, signed bundles) can produce or consume the same format.

## Non-goals (v1)

- Encryption / signatures — out of scope; use trusted channels (Signal, email, shared drive)
- Incremental updates — re-export and re-import is fine for v1
- Article body sync — v1 ships link metadata; the recipient re-fetches content if they want it
- Author identity — manifest records a free-form `exportedBy` string, no PKI

---

## Bundle format

A Curaitor KB Transfer bundle is a **Pod v1 Shape B** (zip container) with
extension `.ckt`. The Pod envelope (`pod.json` at the zip root) handles
identity, integrity, routing, and versioning; the CKT payload body lives
under `payload/`.

### Directory layout

```
topic-genomics-variant-calling.ckt
├── pod.json                       # Pod envelope (see SPEC-pod-envelope.md)
└── payload/
    ├── topic.json                 # the primary topic being exported
    ├── links/
    │   ├── <link-slug-1>.json
    │   ├── <link-slug-2>.json
    │   └── ...
    ├── articles/                  # optional: full article notes attached to topic
    │   ├── <article-slug-1>.md
    │   └── ...
    └── attachments/               # optional: PDFs, images referenced by articles
        └── <hash>.<ext>
```

All filenames are **slugified** (lowercase, ascii, hyphens); the canonical ID
lives in the JSON. Slugs are for human legibility only — import resolves by ID.

### pod.json (envelope + CKT-specific fields)

Full Pod envelope structure is defined in `SPEC-pod-envelope.md`. The
CKT-specific fields live under `payload.ckt`:

```json
{
  "format": "pod",
  "version": 1,
  "id": "01JQK7XW8ERT4N5D6PZYABC123",
  "createdAt": "2026-04-19T12:00:00Z",
  "from": "jdidion",
  "to": "alice",
  "payload": {
    "kind": "ckt",
    "version": 1,
    "root": "payload/",
    "ckt": {
      "source": {
        "tool": "curaitor",
        "version": "2.0.0",
        "backend": "sqlite"
      },
      "contents": {
        "topics": 1,
        "links": 12,
        "articles": 3,
        "attachments": 2
      },
      "primaryTopic": "topic-genomics-variant-calling"
    }
  },
  "fingerprints": {
    "payload/topic.json": "sha256-<hex>",
    "payload/links/chromium-aligner.json": "sha256-<hex>"
  }
}
```

CKT-specific fields under `payload.ckt`:
- `source`: which tool + version produced this bundle (for diagnostics)
- `contents`: entity counts (for the inspector UI)
- `primaryTopic`: slug of the top-level topic being exported (matches a file in `payload/`)

### topic.json

```json
{
  "id": "topic-genomics-variant-calling",
  "name": "Genomics / Variant Calling",
  "description": "Short-read and long-read variant calling methods",
  "tags": ["genomics", "variant-calling", "bioinformatics"],
  "summary": "…markdown summary…",
  "dateCreated": "2026-01-14T09:00:00Z",
  "dateUpdated": "2026-04-18T17:30:00Z"
}
```

Field semantics mirror the existing `Topic` type. `id` is the original ID from
the exporter's KB; importers use it to match against their own topics (see Merge).

### links/<slug>.json

```json
{
  "id": "link-chromium-aligner",
  "url": "https://github.com/example/chromium-aligner",
  "title": "Chromium aligner",
  "type": "repo",
  "category": "Genomics/Aligners",
  "tags": ["aligner", "long-read"],
  "description": "Fast long-read aligner with haplotype awareness",
  "dateAdded": "2026-03-02T14:22:00Z",
  "externalId": "example/chromium-aligner",
  "attachedArticles": ["article-chromium-paper"]
}
```

- `type`, `category`, `tags`, `description`, `externalId`: mirror existing `Link`
- `attachedArticles`: slugs of article files bundled in `articles/`
- `backend` field from the source model is **intentionally omitted** — it's a
  local concern. Receiver decides where the link lives based on type.

### articles/<slug>.md

Standard frontmatter + markdown, same format Curaitor already writes. Only
attached when `bundleArticles=true` during export. Body contains the user's notes.

### attachments/<hash>.<ext>

Content-addressed by sha256 of the file bytes. Articles reference by hash.

---

## CLI surface

```bash
# Export a topic (sender)
cu:export <topic-name-or-id> [--with-articles] [--with-attachments] [-o <path>]

# Import a bundle (receiver)
cu:import <path-to-.ckt> [--dry-run] [--on-conflict <strategy>]

# Inspect without importing
cu:inspect <path-to-.ckt>
```

`cu:inspect` prints the manifest + summary counts + conflict preview against
the local KB.

Conflict strategies (applied on import):
- `skip` — skip any incoming item that already exists locally (default for links)
- `overwrite` — local loses, incoming wins
- `merge` — union tags, prefer newer `dateUpdated` for textual fields (default for topics)
- `rename` — import under a new ID (recipient decides; useful when bundle topic
  would collide with a distinct local topic of the same name)

Interactive mode: when running under Claude Code (`/cu:import`), the agent
walks each conflict with the user rather than taking a flag.

---

## Merge semantics

For each incoming entity, the importer computes a **match** against the local KB:

**Topics** match on:
1. Exact `id` (indicates re-import of same bundle)
2. Exact `name` (case-insensitive)
3. Otherwise, no match → create new topic

**Links** match on:
1. Exact `url` (normalized: lowercase host, strip trailing slash, strip known tracking params)
2. Otherwise, no match → create new link

**Articles** match on:
1. Exact title + url
2. Otherwise → create new

### Default merge policy (per entity)

| Entity | Match? | Default |
|--------|--------|---------|
| Topic  | yes    | merge (union tags, prefer newer description/summary) |
| Topic  | no     | create |
| Link   | yes    | merge (union tags, keep local description unless empty) |
| Link   | no     | create and attach to resolved topic |
| Article | yes   | skip (local wins) |
| Article | no    | create |

The `attachedArticles` and `topicIds` relationships are always unioned —
importing never removes local attachments.

### Idempotency

Re-importing the same bundle is a no-op when the local KB already contains
everything at the same or newer `dateUpdated`. The importer records bundle
IDs it has seen (in a small `.ckt-imports.json` state file) to short-circuit
duplicate imports.

---

## Security model

**v1 is explicit about trust:** no signatures, no encryption. The recipient
is trusting the sender the same way they would trust a link shared in Slack.

Mitigations built into the format (inherited from Pod):
- `fingerprints` map detects bundle corruption or mid-transit tampering
- Pod `id` lets the sender share an out-of-band identifier
- Bundle content is inspected before import (`cu:inspect`); nothing runs
- No executable content — only JSON, markdown, and attachments

Future work lands at the Pod layer (benefits all payload kinds):
- **pod-signed:** append a detached sig + public key, verify at import
- **pod-encrypted:** envelope encryption with a recipient's key
- **Trust roots:** per-user allowlist of `from` principals

---

## Backend mapping

Each backend implements two small interfaces added to `StorageBackend`:

```typescript
exportTopic(topicId: string, opts: ExportOpts): CktBundle;
importBundle(bundle: CktBundle, opts: ImportOpts): ImportReport;
```

The shared, in-memory `CktBundle` type is backend-neutral; backends serialize
it to/from disk via a shared `ckt` library module. ObsidianBackend and
SQLiteBackend differ only in where they read/write the underlying entities.

Third-party backends (Zotero, GitHub stars, Raindrop) can export but not
import — they're read-sources, not writable destinations.

---

## Open questions

1. **Topic hierarchy:** if a topic has sub-topics (not yet supported), does
   export recurse? v1: no. Revisit when sub-topics exist.
2. **Slop scores & triage signals:** these are personal metrics and **not**
   exported. A recipient importing a link starts with fresh scoring.
3. **Tag normalization:** sender's `["GENOMICS", "Variant-Calling"]` vs.
   recipient's `["genomics", "variant-calling"]` — v1 normalizes at import
   (lowercase, hyphenated). Sender's original casing is discarded.
4. **Versioning:** `format: "ckt", version: 1` in manifest. Breaking changes
   bump the major; importers reject unknown majors and log a hint.

---

## Implementation plan

Three PRs, in order:

### PR 1 — Format library + export
- `src/ckt/types.ts` — bundle and manifest types
- `src/ckt/writer.ts` — serialize bundle to zip
- `src/ckt/reader.ts` — parse zip into bundle, verify fingerprints
- `src/services/export.ts` — `exportTopic(topicId, opts)` orchestration
- `src/routes/export.ts` — web route: "export topic" button on topic detail
- Plugin: `/cu:export` skill

### PR 2 — Import + merge
- `src/services/import.ts` — merge engine with conflict detection
- `src/routes/import.ts` — upload form, conflict preview, apply
- Plugin: `/cu:import` skill (interactive conflict walkthrough)

### PR 3 — Inspect + idempotency
- `src/routes/inspect.ts` — read-only manifest viewer
- Import state file (`.ckt-imports.json`) with bundle IDs seen
- `--dry-run` flag

Tests: round-trip export → import preserves data; merge policy cases;
fingerprint verification; bundle-ID idempotency.

# Pod — Portable Object Doc Envelope v1

**Status:** Draft
**Purpose:** Common envelope format for async, file-based transfers between Claude-adjacent tools (handoffs, KB transfers, etc.)
**Applies to:** any tool that moves a self-contained bundle of typed content between two endpoints

---

## Why

Multiple Claude-adjacent tools ship bundles between endpoints:

- **handoff** — task/session context transfer between cmux sessions
- **ckt** — knowledge-base transfer between personal Curaitor KBs
- *(future)* — signed config snapshots, research dataset drops, prompt libraries

Each tool's payload is meaningfully different, but all of them need the same envelope: identity, integrity check, routing, idempotency, versioning. Pod defines that envelope so each tool stops re-solving the same problem and future primitives (signatures, encryption, cross-machine transport) land once.

## Non-goals

- **Payload schema** — Pod is an envelope only; what goes inside is the payload protocol's concern.
- **Transport** — Pod does not define how bytes move. File drop, cmux, git, email — all fine.
- **Authentication** — v1 is explicit about trust; no signatures. Covered by a future `pod-signed` spec.

---

## Physical layout

A Pod is a **container** that carries:
1. A `pod.json` file at the root (the envelope)
2. A payload — either a single file or a directory tree — described by the envelope

Two container shapes are supported:

### Shape A — single-file pods (markdown, JSON, etc.)

Use when the payload is one file. The envelope is embedded as YAML frontmatter:

```markdown
---
pod:
  format: pod
  version: 1
  id: 01JQK7XW8ERT4N5D6PZYABC123
  createdAt: 2026-04-19T12:00:00Z
  from: curaitor-review
  to: prism-dev
  payload:
    kind: handoff
    version: 1
  fingerprint: sha256-<hex of body>
---

<payload body here>
```

The `fingerprint` covers the payload body (everything after the closing `---`).

### Shape B — zip pods (multi-file)

Use when the payload is a directory tree. The zip root contains `pod.json` and the payload tree:

```
<bundle>.pod.zip           # or <bundle>.<payload-kind> (e.g. .ckt) for convenience
├── pod.json               # required envelope
└── payload/               # payload files (layout defined by payload kind)
    ├── ...
    └── ...
```

`pod.json`:
```json
{
  "format": "pod",
  "version": 1,
  "id": "01JQK7XW8ERT4N5D6PZYABC123",
  "createdAt": "2026-04-19T12:00:00Z",
  "from": "curaitor-review",
  "to": "prism-dev",
  "payload": {
    "kind": "ckt",
    "version": 1,
    "root": "payload/"
  },
  "fingerprints": {
    "payload/manifest.json": "sha256-<hex>",
    "payload/topic.json": "sha256-<hex>",
    "payload/links/chromium-aligner.json": "sha256-<hex>"
  }
}
```

---

## Envelope fields

| Field | Required | Purpose |
|-------|----------|---------|
| `format` | yes | Literal `"pod"` — marker |
| `version` | yes | Envelope major version (currently `1`) |
| `id` | yes | ULID unique to this pod. Used for idempotency. |
| `createdAt` | yes | ISO-8601 UTC timestamp |
| `from` | yes | Free-form sender identifier (session name, user handle, etc.) |
| `to` | yes | Free-form receiver identifier |
| `payload.kind` | yes | Payload protocol name (`handoff`, `ckt`, etc.) |
| `payload.version` | yes | Payload protocol version |
| `payload.root` | only in Shape B | Directory prefix inside zip that contains the payload |
| `fingerprint` | yes (Shape A) | sha256 of payload body |
| `fingerprints` | yes (Shape B) | Map of path → sha256 for every payload file |
| `exportedBy` | optional | Authoring principal (user, tool). Free-form in v1. |
| `note` | optional | Short human-readable description |

### Reserved but optional

Fields reserved for future specs; implementers MAY emit but MUST NOT depend on them:

- `signature` — for `pod-signed`
- `encryption` — for `pod-encrypted`
- `inReplyTo` — pod ID this one responds to (chain)
- `supersedes` — pod ID this one replaces

---

## Semantics

### IDs and idempotency

- `id` is a [ULID](https://github.com/ulid/spec) — time-ordered, globally unique, URL-safe
- Receivers SHOULD track seen pod IDs (local state file) and short-circuit duplicate imports
- Re-transmitting the same pod must produce the same `id` only if the content is bit-identical; otherwise a new export generates a new `id`

### Fingerprints

- Always sha256, hex-encoded, prefix `sha256-`
- Receivers MUST verify fingerprints before trusting payload content. Fingerprint mismatch = reject.
- Fingerprints are computed over the raw file bytes, not over semantic content. Re-serialization changes fingerprints and requires a new pod ID.

**Shape A body canonicalization.** The "body" is everything after the closing `---\n` of the frontmatter. Both writer and reader MUST treat the body as UTF-8 bytes with no BOM and LF (`\n`) line endings when computing and verifying the fingerprint. Tools MUST NOT normalize line endings during transport (disable `git autocrlf`, etc.). If a renderer or editor mutates the bytes, the pod is considered tampered and MUST be rejected.

### Versioning

- `version` (envelope) and `payload.version` evolve independently
- **Envelope major bump** → readers without support for the new major MUST reject with a clear error
- **Payload major bump** → same, scoped to that payload kind
- Minor bumps are additive and backward-compatible

### Routing

- `from` and `to` are opaque strings — Pod does not define an identity system
- Transport layer resolves `to` to a delivery destination (cmux surface, file path, URL, etc.)
- Empty or `"*"` `to` means "broadcast / any receiver" — up to the payload to define meaning

---

## Transport

Transport is out of scope for this spec, but a **recommended convention** for file-based transports:

```
~/.claude/pods/
├── inbox/<to>/<id>.<ext>       # incoming, pending acceptance
├── outbox/<from>/<id>.<ext>    # sent, audit trail
└── archive/<to>/<id>.<ext>     # accepted and processed
```

Where `<ext>` is `.md` (Shape A, markdown), `.json` (Shape A, JSON), or the
payload-defined extension for Shape B (`.ckt`, `.pod.zip`, etc.).

**Doorbells** (optional, when the receiver is reachable live): an out-of-band
notification that a pod has landed. Any mechanism works — cmux message, OS
notification, webhook. The pod itself carries no doorbell info; the transport
layer decides.

---

## Library shape (non-normative)

Reference implementation should expose:

```typescript
interface Pod<T = unknown> {
  envelope: PodEnvelope;
  payload: T;              // decoded per kind registry
  raw: Buffer | string;    // original bytes for re-verification
}

function writePod(envelope, payloadFiles): Buffer;
function readPod(bytes): { envelope, rawFiles, verify(): boolean };
function registerPayloadKind(kind, version, schema);
```

Each payload protocol (handoff, ckt) registers its schema and then speaks through the shared library. Signing/encrypting happen at the envelope layer, transparent to payload code.

---

## Payload kinds registry

Initial registered kinds:

| Kind | Spec | Shape | Notes |
|------|------|-------|-------|
| `handoff` | (handoff plugin) | A (markdown) | Task context transfer |
| `ckt` | SPEC-kb-transfer-v1.md | B (zip) | KB topic bundles |

New kinds go in the central registry (future: a JSON file at a known URL, or hardcoded in each library release). For now, tools ship with an allowlist.

---

## Migration notes

### For `handoff`

Current `handoff` uses YAML frontmatter with payload-specific fields at the top level:
```yaml
---
from: curaitor-review
to: prism-dev
timestamp: 2026-04-17T02:30:00Z
slug: implement-direnv-scoping
---
```

Migrate to Shape A:
```yaml
---
pod:
  format: pod
  version: 1
  id: <ulid>
  createdAt: 2026-04-17T02:30:00Z
  from: curaitor-review
  to: prism-dev
  payload:
    kind: handoff
    version: 1
  fingerprint: sha256-<hex>
handoff:
  slug: implement-direnv-scoping
---
<markdown sections>
```

Bump payload.version to 1. Readers that only know the old format can keep working by checking for `pod:` at the top level and falling back.

### For `ckt`

CKT's `manifest.json` merges into `pod.json`: CKT-specific fields (contents counts, primaryTopic) move under `payload.ckt`:

```json
{
  "format": "pod",
  "version": 1,
  "id": "...",
  "createdAt": "...",
  "from": "...",
  "to": "...",
  "payload": {
    "kind": "ckt",
    "version": 1,
    "root": "payload/",
    "ckt": {
      "contents": { "topics": 1, "links": 12, "articles": 3 },
      "primaryTopic": "topic-genomics-variant-calling"
    }
  },
  "fingerprints": { ... }
}
```

---

## Open questions

1. **Single envelope file vs. embedded** — should Shape B always carry a separate `pod.json`, or allow stashing the envelope in the zip comment? v1: always a file (simpler, greppable).
2. **Canonicalization** — sha256 is byte-level; a re-serialized-but-semantically-identical pod changes fingerprints. Is that OK? v1: yes. Canonical JSON is a separate spec.
3. **Inbox ownership** — `~/.claude/pods/inbox/<to>/` assumes a single user's machine. Multi-user inboxes (team shared drive) are future work.

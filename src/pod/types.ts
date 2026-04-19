// Pod v1 envelope types — see docs/SPEC-pod-envelope.md

export interface PodEnvelope {
  format: 'pod';
  version: 1;
  id: string;                    // ULID
  createdAt: string;             // ISO-8601 UTC
  from: string;
  to: string;
  payload: PodPayloadRef;
  fingerprints: Record<string, string>;   // path → sha256-<hex>
  exportedBy?: string;
  note?: string;
}

export interface PodPayloadRef {
  kind: string;                  // 'handoff' | 'ckt' | ...
  version: number;
  root?: string;                 // directory prefix inside Shape B zip; default 'payload/'
  // Payload-specific fields live under `[kind]` keys (e.g. payload.ckt)
  [k: string]: unknown;
}

/** A Pod file in memory — one logical path → its bytes */
export type PodFiles = Map<string, Buffer>;

/** Result of reading a Pod zip */
export interface PodBundle {
  envelope: PodEnvelope;
  files: PodFiles;               // keyed by path-in-zip (including payload/ prefix)
}

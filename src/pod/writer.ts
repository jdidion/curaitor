import AdmZip from 'adm-zip';
import { createHash } from 'node:crypto';
import type { PodEnvelope, PodPayloadRef } from './types.js';
import { ulid } from './ulid.js';

export interface WritePodInput {
  from: string;
  to: string;
  payload: { kind: string; version: number; [k: string]: unknown };
  files: Map<string, Buffer>;          // path → bytes; all should live under the payload root
  root?: string;                        // default 'payload/'
  exportedBy?: string;
  note?: string;
}

/** Build a Pod Shape B (zip) bundle. Returns the zip bytes. */
export function writePod(input: WritePodInput): { bytes: Buffer; envelope: PodEnvelope } {
  const root = input.root ?? 'payload/';
  const id = ulid();
  const createdAt = new Date().toISOString();

  const fingerprints: Record<string, string> = {};
  for (const [path, data] of input.files) {
    if (!path.startsWith(root)) {
      throw new Error(`Pod file path ${path} does not start with payload root ${root}`);
    }
    fingerprints[path] = sha256(data);
  }

  const envelope: PodEnvelope = {
    format: 'pod',
    version: 1,
    id,
    createdAt,
    from: input.from,
    to: input.to,
    payload: { ...input.payload, root },
    fingerprints,
    ...(input.exportedBy ? { exportedBy: input.exportedBy } : {}),
    ...(input.note ? { note: input.note } : {}),
  };

  const zip = new AdmZip();
  zip.addFile('pod.json', Buffer.from(JSON.stringify(envelope, null, 2)));
  for (const [path, data] of input.files) {
    zip.addFile(path, data);
  }
  return { bytes: zip.toBuffer(), envelope };
}

function sha256(data: Buffer): string {
  return 'sha256-' + createHash('sha256').update(data).digest('hex');
}

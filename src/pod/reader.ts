import AdmZip from 'adm-zip';
import { createHash } from 'node:crypto';
import type { PodBundle, PodEnvelope, PodFiles } from './types.js';

export interface VerifyResult {
  ok: boolean;
  mismatches: string[];
}

/** Parse a Pod Shape B (zip) bundle. Does NOT verify fingerprints — call verify() separately. */
export function readPod(bytes: Buffer): PodBundle {
  const zip = new AdmZip(bytes);
  const entries = zip.getEntries();

  const podEntry = entries.find((e) => e.entryName === 'pod.json');
  if (!podEntry) throw new Error('Invalid pod: pod.json not found at zip root');

  let envelope: PodEnvelope;
  try {
    envelope = JSON.parse(podEntry.getData().toString('utf-8')) as PodEnvelope;
  } catch (e) {
    throw new Error(`Invalid pod.json: ${(e as Error).message}`);
  }

  if (envelope.format !== 'pod') {
    throw new Error(`Not a pod: format=${envelope.format}`);
  }
  if (envelope.version !== 1) {
    throw new Error(`Unsupported pod version: ${envelope.version}`);
  }

  const files: PodFiles = new Map();
  for (const entry of entries) {
    if (entry.entryName === 'pod.json' || entry.isDirectory) continue;
    files.set(entry.entryName, entry.getData());
  }

  return { envelope, files };
}

/** Verify fingerprints recorded in envelope match actual file bytes. */
export function verify(bundle: PodBundle): VerifyResult {
  const mismatches: string[] = [];
  for (const [path, expected] of Object.entries(bundle.envelope.fingerprints)) {
    const file = bundle.files.get(path);
    if (!file) {
      mismatches.push(`${path}: missing`);
      continue;
    }
    const actual = sha256(file);
    if (actual !== expected) {
      mismatches.push(`${path}: expected ${expected}, got ${actual}`);
    }
  }
  // Also check for files not in fingerprint map (would indicate tampered zip with extras)
  for (const path of bundle.files.keys()) {
    if (!(path in bundle.envelope.fingerprints)) {
      mismatches.push(`${path}: unexpected file (not in fingerprints)`);
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}

function sha256(data: Buffer): string {
  return 'sha256-' + createHash('sha256').update(data).digest('hex');
}

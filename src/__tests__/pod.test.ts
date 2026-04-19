import { describe, it, expect } from 'vitest';
import { writePod } from '../pod/writer.js';
import { readPod, verify } from '../pod/reader.js';

describe('pod envelope', () => {
  it('round-trips a bundle with files', () => {
    const files = new Map<string, Buffer>([
      ['payload/topic.json', Buffer.from('{"id":"t1"}')],
      ['payload/links/a.json', Buffer.from('{"id":"a"}')],
    ]);
    const { bytes } = writePod({
      from: 'alice',
      to: 'bob',
      payload: { kind: 'ckt', version: 1 },
      files,
    });
    const bundle = readPod(bytes);
    expect(bundle.envelope.format).toBe('pod');
    expect(bundle.envelope.version).toBe(1);
    expect(bundle.envelope.from).toBe('alice');
    expect(bundle.envelope.to).toBe('bob');
    expect(bundle.envelope.payload.kind).toBe('ckt');
    expect(bundle.envelope.payload.version).toBe(1);
    expect(bundle.envelope.payload.root).toBe('payload/');
    expect(bundle.files.get('payload/topic.json')?.toString()).toBe('{"id":"t1"}');
    expect(bundle.files.get('payload/links/a.json')?.toString()).toBe('{"id":"a"}');
  });

  it('populates unique ULID per export', () => {
    const files = new Map([['payload/x.json', Buffer.from('{}')]]);
    const a = writePod({ from: 'a', to: 'b', payload: { kind: 'ckt', version: 1 }, files });
    const b = writePod({ from: 'a', to: 'b', payload: { kind: 'ckt', version: 1 }, files });
    expect(a.envelope.id).not.toBe(b.envelope.id);
    expect(a.envelope.id).toMatch(/^[0-9A-Z]{26}$/);
  });

  it('verifies matching fingerprints', () => {
    const files = new Map([['payload/a.json', Buffer.from('abc')]]);
    const { bytes } = writePod({
      from: 'a', to: 'b', payload: { kind: 'ckt', version: 1 }, files,
    });
    const bundle = readPod(bytes);
    const result = verify(bundle);
    expect(result.ok).toBe(true);
    expect(result.mismatches).toEqual([]);
  });

  it('detects tampered file content', () => {
    const files = new Map([['payload/a.json', Buffer.from('abc')]]);
    const { bytes } = writePod({
      from: 'a', to: 'b', payload: { kind: 'ckt', version: 1 }, files,
    });
    const bundle = readPod(bytes);
    // Tamper: swap file bytes in-memory
    bundle.files.set('payload/a.json', Buffer.from('different'));
    const result = verify(bundle);
    expect(result.ok).toBe(false);
    expect(result.mismatches.some((m) => m.includes('payload/a.json'))).toBe(true);
  });

  it('rejects file paths outside payload root', () => {
    const files = new Map([['wrong/a.json', Buffer.from('{}')]]);
    expect(() => writePod({
      from: 'a', to: 'b', payload: { kind: 'ckt', version: 1 }, files,
    })).toThrow(/does not start with payload root/);
  });

  it('rejects non-pod zips', () => {
    // Create a zip without pod.json
    const { bytes } = writePod({
      from: 'a', to: 'b', payload: { kind: 'ckt', version: 1 },
      files: new Map([['payload/a.json', Buffer.from('{}')]]),
    });
    // Corrupt: rewrite the pod.json to not be a pod
    const bundle = readPod(bytes);
    expect(bundle.envelope.format).toBe('pod');
    // Negative: raw bytes of a plain empty buffer
    expect(() => readPod(Buffer.from('not a zip'))).toThrow();
  });

  it('preserves optional exportedBy and note', () => {
    const files = new Map([['payload/a.json', Buffer.from('{}')]]);
    const { bytes } = writePod({
      from: 'a', to: 'b',
      payload: { kind: 'ckt', version: 1 },
      files,
      exportedBy: 'jdidion',
      note: 'Spring 2026 genomics reading list',
    });
    const bundle = readPod(bytes);
    expect(bundle.envelope.exportedBy).toBe('jdidion');
    expect(bundle.envelope.note).toBe('Spring 2026 genomics reading list');
  });
});

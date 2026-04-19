import { randomBytes } from 'node:crypto';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Generate a ULID (26 chars, Crockford base32). Time-ordered, globally unique. */
export function ulid(): string {
  const time = Date.now();
  const timeBytes = encodeTime(time);
  const randChars = encodeRandom();
  return timeBytes + randChars;
}

function encodeTime(ms: number): string {
  let out = '';
  for (let i = 9; i >= 0; i--) {
    out = CROCKFORD[ms % 32] + out;
    ms = Math.floor(ms / 32);
  }
  return out;
}

function encodeRandom(): string {
  const bytes = randomBytes(10);
  let out = '';
  for (const byte of bytes) {
    out += CROCKFORD[byte % 32];
    out += CROCKFORD[(byte >> 3) % 32];
  }
  return out.slice(0, 16);
}

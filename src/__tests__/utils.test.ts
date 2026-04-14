import { describe, it, expect } from 'vitest';
import { esc, sanitizeId } from '../lib/utils.js';

describe('esc', () => {
  it('escapes ampersand to &amp;', () => {
    expect(esc('A & B')).toBe('A &amp; B');
  });

  it('escapes less-than to &lt;', () => {
    expect(esc('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes greater-than to &gt;', () => {
    expect(esc('a > b')).toBe('a &gt; b');
  });

  it('escapes double quotes to &quot;', () => {
    expect(esc('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes single quotes to &#39;', () => {
    expect(esc("it's")).toBe('it&#39;s');
  });

  it('escapes all special characters in one string', () => {
    expect(esc('<a href="x" class=\'y\'>&</a>')).toBe(
      '&lt;a href=&quot;x&quot; class=&#39;y&#39;&gt;&amp;&lt;/a&gt;'
    );
  });

  it('returns empty string unchanged', () => {
    expect(esc('')).toBe('');
  });

  it('returns string with no special characters unchanged', () => {
    expect(esc('hello world 123')).toBe('hello world 123');
  });
});

describe('sanitizeId', () => {
  it('rejects paths containing forward slash', () => {
    expect(sanitizeId('../etc/passwd')).toBeNull();
  });

  it('rejects paths containing backslash', () => {
    expect(sanitizeId('..\\windows\\system32')).toBeNull();
  });

  it('rejects dotfiles starting with a period', () => {
    expect(sanitizeId('.env')).toBeNull();
  });

  it('rejects strings containing null bytes', () => {
    expect(sanitizeId('file\0name')).toBeNull();
  });

  it('rejects empty string', () => {
    expect(sanitizeId('')).toBeNull();
  });

  it('accepts normal filenames and returns them unchanged', () => {
    expect(sanitizeId('my-article.md')).toBe('my-article.md');
  });

  it('accepts filenames with spaces', () => {
    expect(sanitizeId('my article title.md')).toBe('my article title.md');
  });

  it('accepts filenames with hyphens and underscores', () => {
    expect(sanitizeId('some_file-name_v2.md')).toBe('some_file-name_v2.md');
  });
});

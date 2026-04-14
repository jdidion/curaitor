/** Shared HTML escape — handles all HTML-significant characters */
export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Validate filename is safe (no path traversal) */
export function sanitizeId(name: string): string | null {
  if (!name || name.includes('/') || name.includes('\\') || name.startsWith('.') || name.includes('\0')) {
    return null;
  }
  return name;
}

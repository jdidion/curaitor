import { getBackend } from '../storage/index.js';
import type { Link, LinkType, LinkBackend } from '../storage/types.js';

export type { Link, LinkType, LinkBackend } from '../storage/types.js';

export function listLinks(opts?: { topicId?: string; type?: LinkType; category?: string; backend?: LinkBackend }): Link[] {
  return getBackend().listLinks(opts);
}

export function getLink(id: string): Link | null {
  return getBackend().getLink(id);
}

export function createLink(link: Partial<Link>): Link {
  return getBackend().createLink(link);
}

export function updateLink(id: string, updates: Partial<Link>): void {
  getBackend().updateLink(id, updates);
}

export function deleteLink(id: string): void {
  getBackend().deleteLink(id);
}

export function linkCount(): number {
  return getBackend().linkCount();
}

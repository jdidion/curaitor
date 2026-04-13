import { getBackend } from '../storage/index.js';
import type { RecycleEntry } from '../storage/types.js';

export type { RecycleEntry } from '../storage/types.js';

export function loadRecycle(): RecycleEntry[] {
  return getBackend().loadRecycle();
}

export function appendRecycle(title: string, url: string, tag?: string): void {
  getBackend().appendRecycle(title, url, tag);
}

export function clearRecycle(): void {
  getBackend().clearRecycle();
}

export function recycleCount(): number {
  return getBackend().recycleCount();
}

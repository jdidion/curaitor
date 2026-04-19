import { getBackend } from '../storage/index.js';
import { writePod } from '../pod/writer.js';
import type { Topic, Link, Article } from '../storage/types.js';
import type { CktLinkFile, CktPayloadMeta, CktTopicFile } from '../ckt/types.js';
import type { PodEnvelope } from '../pod/types.js';

const VERSION = '2.0.0';
const PAYLOAD_ROOT = 'payload/';

export interface ExportOpts {
  from: string;
  to: string;
  withArticles?: boolean;       // include article bodies for links' attachedArticles
  exportedBy?: string;
  note?: string;
}

export interface ExportResult {
  bytes: Buffer;
  envelope: PodEnvelope;
  filename: string;              // suggested filename, e.g. "topic-genomics.ckt"
  counts: CktPayloadMeta['contents'];
}

/** Export a topic + its attached links (+ optionally article bodies) as a CKT pod. */
export function exportTopic(topicId: string, opts: ExportOpts): ExportResult {
  const backend = getBackend();
  const topic = backend.getTopic(topicId);
  if (!topic) throw new Error(`Topic not found: ${topicId}`);

  const links = backend.getTopicLinks(topic.id);
  const topicSlug = slugify(topic.name) || topic.id;

  const articles = opts.withArticles ? collectArticles(links) : [];

  const files = new Map<string, Buffer>();
  files.set(`${PAYLOAD_ROOT}topic.json`, jsonBuf(toTopicFile(topic)));
  for (const link of links) {
    const slug = slugify(link.title) || link.id;
    const articleSlugs = opts.withArticles
      ? articlesForLink(link, articles).map((a) => slugify(a.title) || a.id)
      : [];
    files.set(
      `${PAYLOAD_ROOT}links/${slug}.json`,
      jsonBuf(toLinkFile(link, articleSlugs))
    );
  }
  for (const article of articles) {
    const slug = slugify(article.title) || article.id;
    files.set(
      `${PAYLOAD_ROOT}articles/${slug}.md`,
      Buffer.from(article.body || '', 'utf-8')
    );
  }

  const contents: CktPayloadMeta['contents'] = {
    topics: 1,
    links: links.length,
    articles: articles.length,
    attachments: 0,
  };

  const { bytes, envelope } = writePod({
    from: opts.from,
    to: opts.to,
    payload: {
      kind: 'ckt',
      version: 1,
      ckt: {
        source: { tool: 'curaitor', version: VERSION, backend: backendKind() },
        contents,
        primaryTopic: topicSlug,
      } satisfies CktPayloadMeta,
    },
    files,
    exportedBy: opts.exportedBy,
    note: opts.note,
  });

  return {
    bytes,
    envelope,
    filename: `topic-${topicSlug}.ckt`,
    counts: contents,
  };
}

// --- helpers ---

function toTopicFile(t: Topic): CktTopicFile {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    tags: t.tags,
    summary: t.summary,
    dateCreated: t.dateCreated,
    dateUpdated: t.dateUpdated,
  };
}

function toLinkFile(l: Link, attachedArticles: string[]): CktLinkFile {
  return {
    id: l.id,
    url: l.url,
    title: l.title,
    type: l.type,
    category: l.category,
    tags: l.tags,
    description: l.description,
    dateAdded: l.dateAdded,
    ...(l.externalId ? { externalId: l.externalId } : {}),
    attachedArticles,
  };
}

function jsonBuf(obj: unknown): Buffer {
  return Buffer.from(JSON.stringify(obj, null, 2), 'utf-8');
}

/** Collect articles whose URL matches any of the links. */
function collectArticles(links: Link[]): Article[] {
  const urls = new Set(links.map((l) => normalizeUrl(l.url)));
  const backend = getBackend();
  const folders = ['inbox', 'review', 'library'] as const;
  const seen = new Set<string>();
  const out: Article[] = [];
  for (const folder of folders) {
    for (const a of backend.listArticles(folder)) {
      const key = normalizeUrl(a.url);
      if (!urls.has(key) || seen.has(a.id)) continue;
      seen.add(a.id);
      out.push(a);
    }
  }
  return out;
}

function articlesForLink(link: Link, articles: Article[]): Article[] {
  const target = normalizeUrl(link.url);
  return articles.filter((a) => normalizeUrl(a.url) === target);
}

function normalizeUrl(u: string): string {
  return (u || '').trim().toLowerCase().replace(/\/+$/, '');
}

export function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function backendKind(): string {
  return process.env.STORAGE_BACKEND || 'obsidian';
}

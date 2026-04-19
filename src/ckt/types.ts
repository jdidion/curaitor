// CKT v1 payload types — see docs/SPEC-kb-transfer-v1.md

export interface CktPayloadMeta {
  source: {
    tool: string;
    version: string;
    backend: string;
  };
  contents: {
    topics: number;
    links: number;
    articles: number;
    attachments: number;
  };
  primaryTopic: string;          // slug of topic file in payload/
}

export interface CktTopicFile {
  id: string;
  name: string;
  description: string;
  tags: string[];
  summary: string;
  dateCreated: string;
  dateUpdated: string;
}

export interface CktLinkFile {
  id: string;
  url: string;
  title: string;
  type: string;
  category: string;
  tags: string[];
  description: string;
  dateAdded: string;
  externalId?: string;
  attachedArticles: string[];    // article slugs in payload/articles/
}

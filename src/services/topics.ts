import { getBackend } from '../storage/index.js';
import type { Topic, Link } from '../storage/types.js';

export type { Topic } from '../storage/types.js';

export function listTopics(): Topic[] {
  return getBackend().listTopics();
}

export function getTopic(id: string): Topic | null {
  return getBackend().getTopic(id);
}

export function createTopic(topic: Partial<Topic>): Topic {
  return getBackend().createTopic(topic);
}

export function updateTopic(id: string, updates: Partial<Topic>): void {
  getBackend().updateTopic(id, updates);
}

export function deleteTopic(id: string): void {
  getBackend().deleteTopic(id);
}

export function getTopicLinks(topicId: string): Link[] {
  return getBackend().getTopicLinks(topicId);
}

export function addLinkToTopic(linkId: string, topicId: string): void {
  getBackend().addLinkToTopic(linkId, topicId);
}

export function removeLinkFromTopic(linkId: string, topicId: string): void {
  getBackend().removeLinkFromTopic(linkId, topicId);
}

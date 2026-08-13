import { createHash } from 'node:crypto';

/** Content SHA used for versioning and optimistic concurrency (hex sha256). */
export function contentSha(rawMarkdown: string): string {
  return createHash('sha256').update(rawMarkdown, 'utf8').digest('hex');
}

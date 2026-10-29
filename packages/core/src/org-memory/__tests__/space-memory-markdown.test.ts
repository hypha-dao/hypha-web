import { describe, expect, it } from 'vitest';
import {
  buildSpaceMemoryCategoryMarkdownPack,
  formatCallTranscriptMarkdown,
  formatDiscussionSummaryMarkdown,
  formatMemoryDocumentMarkdown,
  formatSpaceMemoryMarkdownDoc,
} from '../space-memory-markdown';

describe('formatSpaceMemoryMarkdownDoc', () => {
  it('writes category frontmatter and a body AI can read', () => {
    const md = formatSpaceMemoryMarkdownDoc({
      title: 'Weekly sync',
      category: 'conversations',
      occurredAt: '2026-10-28T12:00:00.000Z',
      body: 'The group agreed to ship Space Memory markdown.',
      bullets: ['Ship category packs', 'Keep files separate'],
      meta: { source: 'discussion_summary', discussion_summary_id: 12 },
    });
    expect(md).toContain('category: conversations');
    expect(md).toContain('source: discussion_summary');
    expect(md).toContain('# Weekly sync');
    expect(md).toContain('## Highlights');
    expect(md).toContain('- Ship category packs');
  });
});

describe('typed markdown helpers', () => {
  it('marks discussion summaries as conversations markdown', () => {
    const md = formatDiscussionSummaryMarkdown({
      id: 7,
      summary: 'People asked for clearer memory context.',
      bullets: ['Add categories'],
      occurredAt: new Date('2026-10-28T10:00:00.000Z'),
      spaceSlug: 'hypha-platform',
    });
    expect(md).toContain('category: conversations');
    expect(md).toContain('discussion_summary_id: 7');
    expect(md).toContain('space_slug: hypha-platform');
  });

  it('marks call transcripts as calls markdown', () => {
    const md = formatCallTranscriptMarkdown({
      callSessionId: 'abc',
      text: 'Alex: Let’s record this.',
      summary: 'Short call note',
      spaceSlug: 'hypha-platform',
    });
    expect(md).toContain('category: calls');
    expect(md).toContain('call_session_id: abc');
    expect(md).toContain('Short call note');
  });

  it('marks written memory documents as conversations markdown', () => {
    const md = formatMemoryDocumentMarkdown({
      title: 'Launch notes',
      description: 'We decided to publish the pack.',
      documentId: 44,
      spaceSlug: 'hypha-platform',
    });
    expect(md).toContain('category: conversations');
    expect(md).toContain('document_id: 44');
    expect(md).toContain('We decided to publish the pack.');
  });
});

describe('buildSpaceMemoryCategoryMarkdownPack', () => {
  it('builds one markdown file per category', () => {
    const pack = buildSpaceMemoryCategoryMarkdownPack({
      spaceSlug: 'hypha-platform',
      spaceTitle: 'Hypha Platform',
      itemsByCategory: {
        conversations: [
          {
            title: 'Discussion summary 1',
            excerpt: 'A short write-up.',
            assetKey: 'key-1',
            source: 'discussion_summary',
            occurredAt: '2026-10-28T12:00:00.000Z',
          },
        ],
        calls: [],
        ai: [
          {
            title: 'AI chat dump',
            source: 'matrix_chat',
          },
        ],
        files: [],
      },
    });
    expect(pack.conversations).toContain('category: conversations');
    expect(pack.conversations).toContain('Discussion summary 1');
    expect(pack.conversations).toContain('asset_key: `key-1`');
    expect(pack.calls).toContain('_No items in this category yet._');
    expect(pack.ai).toContain('AI chat dump');
    expect(pack.files).toContain('kind: category_index');
  });
});

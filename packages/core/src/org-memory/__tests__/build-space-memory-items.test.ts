import { describe, expect, it } from 'vitest';
import { DocumentState } from '../../governance/types';
import type { Document } from '../../governance/types';
import {
  buildSpaceMemoryItemsFromDocuments,
  buildSpaceMemoryItemsFromOrgMemoryPayload,
  filterSpaceMemoryItems,
} from '../build-space-memory-items';

const baseDoc = (over: Partial<Document>): Document => ({
  id: 1,
  creatorId: 1,
  title: 'My proposal',
  description: '',
  slug: 'my-proposal',
  state: DocumentState.PROPOSAL,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-06-01T12:00:00Z'),
  leadImage: '',
  attachments: [],
  web3ProposalId: null,
  label: '',
  ...over,
});

describe('buildSpaceMemoryItemsFromDocuments', () => {
  it('returns empty when proposal has only a lead image (decorative banner)', () => {
    expect(
      buildSpaceMemoryItemsFromDocuments([
        baseDoc({
          leadImage: 'https://cdn.example/hero.jpg',
        }),
      ]),
    ).toEqual([]);
  });

  it('returns empty when no attachments for proposals', () => {
    expect(buildSpaceMemoryItemsFromDocuments([baseDoc({})])).toEqual([]);
  });

  it('emits a memory row for text-only memory documents', () => {
    const rows = buildSpaceMemoryItemsFromDocuments([
      baseDoc({
        title: 'Team notes',
        description: 'We agreed to revisit the roadmap next week.',
        state: DocumentState.MEMORY,
        label: 'Space Memory',
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.source).toBe('memory');
    expect(rows[0]?.name).toBe('Team notes');
    expect(rows[0]?.context.documentState).toBe(DocumentState.MEMORY);
    expect(rows[0]?.context.textExcerpt).toContain('roadmap');
  });

  it('emits one row per attachment', () => {
    const docs = [
      baseDoc({
        attachments: [
          { name: 'Spec.pdf', url: 'https://cdn.example/spec.pdf' },
          'https://cdn.example/photo.png',
        ],
      }),
    ];
    const rows = buildSpaceMemoryItemsFromDocuments(docs);
    expect(rows).toHaveLength(2);
    const names = rows.map((r) => r.name).sort();
    expect(names).toEqual(['Spec.pdf', 'photo.png']);
    expect(rows.find((r) => r.name === 'photo.png')?.kind).toBe('image');
    expect(rows.find((r) => r.name === 'Spec.pdf')?.kind).toBe('document');
    expect(rows.every((r) => r.source === 'proposal_upload')).toBe(true);
  });

  it('emits attachments but not decorative lead image', () => {
    const docs = [
      baseDoc({
        leadImage: 'https://cdn.example/hero.jpg',
        attachments: ['https://cdn.example/other.pdf'],
      }),
    ];
    const rows = buildSpaceMemoryItemsFromDocuments(docs);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.url).toBe('https://cdn.example/other.pdf');
    expect(rows.some((r) => r.id.endsWith(':lead'))).toBe(false);
  });

  it('dedupes when lead image URL is also listed as attachment', () => {
    const url = 'https://cdn.example/same.png';
    const docs = [
      baseDoc({
        leadImage: url,
        attachments: [url],
      }),
    ];
    const rows = buildSpaceMemoryItemsFromDocuments(docs);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toContain('attachment');
  });

  it('sorts by updatedAt descending', () => {
    const docs = [
      baseDoc({
        id: 1,
        updatedAt: new Date('2024-01-02T00:00:00Z'),
        attachments: ['https://a/old.png'],
      }),
      baseDoc({
        id: 2,
        updatedAt: new Date('2024-01-10T00:00:00Z'),
        attachments: ['https://a/new.png'],
      }),
    ];
    const rows = buildSpaceMemoryItemsFromDocuments(docs);
    expect(rows[0]!.url).toBe('https://a/new.png');
    expect(rows[1]!.url).toBe('https://a/old.png');
  });

  it('classifies image from filename when URL has no extension (signed URL)', () => {
    const docs = [
      baseDoc({
        attachments: [
          {
            name: 'Screenshot 2026.png',
            url: 'https://cdn.example/file?token=abc',
          },
        ],
      }),
    ];
    const rows = buildSpaceMemoryItemsFromDocuments(docs);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe('image');
  });

  it('skips non-http(s) attachment URLs', () => {
    const docs = [
      baseDoc({
        attachments: [
          { name: 'evil', url: 'javascript:alert(1)' },
          'https://cdn.example/ok.pdf',
        ],
      }),
    ];
    const rows = buildSpaceMemoryItemsFromDocuments(docs);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.url).toBe('https://cdn.example/ok.pdf');
  });

  it('accepts ISO date strings from JSON (fetch / NextResponse)', () => {
    const docs = [
      {
        ...baseDoc({
          attachments: ['https://a/x.pdf'],
        }),
        createdAt: '2024-01-01T00:00:00.000Z' as unknown as Date,
        updatedAt: '2024-06-01T12:00:00.000Z' as unknown as Date,
      },
    ];
    expect(() =>
      buildSpaceMemoryItemsFromDocuments(docs as Document[]),
    ).not.toThrow();
    const rows = buildSpaceMemoryItemsFromDocuments(docs as Document[]);
    expect(rows[0]!.uploadedAt).toBe('2024-06-01T12:00:00.000Z');
  });
});

describe('buildSpaceMemoryItemsFromOrgMemoryPayload', () => {
  it('maps proposal_upload rows with governance context', () => {
    const rows = buildSpaceMemoryItemsFromOrgMemoryPayload({
      org_memory_assets: [
        {
          source: 'proposal_upload',
          filename: 'Spec.pdf',
          app_url: 'https://cdn.example/spec.pdf',
          document_id: 7,
          document_title: 'Budget',
          document_state: 'agreement',
          occurred_at: '2024-06-01T12:00:00.000Z',
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.source).toBe('proposal_upload');
    expect(rows[0]!.context.documentId).toBe(7);
    expect(rows[0]!.context.documentTitle).toBe('Budget');
    expect(rows[0]!.context.documentState).toBe('agreement');
    expect(rows[0]!.url).toBe('https://cdn.example/spec.pdf');
  });

  it('includes matrix_chat rows with mxc URL', () => {
    const rows = buildSpaceMemoryItemsFromOrgMemoryPayload({
      org_memory_assets: [
        {
          source: 'matrix_chat',
          filename: 'photo.png',
          mxc_uri: 'mxc://example.org/abc',
          matrix_room_id: '!r:example.org',
          matrix_event_id: '$ev1',
          mime: 'image/png',
          occurred_at: '2024-07-01T00:00:00.000Z',
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.source).toBe('matrix_chat');
    expect(rows[0]!.url).toBe('mxc://example.org/abc');
    expect(rows[0]!.kind).toBe('image');
  });

  it('includes call_recording rows with https app_url for object storage playback', () => {
    const rows = buildSpaceMemoryItemsFromOrgMemoryPayload({
      org_memory_assets: [
        {
          source: 'call_recording',
          filename: 'session-2.webm',
          app_url: 'https://utfs.io/f/recording-key',
          mime: 'video/webm',
          call_session_id: 'session-2',
          call_recording_id: 10,
          occurred_at: '2024-07-02T00:00:00.000Z',
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.source).toBe('call_recording');
    expect(rows[0]!.url).toBe('https://utfs.io/f/recording-key');
    expect(rows[0]!.kind).toBe('video');
  });

  it('includes call_recording rows with mxc URL for Matrix playback', () => {
    const rows = buildSpaceMemoryItemsFromOrgMemoryPayload({
      org_memory_assets: [
        {
          source: 'call_recording',
          filename: 'session-1.webm',
          mxc_uri: 'mxc://example.org/recording123',
          mime: 'video/webm',
          call_session_id: 'session-1',
          call_recording_id: 9,
          occurred_at: '2024-07-01T00:00:00.000Z',
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.source).toBe('call_recording');
    expect(rows[0]!.url).toBe('mxc://example.org/recording123');
    expect(rows[0]!.kind).toBe('video');
  });

  it('uses room title instead of opaque media id for call recordings', () => {
    const rows = buildSpaceMemoryItemsFromOrgMemoryPayload({
      org_memory_assets: [
        {
          source: 'call_recording',
          filename: '6MiOwFUJuAco8jasovTtxmqrbFV7No38vZBst2dA4lgwXT0y',
          mxc_uri:
            'mxc://example.org/6MiOwFUJuAco8jasovTtxmqrbFV7No38vZBst2dA4lgwXT0y',
          mime: 'video/webm',
          call_session_id: 'session-3',
          call_recording_id: 11,
          room_title: 'Hypha Core Team',
          occurred_at: '2024-07-03T00:00:00.000Z',
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe('Hypha Core Team');
    expect(rows[0]!.context.roomTitle).toBe('Hypha Core Team');
  });

  it('skips proposal rows without http(s) app_url', () => {
    const rows = buildSpaceMemoryItemsFromOrgMemoryPayload({
      org_memory_assets: [
        {
          source: 'proposal_upload',
          filename: 'x',
          app_url: 'javascript:alert(1)',
          occurred_at: '2024-01-01T00:00:00.000Z',
        },
      ],
    });
    expect(rows).toHaveLength(0);
  });
});

describe('filterSpaceMemoryItems', () => {
  it('filters by name or document title', () => {
    const items = buildSpaceMemoryItemsFromDocuments([
      baseDoc({
        id: 1,
        title: 'Alpha plan',
        attachments: ['https://x/a.pdf'],
      }),
      baseDoc({
        id: 2,
        title: 'Beta',
        attachments: ['https://x/b.pdf'],
      }),
    ]);
    const filtered = filterSpaceMemoryItems(items, 'alpha');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.context.documentTitle).toBe('Alpha plan');
  });

  it('filters matrix rows by mxc substring', () => {
    const items = buildSpaceMemoryItemsFromOrgMemoryPayload({
      org_memory_assets: [
        {
          source: 'matrix_chat',
          filename: 'a.png',
          mxc_uri: 'mxc://hs/uniqueid',
          occurred_at: '2024-01-01T00:00:00.000Z',
        },
      ],
    });
    const filtered = filterSpaceMemoryItems(items, 'uniqueid');
    expect(filtered).toHaveLength(1);
  });
});

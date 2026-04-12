import { describe, expect, it } from 'vitest';
import { DocumentState } from '../../governance/types';
import type { Document } from '../../governance/types';
import {
  buildSpaceMemoryItemsFromDocuments,
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
  it('returns empty when no attachments or lead image', () => {
    expect(buildSpaceMemoryItemsFromDocuments([baseDoc({})])).toEqual([]);
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

  it('adds lead image when not duplicated in attachments', () => {
    const docs = [
      baseDoc({
        leadImage: 'https://cdn.example/hero.jpg',
        attachments: ['https://cdn.example/other.pdf'],
      }),
    ];
    const rows = buildSpaceMemoryItemsFromDocuments(docs);
    expect(rows).toHaveLength(2);
    const lead = rows.find((r) => r.id.endsWith(':lead'));
    expect(lead?.url).toBe('https://cdn.example/hero.jpg');
    expect(lead?.kind).toBe('image');
  });

  it('skips lead image when same URL exists in attachments', () => {
    const url = 'https://cdn.example/same.png';
    const docs = [
      baseDoc({
        leadImage: url,
        attachments: [url],
      }),
    ];
    const rows = buildSpaceMemoryItemsFromDocuments(docs);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toContain('attachment');
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
    expect(rows[0].url).toBe('https://a/new.png');
    expect(rows[1].url).toBe('https://a/old.png');
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
    expect(filtered[0].context.documentTitle).toBe('Alpha plan');
  });
});

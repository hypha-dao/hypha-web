import { describe, expect, it } from 'vitest';
import { resolveInviteLeadImage } from '../resolve-invite-lead-image';

describe('resolveInviteLeadImage', () => {
  it('keeps an existing document lead image', () => {
    expect(
      resolveInviteLeadImage({
        leadImage: 'https://cdn.example/doc.jpg',
        label: 'Invite',
        spaceLeadImage: 'https://cdn.example/space.jpg',
      }),
    ).toBe('https://cdn.example/doc.jpg');
  });

  it('uses the space banner for Invite Member when document image is missing', () => {
    expect(
      resolveInviteLeadImage({
        leadImage: '',
        label: 'Invite',
        title: 'Invite Member',
        spaceLeadImage: 'https://cdn.example/space.jpg',
      }),
    ).toBe('https://cdn.example/space.jpg');
  });

  it('uses the space banner for Invite Space titles', () => {
    expect(
      resolveInviteLeadImage({
        title: 'Invite Space',
        spaceLeadImage: 'https://cdn.example/space.jpg',
      }),
    ).toBe('https://cdn.example/space.jpg');
  });

  it('uses the space banner for a Quest proposal without its own image', () => {
    expect(
      resolveInviteLeadImage({
        label: 'Quest',
        title: 'Ship the checklist',
        spaceLeadImage: 'https://cdn.example/space.jpg',
      }),
    ).toBe('https://cdn.example/space.jpg');
  });

  it('keeps a Quest proposal image when one is set', () => {
    expect(
      resolveInviteLeadImage({
        leadImage: 'https://cdn.example/quest.jpg',
        label: 'Quest',
        spaceLeadImage: 'https://cdn.example/space.jpg',
      }),
    ).toBe('https://cdn.example/quest.jpg');
  });

  it('uses the space banner for Contribution proposals without a document image', () => {
    expect(
      resolveInviteLeadImage({
        label: 'Contribution',
        title: 'Pay contributor',
        spaceLeadImage: 'https://cdn.example/space.jpg',
      }),
    ).toBe('https://cdn.example/space.jpg');
  });

  it('uses the space banner for any proposal type without a document image', () => {
    expect(
      resolveInviteLeadImage({
        label: 'Voting Method',
        title: 'Increase voting period',
        spaceLeadImage: 'https://cdn.example/space.jpg',
      }),
    ).toBe('https://cdn.example/space.jpg');
  });

  it('trims whitespace-only document images before falling back to the space banner', () => {
    expect(
      resolveInviteLeadImage({
        leadImage: '   ',
        label: 'Contribution',
        spaceLeadImage: 'https://cdn.example/space.jpg',
      }),
    ).toBe('https://cdn.example/space.jpg');
  });

  it('returns undefined when there is no space banner (caller keeps card fallback)', () => {
    expect(
      resolveInviteLeadImage({
        label: 'Contribution',
        title: 'Pay contributor',
        spaceLeadImage: '   ',
      }),
    ).toBeUndefined();
  });
});

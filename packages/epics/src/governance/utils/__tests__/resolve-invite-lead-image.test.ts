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

  it('does not override non-invite proposals', () => {
    expect(
      resolveInviteLeadImage({
        label: 'Contribution',
        title: 'Pay contributor',
        spaceLeadImage: 'https://cdn.example/space.jpg',
      }),
    ).toBeUndefined();
  });

  it('returns undefined when invite has no space banner (caller keeps card fallback)', () => {
    expect(
      resolveInviteLeadImage({
        label: 'Invite',
        title: 'Invite Member',
        spaceLeadImage: '   ',
      }),
    ).toBeUndefined();
  });
});

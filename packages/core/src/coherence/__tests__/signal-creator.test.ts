import { describe, expect, it } from 'vitest';
import {
  creatorIdForAuthenticatedCreate,
  omitCreatorId,
  resolveSignalCreatorDisplayName,
  resolveSignalFormCreatorId,
} from '../signal-creator';
import { schemaUpdateCoherenceSignalBySlug } from '../validation';

const GERARDO_ID = 8;
const ALEX_ID = 21;

describe('resolveSignalFormCreatorId', () => {
  it('keeps the stored creator on edit even when the viewer is the assignee', () => {
    expect(
      resolveSignalFormCreatorId({
        mode: 'edit',
        storedCreatorId: GERARDO_ID,
        viewerId: ALEX_ID,
      }),
    ).toBe(GERARDO_ID);
  });

  it('does not claim the viewer as creator on edit when the stored author is missing', () => {
    expect(
      resolveSignalFormCreatorId({
        mode: 'edit',
        storedCreatorId: null,
        viewerId: ALEX_ID,
      }),
    ).toBeNull();
  });

  it('attributes create to the signed-in viewer', () => {
    expect(
      resolveSignalFormCreatorId({
        mode: 'create',
        storedCreatorId: undefined,
        viewerId: GERARDO_ID,
      }),
    ).toBe(GERARDO_ID);
  });
});

describe('creatorIdForAuthenticatedCreate', () => {
  it('writes the actor and ignores a requested assignee id', () => {
    expect(creatorIdForAuthenticatedCreate(GERARDO_ID, ALEX_ID)).toBe(
      GERARDO_ID,
    );
  });
});

describe('omitCreatorId', () => {
  it('strips creatorId from an update payload', () => {
    expect(
      omitCreatorId({
        archived: true,
        creatorId: ALEX_ID,
        roomId: '!room:example.org',
      }),
    ).toEqual({ archived: true, roomId: '!room:example.org' });
  });
});

describe('resolveSignalCreatorDisplayName', () => {
  it('shows the real creator when the viewer is only an assignee', () => {
    expect(
      resolveSignalCreatorDisplayName({
        viewerPersonId: ALEX_ID,
        creatorId: GERARDO_ID,
        viewerName: 'Alex Prate',
        creatorName: 'Gerardo Roza',
      }),
    ).toBe('Gerardo Roza');
  });

  it('shows You only when the viewer is the stored creator', () => {
    expect(
      resolveSignalCreatorDisplayName({
        viewerPersonId: GERARDO_ID,
        creatorId: GERARDO_ID,
        viewerName: '',
        creatorName: 'Gerardo Roza',
      }),
    ).toBe('You');
  });
});

describe('schemaUpdateCoherenceSignalBySlug', () => {
  it('does not persist a client-supplied creatorId', () => {
    const parsed = schemaUpdateCoherenceSignalBySlug.parse({
      slug: 'coh-abc12345',
      type: 'Need',
      priority: 'medium',
      title: 'Signal cards should also open',
      description: 'Open details instead of only the room.',
      creatorId: ALEX_ID,
      assigneeIds: [ALEX_ID],
    });
    expect(parsed).not.toHaveProperty('creatorId');
    expect(parsed.assigneeIds).toEqual([ALEX_ID]);
  });
});

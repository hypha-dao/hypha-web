import { describe, expect, it } from 'vitest';
import {
  applySignalCreatorToChatAuthor,
  creatorIdForAuthenticatedCreate,
  isSignalDescriptionAnchorMessage,
  omitCreatorId,
  resolveSignalCreatorDisplayName,
  resolveSignalFormCreatorId,
} from '../signal-creator';
import {
  schemaCreateCoherenceForm,
  schemaEditCoherenceForm,
  schemaUpdateCoherenceSignalBySlug,
} from '../validation';

const GERARDO_ID = 8;
const ALEX_ID = 21;
const VLAD_ID = 15;
const GROK_TEST_ID = 99;

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

const editWithoutCreator = {
  type: 'Need' as const,
  priority: 'medium' as const,
  title: 'System signal',
  description: 'No recorded author.',
  spaceId: 1,
  archived: false,
};

describe('schemaEditCoherenceForm', () => {
  it('lets edit save when stored creatorId is missing', () => {
    const parsed = schemaEditCoherenceForm.parse({
      ...editWithoutCreator,
      creatorId: 0,
    });
    expect(parsed.creatorId).toBeNull();
  });

  it('lets edit save when stored creatorId is null', () => {
    const parsed = schemaEditCoherenceForm.parse({
      ...editWithoutCreator,
      creatorId: null,
    });
    expect(parsed.creatorId).toBeNull();
  });

  it('lets edit save when creatorId is omitted', () => {
    const parsed = schemaEditCoherenceForm.parse(editWithoutCreator);
    expect(parsed.creatorId).toBeNull();
  });

  it('keeps a persisted creatorId on edit', () => {
    const parsed = schemaEditCoherenceForm.parse({
      ...editWithoutCreator,
      creatorId: VLAD_ID,
    });
    expect(parsed.creatorId).toBe(VLAD_ID);
  });

  it('still requires a positive creatorId on create', () => {
    const result = schemaCreateCoherenceForm.safeParse({
      ...editWithoutCreator,
      creatorId: 0,
    });
    expect(result.success).toBe(false);
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

describe('edit-modal person', () => {
  it('uses stored creatorId, not the assignee viewer', () => {
    expect(
      resolveSignalFormCreatorId({
        mode: 'edit',
        storedCreatorId: VLAD_ID,
        viewerId: GROK_TEST_ID,
      }),
    ).toBe(VLAD_ID);
  });
});

describe('isSignalDescriptionAnchorMessage', () => {
  it('treats the first matching description as the creator attribution', () => {
    expect(
      isSignalDescriptionAnchorMessage({
        isFirstChatTextMessage: true,
        messageContent: 'throwaway creator after',
        signalDescription: 'throwaway creator after',
      }),
    ).toBe(true);
  });

  it('does not reattribute later chat', () => {
    expect(
      isSignalDescriptionAnchorMessage({
        isFirstChatTextMessage: false,
        messageContent: 'throwaway creator after',
        signalDescription: 'throwaway creator after',
      }),
    ).toBe(false);
  });
});

describe('applySignalCreatorToChatAuthor', () => {
  it('labels the description as the stored creator for an assignee viewer', () => {
    expect(
      applySignalCreatorToChatAuthor({
        isDescriptionAnchor: true,
        viewerPersonId: GROK_TEST_ID,
        creatorId: VLAD_ID,
        creatorName: 'Vlad Hramtsov',
        viewerName: 'Grok Test',
      }),
    ).toEqual({
      role: 'member',
      senderName: 'Vlad Hramtsov',
    });
  });

  it('leaves You in place when the viewer is the stored creator', () => {
    expect(
      applySignalCreatorToChatAuthor({
        isDescriptionAnchor: true,
        viewerPersonId: VLAD_ID,
        creatorId: VLAD_ID,
        creatorName: 'Vlad Hramtsov',
        viewerName: 'Vlad Hramtsov',
      }),
    ).toBeNull();
  });
});

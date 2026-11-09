// @vitest-environment jsdom

import { useAuthentication } from '@hypha-platform/authentication';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { mutate, SWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deleteQuestDraftRequest,
  SPACE_QUEST_DRAFTS_SWR_KEY,
  useMyQuestDrafts,
} from '../use-space-quests';

vi.mock('@hypha-platform/authentication', () => ({
  useAuthentication: () => ({
    getAccessToken: async () => 'token',
    user: { id: 'user-1' },
    isLoading: false,
  }),
}));

const drafts = [
  {
    id: 4,
    name: 'Alpha draft',
    updatedAt: '2026-11-09T21:00:00.000Z',
  },
  {
    id: 5,
    name: 'Beta draft',
    updatedAt: '2026-11-09T21:01:00.000Z',
  },
];

function resetDrafts() {
  drafts.splice(
    0,
    drafts.length,
    {
      id: 4,
      name: 'Alpha draft',
      updatedAt: '2026-11-09T21:00:00.000Z',
    },
    {
      id: 5,
      name: 'Beta draft',
      updatedAt: '2026-11-09T21:01:00.000Z',
    },
  );
}

function DraftChip() {
  const { drafts: mine, visible } = useMyQuestDrafts('sandbox');
  const { getAccessToken } = useAuthentication();
  return (
    <div>
      <span data-testid="draft-count">{visible ? mine.length : 'hidden'}</span>
      {mine.map((draft) => (
        <span key={draft.id} data-testid={`draft-${draft.id}`}>
          {draft.name}
        </span>
      ))}
      <button
        type="button"
        onClick={() =>
          void deleteQuestDraftRequest({
            spaceSlug: 'sandbox',
            draftId: 4,
            getAccessToken,
          })
        }
      >
        Delete alpha
      </button>
    </div>
  );
}

afterEach(async () => {
  cleanup();
  resetDrafts();
  await mutate(
    (key) => Array.isArray(key) && key[0] === SPACE_QUEST_DRAFTS_SWR_KEY,
    { drafts: [] },
    { revalidate: false },
  );
  vi.unstubAllGlobals();
});

describe('quest draft delete cache', () => {
  it('removes only the deleted draft and keeps the other', async () => {
    let getCount = 0;
    let releaseRefetch: () => void = () => undefined;
    const refetchGate = new Promise<void>((resolve) => {
      releaseRefetch = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (url.endsWith('/quests/drafts') && method === 'GET') {
          getCount += 1;
          if (getCount > 1) await refetchGate;
          return new Response(JSON.stringify({ drafts: drafts.slice() }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.endsWith('/quests/drafts/4') && method === 'DELETE') {
          const index = drafts.findIndex((draft) => draft.id === 4);
          if (index >= 0) drafts.splice(index, 1);
          return new Response(null, { status: 204 });
        }
        return new Response('not found', { status: 404 });
      }),
    );

    render(
      <SWRConfig value={{ dedupingInterval: 5000 }}>
        <DraftChip />
      </SWRConfig>,
    );

    expect(await screen.findByTestId('draft-4')).toBeTruthy();
    expect(screen.getByTestId('draft-5')).toBeTruthy();
    expect(screen.getByTestId('draft-count').textContent).toBe('2');

    fireEvent.click(screen.getByRole('button', { name: 'Delete alpha' }));

    await waitFor(() => {
      expect(screen.queryByTestId('draft-4')).toBeNull();
    });
    expect(screen.getByTestId('draft-count').textContent).toBe('1');
    expect(screen.getByTestId('draft-5').textContent).toBe('Beta draft');

    releaseRefetch();
    await waitFor(() => {
      expect(screen.getByTestId('draft-count').textContent).toBe('1');
    });
    expect(screen.queryByTestId('draft-4')).toBeNull();
    expect(screen.getByTestId('draft-5').textContent).toBe('Beta draft');
  });
});

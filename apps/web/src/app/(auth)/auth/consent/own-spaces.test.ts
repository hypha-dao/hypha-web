import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@hypha-platform/storage-postgres', () => ({ db: {} }));

const listSpaces = vi.fn();
vi.mock('@hypha-platform/core/server', () => ({
  resolveCaller: async () => ({ ok: true, caller: { kind: 'user' } }),
  listSpaces: (...args: unknown[]) => listSpaces(...args),
}));

import { loadPickerSpaces } from './own-spaces';

describe('loadPickerSpaces', () => {
  it('lists sub-spaces too', async () => {
    listSpaces.mockResolvedValue({
      ok: true,
      data: {
        items: [
          { id: 1, title: 'Hypha', parentId: null, logoUrl: 'https://x/a.png' },
          { id: 2, title: 'Hypha Platform', parentId: 1, logoUrl: null },
        ],
      },
    });
    const result = await loadPickerSpaces('did:privy:a');
    expect(listSpaces).toHaveBeenCalledWith(
      expect.objectContaining({ mine: true, parentOnly: false }),
      expect.anything(),
      expect.anything(),
    );
    expect(result).toEqual([
      { id: 1, title: 'Hypha', logoUrl: 'https://x/a.png' },
      { id: 2, title: 'Hypha Platform', logoUrl: null },
    ]);
  });

  it('gives null when the list cannot be read', async () => {
    listSpaces.mockResolvedValue({ ok: false });
    expect(await loadPickerSpaces('did:privy:a')).toBeNull();
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const actions = readFileSync(
  resolve(__dirname, '../server/actions.ts'),
  'utf8',
);

describe('ensurePublicChatRoomAction type bind', () => {
  it('requires the public alias to be a space-public room, not the member type', () => {
    expect(actions).toContain('requireRoomType: HYPHA_ROOM_TYPES.spacePublic');
    expect(actions).toContain('lookupRequiredRoomType(');
    expect(actions).toContain('actionForRequiredRoomTypeLookup(');
    expect(actions).toContain("if (reuse === 'abort')");
    expect(actions).toContain(
      '[MatrixBot] Could not confirm the type of the aliased shared room; leaving the alias unchanged:',
    );
    expect(actions).toContain(
      '[MatrixBot] Shared room alias is not the required room type; detaching:',
    );
    expect(actions).toContain(
      '[MatrixBot] Shared room alias is taken but its type could not be confirmed; leaving the alias unchanged:',
    );
  });
});

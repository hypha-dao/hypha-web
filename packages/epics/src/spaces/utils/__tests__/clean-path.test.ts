import { describe, expect, it } from 'vitest';
import { cleanPath, spaceSelectActivateActionPath } from '../cleanPath';

describe('spaceSelectActivateActionPath', () => {
  it('pins activate to the agreements aside from a quest URL', () => {
    expect(
      spaceSelectActivateActionPath('/en/dho/hypha/quests/onboarding-matcher'),
    ).toBe('/en/dho/hypha/agreements/select-activate-action');
  });

  it('keeps the agreements activate path on the agreements tab', () => {
    expect(
      spaceSelectActivateActionPath(
        '/en/dho/hypha/agreements/proposal/quest-onboarding',
      ),
    ).toBe('/en/dho/hypha/agreements/select-activate-action');
  });

  it('falls back to cleanPath when the URL is not a space route', () => {
    expect(spaceSelectActivateActionPath('/en/my-wallet')).toBe(
      `${cleanPath('/en/my-wallet')}/select-activate-action`,
    );
  });
});

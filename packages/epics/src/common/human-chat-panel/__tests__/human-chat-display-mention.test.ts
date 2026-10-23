import { describe, expect, it } from 'vitest';

import {
  formatComposerMentionToken,
  replaceDisplayNameMentionsWithMxids,
  replaceMxidsWithComposerMentionTokens,
} from '../human-chat-display-mention';

const MXID = '@prod_privy_did_privy_cmh0rv92y0040abc:matrix.hypha.earth';

describe('replaceMxidsWithComposerMentionTokens', () => {
  it('shows the display name in the composer and keeps a reversible token', () => {
    const labeled = replaceMxidsWithComposerMentionTokens(
      `Hi ${MXID} can you look`,
      new Map([[MXID, 'Alex Prate']]),
    );
    expect(labeled).toBe(
      `Hi ${formatComposerMentionToken('Alex Prate').trimEnd()} can you look`,
    );
    expect(labeled).not.toContain('prod_privy');
    expect(
      replaceDisplayNameMentionsWithMxids(
        labeled,
        new Map([['Alex Prate', MXID]]),
      ),
    ).toBe(`Hi ${MXID} can you look`);
  });

  it('leaves a mention id unchanged when no display name is known', () => {
    expect(replaceMxidsWithComposerMentionTokens(`Hi ${MXID}`, new Map())).toBe(
      `Hi ${MXID}`,
    );
  });
});

import { describe, expect, it } from 'vitest';

import {
  straightforwardHomeText,
  stripLeakedToolMarkup,
  trimDanglingHomeClause,
} from '../member-home-chat-text';

const stump =
  'You raised a signal, Alex, about being a new member of an energy community as an experiment. It sits in Hypha Energy, and it’s tied to the Regenerative Venture Builder. That’s the kind of thing the people there would be';

describe('stripLeakedToolMarkup', () => {
  it('drops a leaked tool call that started mid-sentence', () => {
    expect(
      stripLeakedToolMarkup(
        `${stump} <|DSML|invoke name="show_member_home_item">…`,
      ),
    ).toBe(stump);
  });
});

describe('trimDanglingHomeClause', () => {
  it('cuts back to the last finished sentence', () => {
    expect(trimDanglingHomeClause(stump)).toBe(
      'You raised a signal, Alex, about being a new member of an energy community as an experiment. It sits in Hypha Energy, and it’s tied to the Regenerative Venture Builder.',
    );
  });

  it('keeps a short reply with no end mark', () => {
    expect(trimDanglingHomeClause('On it')).toBe('On it');
  });
});

describe('straightforwardHomeText', () => {
  it('does not leave a mid-sentence stump after a finished turn', () => {
    const leaked = `${stump} <|DSML|invoke name="show_member_home_item"><parameter name="id">1</parameter></|DSML|>`;
    expect(straightforwardHomeText(leaked)).toBe(
      'You raised a signal, Alex, about being a new member of an energy community as an experiment. It sits in Hypha Energy, and it’s tied to the Regenerative Venture Builder.',
    );
  });

  it('keeps the arriving clause while the reply is still streaming', () => {
    expect(straightforwardHomeText(stump, { streaming: true })).toBe(stump);
  });
});

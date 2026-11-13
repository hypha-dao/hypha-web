import { describe, expect, it } from 'vitest';

import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  botMentionChipText,
  formatComposerMentionToken,
  questHelperMentionPill,
  replaceDisplayNameMentionsWithMxids,
  replaceMxidsWithComposerMentionTokens,
  replaceMxidsWithVisibleMentionLabels,
} from '../human-chat-display-mention';
import { renderTextWithMentions } from '../human-chat-panel-message-bubble';

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

  it('shows a display name in an edit/reply banner instead of the raw mxid', () => {
    expect(
      replaceMxidsWithVisibleMentionLabels(
        `Hi ${MXID} can you look`,
        new Map([[MXID, 'Alex Prate']]),
      ),
    ).toBe('Hi @Alex Prate can you look');
  });

  it('uses a roster fallback when the mention map misses the person', () => {
    expect(
      replaceMxidsWithVisibleMentionLabels(
        `Hi ${MXID} can you look`,
        new Map(),
        (id) => (id === MXID ? 'Gerardo Roza' : ''),
      ),
    ).toBe('Hi @Gerardo Roza can you look');
  });

  it('round-trips disambiguated tokens for shared display names', () => {
    const other = '@prod_privy_did_privy_other:matrix.hypha.earth';
    const labeled = replaceMxidsWithComposerMentionTokens(
      `Hi ${MXID} and ${other}`,
      new Map([
        [MXID, 'Alex Prate (prod_privy…0abc)'],
        [other, 'Alex Prate (prod_privy…ther)'],
      ]),
    );
    expect(
      replaceDisplayNameMentionsWithMxids(
        labeled,
        new Map([
          ['Alex Prate (prod_privy…0abc)', MXID],
          ['Alex Prate (prod_privy…ther)', other],
        ]),
      ),
    ).toBe(`Hi ${MXID} and ${other}`);
  });
});

describe('botMentionChipText', () => {
  it('keeps the generic AI Agents label on the mention chip', () => {
    expect(botMentionChipText('AI Agents')).toBe('@AI Agents');
    expect(botMentionChipText('@AI Agents')).toBe('@AI Agents');
    expect(botMentionChipText('  ')).toBe('@AI Agents');
  });
});

describe('quest helper mention chip', () => {
  it('keeps @Quest Helper as one chip', () => {
    const inserted = `${formatComposerMentionToken(
      'Quest Helper',
    )}what is the goal?`;
    const at = inserted.indexOf('@');
    expect(questHelperMentionPill(inserted, at)?.label).toBe('Quest Helper');
    const html = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        renderTextWithMentions(inserted, () => ''),
      ),
    );
    expect(html).toContain('@Quest Helper');
    expect(html.match(/mention-pill/g)).toHaveLength(1);
    expect(html).toContain('what is the goal?');
    expect(html).not.toMatch(/>@Quest</);
  });
});

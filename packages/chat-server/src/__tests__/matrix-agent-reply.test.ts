import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { mediaEventText, mentionAwaitingAgent } from '../matrix-agent-turn';

const agent = '@hypha_bot:matrix.test';

describe('mentionAwaitingAgent', () => {
  it('answers only the latest message, and only when it mentions the agent', () => {
    const turn = mentionAwaitingAgent(
      [
        {
          sender: '@alex:matrix.test',
          body: 'Hypha, what is the tension here?',
          mentionsAgent: true,
        },
        {
          sender: '@noor:matrix.test',
          body: 'The budget and the timeline disagree.',
          mentionsAgent: false,
        },
      ],
      agent,
    );
    expect(turn?.question).toContain('tension');
    expect(turn?.earlier).toContain('budget');
  });

  it('stays quiet when the latest message does not mention the agent', () => {
    expect(
      mentionAwaitingAgent(
        [
          {
            sender: '@alex:matrix.test',
            body: 'Let us keep going.',
            mentionsAgent: false,
          },
          {
            sender: '@noor:matrix.test',
            body: '@hypha_bot:matrix.test thoughts?',
            mentionsAgent: true,
          },
        ],
        agent,
      ),
    ).toBeNull();
  });

  it('stays quiet once the agent has already spoken last', () => {
    expect(
      mentionAwaitingAgent(
        [
          {
            sender: agent,
            body: 'The need is a clearer owner for the budget.',
            mentionsAgent: false,
          },
        ],
        agent,
      ),
    ).toBeNull();
  });

  it('keeps longer section discussions and names the agent by its own label', () => {
    const pasted = 'x'.repeat(3000);
    const turn = mentionAwaitingAgent(
      [
        {
          sender: '@alex:matrix.test',
          body: '@Aura Mission draft this from the text above',
          mentionsAgent: true,
        },
        {
          sender: agent,
          body: 'Draft saved to Mission.',
          mentionsAgent: false,
        },
        { sender: '@noor:matrix.test', body: pasted, mentionsAgent: false },
      ],
      agent,
      { earlierChars: 6000, agentLabel: 'Aura Mission' },
    );
    expect(turn?.earlier).toContain(pasted);
    expect(turn?.earlier).toContain('Aura Mission: Draft saved to Mission.');
  });
});

describe('mediaEventText', () => {
  it('lists an attached file the agent can read', () => {
    expect(
      mediaEventText({
        msgtype: 'm.file',
        body: 'plan.pdf',
        filename: 'plan.pdf',
        url: 'mxc://matrix.test/abc',
      }),
    ).toBe('Attached file: plan.pdf (mxc://matrix.test/abc)');
  });

  it('keeps the caption and every file in a bundle', () => {
    expect(
      mediaEventText({
        msgtype: 'm.file',
        body: '@Aura Mission draft from these',
        filename: 'a.pdf',
        url: 'mxc://matrix.test/a',
        'org.hypha.media_bundle': [
          { msgtype: 'm.image', filename: 'b.png', url: 'mxc://matrix.test/b' },
        ],
      }),
    ).toBe(
      [
        '@Aura Mission draft from these',
        'Attached file: a.pdf (mxc://matrix.test/a)',
        'Attached file: b.png (mxc://matrix.test/b)',
      ].join('\n'),
    );
  });
});

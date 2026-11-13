import { describe, expect, it } from 'vitest';
import {
  questHelperSessionKey,
  readQuestHelperSession,
  writeQuestHelperSession,
} from '../quest-helper-session';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe('quest helper session', () => {
  it('restores the discussion thread after a reload', () => {
    const storage = memoryStorage();
    const key = questHelperSessionKey('sandbox', 'onboarding');
    writeQuestHelperSession(storage, key, {
      messages: [
        {
          id: 'm1',
          role: 'member',
          text: 'This quest is already saved.',
          timestamp: new Date('2026-11-09T12:00:00.000Z'),
          senderName: 'Quest Helper',
        },
        {
          id: 'm2',
          role: 'user',
          text: 'Add "Terse test" to Scope In',
          timestamp: new Date('2026-11-09T12:01:00.000Z'),
          senderName: 'Ada',
        },
      ],
      pending: { step: 'scope', patch: { scopeIn: ['docs', 'Terse test'] } },
      step: 1,
    });
    const restored = readQuestHelperSession(storage, key);
    expect(restored?.messages.map((message) => message.text)).toEqual([
      'This quest is already saved.',
      'Add "Terse test" to Scope In',
    ]);
    expect(restored?.pending).toEqual({
      step: 'scope',
      patch: { scopeIn: ['docs', 'Terse test'] },
    });
    expect(restored?.step).toBe(1);
    expect(restored?.messages[1]?.timestamp.toISOString()).toBe(
      '2026-11-09T12:01:00.000Z',
    );
  });
});

import { describe, expect, it } from 'vitest';

import { selectModelScopeEvent } from '../use-scope';
import type { ConversationMessage } from '../types';

function scopeMessage(
  id: string,
  spaceSlug: unknown,
  state = 'output-available',
  ok = true,
): ConversationMessage {
  return {
    id,
    role: 'assistant',
    parts: [{ type: 'tool-set_scope', state, output: { ok, spaceSlug } }],
  };
}

describe('selectModelScopeEvent', () => {
  it('returns null when there is no set_scope part', () => {
    expect(
      selectModelScopeEvent([{ id: 'u1', role: 'user', parts: [] }]),
    ).toBeNull();
  });

  it('picks the latest completed set_scope, with its message index as order', () => {
    const messages: ConversationMessage[] = [
      { id: 'u1', role: 'user', parts: [] },
      scopeMessage('a1', 'alpha'),
      { id: 'u2', role: 'user', parts: [] },
      scopeMessage('a2', 'beta'),
    ];
    expect(selectModelScopeEvent(messages)).toEqual({ slug: 'beta', order: 3 });
  });

  it('ignores in-flight and failed calls', () => {
    expect(
      selectModelScopeEvent([scopeMessage('a1', 'alpha', 'input-available')]),
    ).toBeNull();
    expect(
      selectModelScopeEvent([
        scopeMessage('a1', 'alpha', 'output-available', false),
      ]),
    ).toBeNull();
  });

  it('ignores a blank slug', () => {
    expect(selectModelScopeEvent([scopeMessage('a1', '  ')])).toBeNull();
    expect(selectModelScopeEvent([scopeMessage('a1', 42)])).toBeNull();
  });
});

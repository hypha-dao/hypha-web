import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  CHAT_COMPOSER_ACTIONS_CLASS,
  CHAT_COMPOSER_FIELD_CLASS,
  CHAT_COMPOSER_INPUT_CLASS,
  CHAT_COMPOSER_INPUT_SHELL_CLASS,
  CHAT_COMPOSER_ROOT_CLASS,
} from '../composer-field';

const source = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../human-chat-panel-chat-bar.tsx',
  ),
  'utf8',
);

describe('chat composer field', () => {
  it('keeps a bordered field and a line above the tools', () => {
    expect(CHAT_COMPOSER_FIELD_CLASS.split(' ')).toEqual(
      expect.arrayContaining([
        'border',
        'border-border',
        'rounded-none',
        'bg-neutral-1',
      ]),
    );
    expect(CHAT_COMPOSER_FIELD_CLASS).not.toContain('focus-within:');
    expect(CHAT_COMPOSER_FIELD_CLASS).not.toContain('focus:');
    expect(CHAT_COMPOSER_FIELD_CLASS).not.toContain('ring');
    expect(CHAT_COMPOSER_FIELD_CLASS).not.toContain('bg-transparent');
    expect(CHAT_COMPOSER_FIELD_CLASS).not.toContain('rounded-lg');

    expect(CHAT_COMPOSER_INPUT_SHELL_CLASS).toContain('rounded-none');
    expect(CHAT_COMPOSER_INPUT_SHELL_CLASS).not.toContain('rounded-sm');

    expect(CHAT_COMPOSER_INPUT_CLASS.split(' ')).toEqual(
      expect.arrayContaining(['px-3', 'py-2.5']),
    );
    expect(CHAT_COMPOSER_ROOT_CLASS.split(' ')).toEqual(
      expect.arrayContaining(['px-3', 'pt-3']),
    );
    expect(CHAT_COMPOSER_ROOT_CLASS).not.toContain('pt-2');

    expect(CHAT_COMPOSER_ACTIONS_CLASS.split(' ')).toEqual(
      expect.arrayContaining(['border-t', 'border-border', 'px-2', 'py-2']),
    );
    expect(CHAT_COMPOSER_ACTIONS_CLASS).not.toContain('pt-0');
  });

  it('is the structure the shared chat bar renders', () => {
    expect(source).toContain('data-testid="chat-composer-field"');
    expect(source).toContain('CHAT_COMPOSER_ROOT_CLASS');
    expect(source).toContain('CHAT_COMPOSER_FIELD_CLASS');
    expect(source).toContain('CHAT_COMPOSER_INPUT_CLASS');
    expect(source).toContain('CHAT_COMPOSER_INPUT_SHELL_CLASS');
    expect(source).toContain('CHAT_COMPOSER_ACTIONS_CLASS');
    expect(source).not.toContain('px-3 pt-2');
    expect(source).not.toContain('px-2 pb-2.5 pt-0');
  });
});

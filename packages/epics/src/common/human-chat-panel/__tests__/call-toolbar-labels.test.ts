import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { callToolbarButtonMessageKeys } from '../call-toolbar-labels';

const here = dirname(fileURLToPath(import.meta.url));
const messagesDir = join(here, '../../../../../i18n/src/messages');
const locales = ['en', 'de', 'es', 'fr', 'pt', 'nl', 'no', 'mk'] as const;
const signalKeys = [
  'signalCallAudio',
  'signalCallVideo',
  'signalCallJoinWithAudio',
  'signalCallJoinWithVideo',
] as const;
const roomKeys = [
  'callAudio',
  'callVideo',
  'callJoinWithAudio',
  'callJoinWithVideo',
] as const;

describe('callToolbarButtonMessageKeys', () => {
  it('keeps the shared room labels for space, DM, and group chats', () => {
    expect(callToolbarButtonMessageKeys()).toEqual({
      audio: 'callAudio',
      video: 'callVideo',
    });
    expect(callToolbarButtonMessageKeys('room', false)).toEqual({
      audio: 'callAudio',
      video: 'callVideo',
    });
    expect(callToolbarButtonMessageKeys('room', true)).toEqual({
      audio: 'callJoinWithAudio',
      video: 'callJoinWithVideo',
    });
  });

  it('names a signal thread as a signal, including the join state', () => {
    expect(callToolbarButtonMessageKeys('signal', false)).toEqual({
      audio: 'signalCallAudio',
      video: 'signalCallVideo',
    });
    expect(callToolbarButtonMessageKeys('signal', true)).toEqual({
      audio: 'signalCallJoinWithAudio',
      video: 'signalCallJoinWithVideo',
    });
  });

  it('uses those signal strings in every locale without changing the room strings', () => {
    const panelSource = readFileSync(
      join(here, '../../human-right-panel.tsx'),
      'utf8',
    );
    expect(panelSource).toContain(
      "labelScope={signalCallThread ? 'signal' : 'room'}",
    );

    for (const locale of locales) {
      const messages = JSON.parse(
        readFileSync(join(messagesDir, `${locale}.json`), 'utf8'),
      ) as { HumanChatPanel: Record<string, string> };
      const panel = messages.HumanChatPanel;
      for (const key of signalKeys) {
        const value = panel[key] ?? '';
        expect(value, `${locale}.${key}`).toEqual(expect.any(String));
        expect(value.length).toBeGreaterThan(0);
        expect(value.toLowerCase()).not.toMatch(
          /space|espacio|espace|espaço|ruimte|rommet|простор/,
        );
      }
      expect(panel.callAudio).not.toBe(panel.signalCallAudio);
      expect(panel.callVideo).not.toBe(panel.signalCallVideo);
      for (const key of roomKeys) {
        expect((panel[key] ?? '').length).toBeGreaterThan(0);
      }
    }

    const english = JSON.parse(
      readFileSync(join(messagesDir, 'en.json'), 'utf8'),
    ) as { HumanChatPanel: Record<string, string> };
    expect(english.HumanChatPanel.callAudio).toBe(
      'Start voice call in this space',
    );
    expect(english.HumanChatPanel.callVideo).toBe(
      'Start video call in this space',
    );
    expect(english.HumanChatPanel.signalCallAudio).toBe(
      'Start voice call in this signal',
    );
    expect(english.HumanChatPanel.signalCallVideo).toBe(
      'Start video call in this signal',
    );
  });
});

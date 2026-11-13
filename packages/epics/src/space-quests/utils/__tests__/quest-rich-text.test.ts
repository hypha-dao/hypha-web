import { MarkdownManager } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it } from 'vitest';
import { applyPatchToQuestDraftState } from '../quest-draft-assistant';
import {
  parseQuestRichText,
  questRichTextPlain,
  storedQuestPlainField,
  storedQuestRichText,
} from '../quest-rich-text';

const editor = new MarkdownManager({ extensions: [StarterKit] });

function savedByEditor(typed: string): string {
  return editor.serialize(editor.parse(typed));
}

const PLAIN_CHARACTERS = ['[', ']', '*', '_', '`', '#', '>'] as const;

const RICH_TEXT_FIELDS = [
  'goal',
  'scopeIn',
  'scopeOut',
  'successCriteria',
  'milestoneDescription',
] as const;

describe('quest rich text round trip', () => {
  it('shows an already saved \\[QA\\] as [QA]', () => {
    expect(
      questRichTextPlain('Verify editing of an existing quest. \\[QA\\]'),
    ).toBe('Verify editing of an existing quest. [QA]');
  });

  it.each(RICH_TEXT_FIELDS)(
    'round-trips each plain character in %s',
    (field) => {
      for (const character of PLAIN_CHARACTERS) {
        const typed = `Verify editing of an existing quest. ${character}QA`;
        const saved = savedByEditor(typed);
        expect(questRichTextPlain(saved), `${field} ${character}`).toBe(typed);
        expect(questRichTextPlain(savedByEditor(`- ${typed}`))).toBe(typed);
      }
      const brackets = 'Verify editing of an existing quest. [QA]';
      expect(questRichTextPlain(savedByEditor(brackets)), field).toBe(brackets);
    },
  );

  it('keeps real formatting and literal asterisks apart', () => {
    const formatted = savedByEditor('**bold** and *italic* and [QA]');
    const block = parseQuestRichText(formatted)[0];
    expect(block?.type).toBe('p');
    if (block?.type !== 'p') return;
    expect(block.tokens).toEqual([
      { type: 'bold', value: 'bold' },
      { type: 'text', value: ' and ' },
      { type: 'italic', value: 'italic' },
      { type: 'text', value: ' and [QA]' },
    ]);
    expect(questRichTextPlain(formatted)).toBe('bold and italic and [QA]');
    expect(questRichTextPlain('\\*\\*not bold\\*\\*')).toBe('**not bold**');
    expect(parseQuestRichText('__under__')[0]).toMatchObject({
      type: 'p',
      tokens: [{ type: 'underline', value: 'under' }],
    });
    expect(parseQuestRichText('`code`')[0]).toMatchObject({
      type: 'p',
      tokens: [{ type: 'inlineCode', value: 'code' }],
    });
    expect(parseQuestRichText('# Title with [QA]')[0]).toMatchObject({
      type: 'heading',
      level: 1,
    });
    expect(questRichTextPlain('# Title with \\[QA\\]')).toBe('Title with [QA]');
    expect(questRichTextPlain('cost &gt; limit')).toBe('cost > limit');
    expect(questRichTextPlain('[label](https://example.com)')).toBe('label');
  });

  it.each([
    ['goal', 'Verify editing of an existing quest.'],
    ['scopeIn', 'Edit each section.'],
    ['scopeOut', 'Production rollout.'],
    ['successCriteria', 'Every edit persists and reverts cleanly.'],
    ['milestoneDescription', 'M1 edit check.'],
  ] as const)(
    'keeps %s stable from save through reopen and save',
    (_field, prefix) => {
      const typed = `${prefix} [QA] *x* _x_ # x`;
      const stored = storedQuestRichText(typed);
      const reopened = storedQuestRichText(stored);
      const shown = questRichTextPlain(stored);
      const shownAgain = questRichTextPlain(reopened);

      expect(reopened).toBe(stored);
      expect(shownAgain).toBe(shown);
      expect(shown).toBe(`${prefix} [QA] x x # x`);
      expect(shown).not.toContain('\\');
      expect(stored).not.toContain('_x_');
      expect(stored).toContain('*x* *x*');

      const block = parseQuestRichText(stored)[0];
      expect(block?.type).toBe('p');
      if (block?.type !== 'p') return;
      expect(block.tokens.filter((token) => token.type === 'italic')).toEqual([
        { type: 'italic', value: 'x' },
        { type: 'italic', value: 'x' },
      ]);
    },
  );

  it('leaves deliverable name and note as typed plain text', () => {
    const name = 'QA deliverable [QA] *x* _x_ # x';
    const note = 'note [QA] *x* _x_ # x';
    expect(storedQuestPlainField(name)).toBe(name);
    expect(storedQuestPlainField(storedQuestPlainField(name))).toBe(name);
    expect(storedQuestPlainField(note)).toBe(note);
    expect(storedQuestPlainField(storedQuestPlainField(note))).toBe(note);
    expect(storedQuestPlainField(name)).toContain('*x*');
    expect(storedQuestPlainField(note)).toContain('_x_');
  });

  it('does not escape helper update_quest_draft text', () => {
    const typed = 'Verify editing of an existing quest. [QA] * _ ` # >';
    const { next } = applyPatchToQuestDraftState({
      current: {
        name: '',
        goal: '',
        scopeIn: [],
        scopeOut: [],
        scopeInMarkdown: '',
        scopeOutMarkdown: '',
        successCriteria: '',
        rewards: [],
        milestones: [],
        leadName: 'Vlad Hramtsov (you)',
        selectedLeadPersonId: 56,
        members: [],
        targetDate: null,
      },
      patch: {
        goal: typed,
        scopeIn: [typed],
        scopeOut: [typed],
        successCriteriaBullets: [typed],
        milestones: [{ name: 'Check', description: typed }],
      },
      spaceMembers: [],
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(next.goal).toBe(typed);
    expect(next.scopeInMarkdown).toBe(`- ${typed}`);
    expect(next.scopeOutMarkdown).toBe(`- ${typed}`);
    expect(next.successCriteria).toBe(`- ${typed}`);
    expect(next.milestones[0]?.description).toBe(typed);
    expect(questRichTextPlain(next.goal)).toBe(typed);
    expect(questRichTextPlain(next.scopeInMarkdown)).toBe(typed);
    expect(questRichTextPlain(next.scopeOutMarkdown)).toBe(typed);
    expect(questRichTextPlain(next.successCriteria)).toBe(typed);
    expect(questRichTextPlain(next.milestones[0]?.description)).toBe(typed);
  });
});

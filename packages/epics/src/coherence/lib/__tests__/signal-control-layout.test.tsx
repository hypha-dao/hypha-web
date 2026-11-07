// @vitest-environment jsdom
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignalUpvoteCellChrome } from '../../components/signal-upvote-cell';
import { SignalTagPeopleField } from '../../components/signal-tag-people-field';
import type { UseMembers } from '../../../spaces/hooks/types';

const roster = vi.hoisted(() => ({
  persons: [
    { id: 1, name: 'Ada', surname: 'Lovelace', avatarUrl: null },
    { id: 2, name: 'Alan', surname: 'Turing', avatarUrl: null },
  ],
}));

vi.mock('@hypha-platform/core/client', () => ({
  useMatrix: () => ({ client: null }),
  useMatrixUserIdsByPersonIds: () => ({
    personIdToMatrixUserId: { 1: '@ada:example', 2: '@alan:example' },
  }),
  useSpaceBySlug: () => ({ space: undefined }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { name?: string }) => {
    const messages: Record<string, string> = {
      signalFormTagPeoplePlaceholder: 'Search space members…',
      signalFormTagPeopleEmpty: 'No matching members',
      unknownMember: 'Unknown member',
      signalFormTagPeopleRemove: `Remove ${values?.name ?? ''}`,
    };
    return messages[key] ?? key;
  },
}));

vi.mock('../../../spaces/hooks/use-space-members-and-delegates', () => ({
  useSpaceMembersAndDelegates: () => ({ persons: roster.persons }),
}));

vi.mock(
  '../../../common/human-chat-panel/human-chat-mention-candidate-row',
  () => ({
    HumanChatMentionCandidateRow: ({
      matrixFallbackLabel,
    }: {
      matrixFallbackLabel: string;
    }) => <span>{matrixFallbackLabel}</span>,
  }),
);

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../../../../');
/** Set to `1` to compile themed CSS and write screenshots. Chrome alone does not run it. */
const previewScreenshots = process.env.SIGNAL_PREVIEW_SCREENSHOTS === '1';
const chrome = [
  '/usr/local/bin/google-chrome',
  '/usr/bin/google-chrome',
  '/opt/google/chrome/chrome',
].find((path) => existsSync(path));

const samples = [
  {
    figure: '1.5M',
    exact: '1,500,000',
    pressed: true,
    label: 'Upvoted',
    title: 'Production',
  },
  {
    figure: '694.3K',
    exact: '694,300',
    pressed: true,
    label: 'Upvoted',
    title: 'Congo',
  },
  {
    figure: '561.7K',
    exact: '561,700',
    pressed: true,
    label: 'Upvoted',
    title: 'Video call',
  },
  {
    figure: '515.9K',
    exact: '515,900',
    pressed: false,
    label: 'Upvote',
    title: 'UK — Department',
  },
  {
    figure: '510.4K',
    exact: '510,400',
    pressed: false,
    label: 'Upvote',
    title: 'Monetise',
  },
  {
    figure: '694,3 mil',
    exact: '694.300',
    pressed: true,
    label: 'Upvoted',
    title: 'Spanish compact',
  },
  {
    figure: '694,3 илј.',
    exact: '694.300',
    pressed: false,
    label: 'Upvote',
    title: 'Macedonian compact',
  },
  {
    figure: '694.300',
    exact: '694.300',
    pressed: true,
    label: 'Upvoted',
    title: 'German grouping',
  },
  {
    figure: '1,234,567',
    exact: '1,234,567',
    pressed: false,
    label: 'Upvote',
    title: 'Member count',
  },
  {
    figure: '0',
    exact: '0',
    pressed: false,
    label: 'Upvote',
    title: 'No votes',
  },
] as const;

const useMembers = (() => ({
  persons: [],
  isLoading: false,
})) as unknown as UseMembers;

function UpvoteBoard() {
  return (
    <div
      className="flex flex-col gap-3 bg-background p-4"
      data-testid="upvote-board"
    >
      {samples.map((sample, index) => (
        <article
          key={sample.figure}
          className="craft-card-interactive flex items-start gap-4 p-4"
          data-upvote-sample={index}
          data-exact={sample.exact}
        >
          <SignalUpvoteCellChrome
            figure={sample.figure}
            exactLabel={sample.exact}
            label={sample.label}
            pressed={sample.pressed}
            aria-label={`Upvote · ${sample.exact}`}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3 className="m-0 truncate text-3 font-medium leading-snug text-foreground">
              {sample.title}
            </h3>
            <p className="m-0 truncate text-1 text-muted-foreground">
              {sample.pressed ? 'Voted' : 'Not voted'} · {sample.exact}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

function TagPeopleSlice() {
  return (
    <div
      className="flex flex-col gap-2 bg-background p-6"
      data-testid="tag-people-slice"
    >
      <span className="text-2 font-medium text-foreground">Tag people</span>
      <SignalTagPeopleField
        spaceSlug="demo"
        useMembers={useMembers}
        value={[]}
        onChange={() => undefined}
      />
      <p className="text-1 text-muted-foreground">
        Tagged members are mentioned in the signal chat and get notified.
      </p>
    </div>
  );
}

afterEach(() => {
  cleanup();
});

describe('signal upvote cell and tag field', () => {
  it('searches and selects members without a leading @ icon', () => {
    const onChange = vi.fn();
    const view = render(
      <SignalTagPeopleField
        spaceSlug="demo"
        useMembers={useMembers}
        value={[]}
        onChange={onChange}
      />,
    );
    const input = view.getByRole('combobox');
    expect(input.className).toContain('px-3');
    expect(input.className).not.toContain('pl-12');
    expect(input.parentElement?.querySelector('svg')).toBeNull();
    expect(input.getAttribute('placeholder')).toBe('Search space members…');

    fireEvent.focus(input);
    expect(view.getByText('Ada Lovelace')).toBeTruthy();
    fireEvent.change(input, { target: { value: '@ada' } });
    expect(view.getByText('Ada Lovelace')).toBeTruthy();
    expect(view.queryByText('Alan Turing')).toBeNull();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['@ada:example']);
  });

  it.skipIf(!previewScreenshots || !chrome)(
    'fits upvote figures and starts the tag field at the normal inset',
    async () => {
      const uiUtilsSrc = join(repoRoot, 'packages/ui-utils/src');
      const work = mkdtempSync(join(tmpdir(), 'hypha-signal-css-'));
      let css = '';
      try {
        symlinkSync(
          join(repoRoot, 'packages/ui-utils/node_modules'),
          join(work, 'node_modules'),
          'dir',
        );
        const entry = readFileSync(join(uiUtilsSrc, 'global.css'), 'utf8')
          .replace(
            /@import '\.\/([^']+)';/g,
            (_, relativePath: string) =>
              `@import '${join(uiUtilsSrc, relativePath)}';`,
          )
          .replace(
            "@source '../../../**/*.{ts,tsx}';",
            [
              'packages/epics/src/coherence/components/signal-upvote-cell.tsx',
              'packages/epics/src/coherence/components/signal-tag-people-field.tsx',
              'packages/epics/src/coherence/utils/signal-upvote-figure.ts',
              'packages/ui/src/input.tsx',
              'packages/epics/src/coherence/lib/__tests__/signal-control-layout.test.tsx',
            ]
              .map(
                (relativePath) => `@source '${join(repoRoot, relativePath)}';`,
              )
              .join('\n'),
          );
        const entryCss = join(work, 'entry.css');
        const outCss = join(work, 'out.css');
        writeFileSync(entryCss, entry);
        execFileSync(
          'pnpm',
          [
            '--filter',
            '@hypha-platform/ui-utils',
            'exec',
            'tailwindcss',
            '-i',
            entryCss,
            '-o',
            outCss,
          ],
          { cwd: repoRoot, stdio: 'pipe' },
        );
        css = readFileSync(outCss, 'utf8');
      } finally {
        rmSync(work, { recursive: true, force: true });
      }
      const markup = renderToStaticMarkup(
        <div>
          <UpvoteBoard />
          <TagPeopleSlice />
        </div>,
      );
      const html = `<!doctype html><html><head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600&display=swap">
        <style>:root{--font-body:"Manrope";}${css}</style>
        </head><body>${markup}</body></html>`;
      const { chromium } = await import('@playwright/test');
      const browser = await chromium.launch({
        executablePath: chrome,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      });
      try {
        const outDir =
          process.env.SIGNAL_PREVIEW_ARTIFACTS_DIR?.trim() ||
          join(tmpdir(), 'hypha-signal-preview');
        mkdirSync(outDir, { recursive: true });
        for (const [name, width] of [
          ['wide', 960],
          ['narrow', 360],
        ] as const) {
          const page = await browser.newPage({
            viewport: { width, height: 1400 },
          });
          await page.setContent(html, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          const fit = await page.evaluate(() => {
            const cards = [
              ...document.querySelectorAll('[data-upvote-sample]'),
            ];
            return cards.map((card) => {
              const cell = card.querySelector(
                '[data-testid="signal-upvote-cell"]',
              ) as HTMLElement;
              const figure = card.querySelector(
                '[data-testid="signal-upvote-figure"]',
              ) as HTMLElement;
              const caption = figure.nextElementSibling as HTMLElement;
              const range = document.createRange();
              const ink = (node: HTMLElement) => {
                range.selectNodeContents(node);
                const rect = range.getBoundingClientRect();
                return { left: rect.left, right: rect.right };
              };
              const cellBox = cell.getBoundingClientRect();
              const figureInk = ink(figure);
              const captionInk = ink(caption);
              const cellStyle = getComputedStyle(cell);
              return {
                sample: card.getAttribute('data-upvote-sample'),
                figure: figure.textContent,
                pressed: cell.getAttribute('aria-pressed'),
                title: cell.getAttribute('title'),
                exact: card.getAttribute('data-exact'),
                overflow: cellStyle.overflow,
                cellWidth: cellBox.width,
                figureInside:
                  figureInk.left >= cellBox.left - 0.5 &&
                  figureInk.right <= cellBox.right + 0.5,
                captionInside:
                  captionInk.left >= cellBox.left - 0.5 &&
                  captionInk.right <= cellBox.right + 0.5,
                figureWidth: figureInk.right - figureInk.left,
              };
            });
          });
          for (const row of fit) {
            expect(row.overflow, row.figure ?? '').not.toBe('hidden');
            expect(row.cellWidth, row.figure ?? '').toBeGreaterThanOrEqual(64);
            expect(row.cellWidth, row.figure ?? '').toBeLessThanOrEqual(66);
            expect(row.figureInside, `${row.figure} figure`).toBe(true);
            expect(row.captionInside, `${row.figure} caption`).toBe(true);
            expect(row.title, row.figure ?? '').toBe(row.exact);
          }
          const input = page.getByRole('combobox');
          const field = await input.evaluate((node) => {
            const style = getComputedStyle(node);
            const box = node.getBoundingClientRect();
            return {
              paddingLeft: style.paddingLeft,
              textIndent: style.textIndent,
              svgCount: node.parentElement?.querySelectorAll('svg').length ?? 0,
              placeholder: node.getAttribute('placeholder'),
              left: box.left,
            };
          });
          expect(field.paddingLeft).toBe('12px');
          expect(field.textIndent).toBe('0px');
          expect(field.svgCount).toBe(0);
          expect(field.placeholder).toBe('Search space members…');
          await page.screenshot({
            path: join(outDir, `signal-upvote-and-tag-${name}.png`),
            fullPage: true,
          });
          const board = page.getByTestId('upvote-board');
          await board.screenshot({
            path: join(outDir, `signal-upvote-figures-${name}.png`),
          });
          const tag = page.getByTestId('tag-people-slice');
          await tag.screenshot({
            path: join(outDir, `signal-tag-people-${name}.png`),
          });
          await page.close();
        }
      } finally {
        await browser.close();
      }
    },
    120_000,
  );
});

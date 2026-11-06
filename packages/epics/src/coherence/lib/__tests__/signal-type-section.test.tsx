// @vitest-environment jsdom
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, within } from '@testing-library/react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  COHERENCE_SIGNAL_TYPES,
  COHERENCE_TYPE_OPTIONS,
} from '../../../../../core/src/coherence/coherence-types';
import type { LucideReactIcon } from '@hypha-platform/ui';
import { signalTypeIcon } from '../../components/signal-type-icon';
import {
  SIGNAL_TYPE_SECTION_CLASS,
  SignalTypePickerGrid,
  SignalTypeSection,
  type SignalTypePickerOption,
} from '../../components/signal-type-section';

const here = dirname(fileURLToPath(import.meta.url));
const chromeCandidates = [
  '/usr/local/bin/google-chrome',
  '/usr/bin/google-chrome',
  '/opt/google/chrome/chrome',
];

function lucideClass(icon: string): string {
  return `lucide-${icon.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`;
}

function pickerOptions(): SignalTypePickerOption[] {
  return COHERENCE_TYPE_OPTIONS.filter((option) =>
    (COHERENCE_SIGNAL_TYPES as readonly string[]).includes(option.type),
  ).map((option) => ({
    icon: option.icon as LucideReactIcon,
    title: option.title,
    description: option.description,
    type: option.type,
    colorVariant: 'subtle',
  }));
}

function TypeModalSlice() {
  const options = pickerOptions();
  return createElement(
    'div',
    { 'data-testid': 'signal-type-modal-slice' },
    createElement(
      SignalTypeSection,
      null,
      createElement(
        'div',
        { className: 'flex w-full flex-col gap-3' },
        createElement('span', null, 'Type'),
        createElement(SignalTypePickerGrid, {
          options,
          selected: 'Bug',
          onSelect: () => undefined,
        }),
      ),
    ),
    createElement(
      'section',
      {
        className: 'flex flex-col gap-3 border-t border-border pt-8',
        'data-testid': 'signal-type-next',
      },
      createElement('span', null, 'Next section'),
    ),
    createElement(
      'ul',
      { 'data-testid': 'signal-type-icon-map' },
      COHERENCE_TYPE_OPTIONS.map((option) => {
        const Icon = signalTypeIcon(option.type);
        return createElement(
          'li',
          { key: option.type, 'data-signal-type': option.type },
          Icon
            ? createElement(Icon, {
                className: 'size-3.5',
                'aria-hidden': true,
              })
            : null,
          createElement('span', null, option.title),
        );
      }),
    ),
  );
}

const layoutCss = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #f6f6f4; color: #1c1c1c; font-family: system-ui, sans-serif; }
  .slice { width: 100%; background: #fff; }
  .flex { display: flex; }
  .flex-col { flex-direction: column; }
  .flex-row { flex-direction: row; }
  .w-full { width: 100%; }
  .grid { display: grid; }
  .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .gap-2 { gap: 0.5rem; }
  .gap-3 { gap: 0.75rem; }
  .gap-6 { gap: 1.5rem; }
  .items-start { align-items: flex-start; }
  .items-center { align-items: center; }
  .justify-center { justify-content: center; }
  .shrink-0 { flex-shrink: 0; }
  .min-w-0 { min-width: 0; }
  .h-8 { height: 2rem; }
  .w-8 { width: 2rem; }
  .p-3 { padding: 0.75rem; }
  .pt-8 { padding-top: 2rem; }
  .pb-8 { padding-bottom: 2rem; }
  .ml-auto { margin-left: auto; }
  .border, [class~="border"] { border: 1px solid #c8c8c8; }
  .border-t, [class~="border-t"] { border-top: 1px solid #222; }
  .text-2 { font-size: 0.875rem; }
  .text-1 { font-size: 0.75rem; color: #666; }
  .font-medium { font-weight: 500; }
  .size-3, .size-3\\.5 { width: 0.875rem; height: 0.875rem; }
  ul { display: flex; flex-wrap: wrap; gap: 0.75rem; list-style: none; margin: 1.5rem 0 0; padding: 0; }
  li { display: inline-flex; align-items: center; gap: 0.35rem; border: 1px solid #ddd; padding: 0.25rem 0.4rem; }
`;

describe('signal type section', () => {
  it('maps every supported type to an icon and ends the modal grid on Issue', () => {
    const formSource = readFileSync(
      join(here, '../../components/create-signal-form.tsx'),
      'utf8',
    );
    expect(formSource).toContain('<SignalTypeSection>');
    expect(formSource).toContain('<SignalTypePickerGrid');
    expect(SIGNAL_TYPE_SECTION_CLASS).toContain('pb-8');

    const view = render(createElement(TypeModalSlice));
    const grid = view.getByTestId('signal-type-grid');
    const options = within(grid).getAllByTestId(/signal-type-option-/);
    expect(
      options.map((node) => node.getAttribute('data-signal-type')),
    ).toEqual([...COHERENCE_SIGNAL_TYPES]);
    expect(options.at(-1)?.textContent).toContain('Issue');
    expect(options.at(-1)?.getAttribute('data-signal-type')).toBe('Bug');

    for (const option of COHERENCE_TYPE_OPTIONS) {
      const icon = signalTypeIcon(option.type);
      expect(icon, option.type).toBeTruthy();
      const row = view
        .getByTestId('signal-type-icon-map')
        .querySelector(`[data-signal-type="${option.type}"]`);
      expect(row?.querySelector('svg')?.getAttribute('class')).toContain(
        lucideClass(option.icon),
      );
      if ((COHERENCE_SIGNAL_TYPES as readonly string[]).includes(option.type)) {
        const card = view.getByTestId(`signal-type-option-${option.type}`);
        expect(card.querySelector('svg')?.getAttribute('class')).toContain(
          lucideClass(option.icon),
        );
      }
    }

    const section = view.getByTestId('signal-type-section');
    expect(section.className).toContain('pb-8');
    expect(view.getByTestId('signal-type-next').className).toContain(
      'border-t',
    );
    expect(
      grid.compareDocumentPosition(view.getByTestId('signal-type-next')),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  const chrome = chromeCandidates.find((path) => existsSync(path));

  it.skipIf(!chrome)(
    'keeps the Issue card clear of the next rule at wide and narrow widths',
    async () => {
      const { chromium } = await import('@playwright/test');
      const markup = renderToStaticMarkup(createElement(TypeModalSlice));
      const html = `<!doctype html><html><head><style>${layoutCss}</style></head><body><div class="slice">${markup}</div></body></html>`;
      const browser = await chromium.launch({
        executablePath: chrome,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      });
      try {
        const outDir = '/opt/cursor/artifacts';
        mkdirSync(outDir, { recursive: true });
        for (const [name, width] of [
          ['wide', 960],
          ['narrow', 360],
        ] as const) {
          const page = await browser.newPage({
            viewport: { width, height: 900 },
          });
          await page.setContent(html, { waitUntil: 'load' });
          const issue = page.getByTestId('signal-type-option-Bug');
          const next = page.getByTestId('signal-type-next');
          const issueBox = await issue.boundingBox();
          const nextBox = await next.boundingBox();
          expect(issueBox).not.toBeNull();
          expect(nextBox).not.toBeNull();
          const gap = nextBox!.y - (issueBox!.y + issueBox!.height);
          expect(gap).toBeGreaterThanOrEqual(28);
          expect(gap).toBeLessThan(56);
          expect(issueBox!.x).toBeLessThan(width / 2);
          await page.screenshot({
            path: join(outDir, `signal-type-section-${name}.png`),
            fullPage: true,
          });
          await page.close();
        }
      } finally {
        await browser.close();
      }
    },
  );
});

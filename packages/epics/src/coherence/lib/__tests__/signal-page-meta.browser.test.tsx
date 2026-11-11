import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../../../../');
const pageSource = readFileSync(
  join(here, '../../components/signal-page.tsx'),
  'utf8',
);

function exportedClass(name: string): string {
  const start = pageSource.indexOf(`export const ${name} =`);
  if (start < 0) throw new Error(`Missing ${name}`);
  const end = pageSource.indexOf(';', start);
  const parts = [...pageSource.slice(start, end).matchAll(/'([^']*)'/g)].map(
    (match) => match[1] ?? '',
  );
  if (parts.length === 0) throw new Error(`Missing ${name}`);
  return parts.join('');
}

const SIGNAL_PAGE_META_ROW_CLASS = exportedClass('SIGNAL_PAGE_META_ROW_CLASS');
const SIGNAL_PAGE_META_ITEM_CLASS = exportedClass(
  'SIGNAL_PAGE_META_ITEM_CLASS',
);
const chrome = [
  '/usr/local/bin/google-chrome',
  '/usr/bin/google-chrome',
  '/opt/google/chrome/chrome',
].find((path) => existsSync(path));

const LABEL =
  'text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground';

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className={SIGNAL_PAGE_META_ITEM_CLASS}>
      <dt className={`${LABEL} truncate`}>{label}</dt>
      <dd className="m-0 flex min-w-0 items-center gap-2 text-1 text-foreground">
        <span className="min-w-0 truncate">{value}</span>
      </dd>
    </div>
  );
}

function MetaCard() {
  return (
    <section
      className="craft-card @container w-full min-w-0 p-5"
      data-testid="card"
    >
      <dl className={SIGNAL_PAGE_META_ROW_CLASS} data-testid="signal-page-meta">
        <Meta label="Created by" value="Alexandria Rivera-Montgomery" />
        <Meta label="Created" value="4 hours ago" />
        <Meta label="Last reply" value="2 hours ago · Sam Lee" />
        <Meta label="Discussion" value="15 comments" />
        <div className="ml-auto flex max-w-full shrink-0 flex-col gap-1">
          <span className={`${LABEL} invisible`} aria-hidden>
            {'\u00a0'}
          </span>
          <button
            type="button"
            data-testid="signal-open-discussion"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-foreground underline-offset-2"
          >
            Open discussion
            <span aria-hidden>→</span>
          </button>
        </div>
      </dl>
    </section>
  );
}

describe('signal page meta row', () => {
  it.skipIf(!chrome)(
    'keeps the wide gap and stays inside the card from 320 to 1280',
    async () => {
      const uiUtilsSrc = join(repoRoot, 'packages/ui-utils/src');
      const work = mkdtempSync(join(tmpdir(), 'hypha-signal-meta-'));
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
              'packages/epics/src/coherence/components/signal-page.tsx',
              'packages/epics/src/coherence/lib/__tests__/signal-page-meta.browser.test.tsx',
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

      const html = `<!doctype html><html><head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;700&display=swap">
        <style>html,body{margin:0} :root{--font-body:"Manrope";}${css}</style>
        </head><body>${renderToStaticMarkup(<MetaCard />)}</body></html>`;
      const { chromium } = await import('@playwright/test');
      const browser = await chromium.launch({
        executablePath: chrome,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      });
      try {
        for (const width of [320, 390, 421, 520, 720, 1280]) {
          const page = await browser.newPage({
            viewport: { width, height: 800 },
          });
          await page.setContent(html, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          const box = await page.evaluate(() => {
            const card = document.querySelector(
              '[data-testid="card"]',
            ) as HTMLElement;
            const row = document.querySelector(
              '[data-testid="signal-page-meta"]',
            ) as HTMLElement;
            const link = document.querySelector(
              '[data-testid="signal-open-discussion"]',
            ) as HTMLElement;
            const cardBox = card.getBoundingClientRect();
            const linkBox = link.getBoundingClientRect();
            const linkRow = (
              link.parentElement as HTMLElement
            ).getBoundingClientRect();
            const items = [...row.children] as HTMLElement[];
            const first = items[0]!.getBoundingClientRect();
            const second = items[1]!.getBoundingClientRect();
            const discussion = items[3]!.getBoundingClientRect();
            const sameRow = Math.abs(first.top - linkRow.top) < 2;
            return {
              overflow: card.scrollWidth - card.clientWidth,
              linkInside:
                linkBox.left >= cardBox.left - 0.5 &&
                linkBox.right <= cardBox.right + 0.5 &&
                linkBox.width > 40,
              discussionInside: discussion.right <= cardBox.right + 0.5,
              childrenInside: items.every((item) => {
                const itemBox = item.getBoundingClientRect();
                return itemBox.right <= cardBox.right + 0.5;
              }),
              sameRow,
              gap: second.left - first.right,
            };
          });
          expect(box.overflow, `overflow at ${width}`).toBeLessThanOrEqual(1);
          expect(box.linkInside, `link at ${width}`).toBe(true);
          expect(box.discussionInside, `discussion at ${width}`).toBe(true);
          expect(box.childrenInside, `children at ${width}`).toBe(true);
          if (width === 1280) {
            expect(box.sameRow, '1280 row').toBe(true);
            expect(box.gap, '1280 gap').toBeGreaterThan(48);
            expect(box.gap, '1280 gap').toBeLessThan(58);
          }
          if (width === 720) {
            expect(box.sameRow, '720 row').toBe(true);
            expect(box.gap, '720 gap').toBeGreaterThan(20);
            expect(box.gap, '720 gap').toBeLessThan(40);
          }
          if (width === 421) {
            expect(box.sameRow, '421 wraps before it clips').toBe(false);
          }
          await page.close();
        }
      } finally {
        await browser.close();
      }
    },
    60000,
  );
});

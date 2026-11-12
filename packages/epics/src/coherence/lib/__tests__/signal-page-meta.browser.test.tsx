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
const SIGNAL_PAGE_CARD_CLASS = exportedClass('SIGNAL_PAGE_CARD_CLASS');
const SIGNAL_PAGE_CARD_BODY_CLASS = exportedClass(
  'SIGNAL_PAGE_CARD_BODY_CLASS',
);
const feedRowSource = readFileSync(
  join(here, '../../components/signal-feed-row.tsx'),
  'utf8',
);

function classAfter(source: string, marker: string): string {
  const at = source.indexOf(marker);
  if (at < 0) throw new Error(`Missing ${marker}`);
  const match = source.slice(at, at + 600).match(/className="([^"]+)"/);
  if (!match?.[1]) throw new Error(`Missing class after ${marker}`);
  return match[1];
}

const LIST_ARTICLE_CLASS = classAfter(
  feedRowSource,
  'data-testid="signal-card"',
);
const LIST_COLUMN_CLASS = classAfter(feedRowSource, LIST_ARTICLE_CLASS);
const LIST_DESC_CLASS = classAfter(feedRowSource, '{about ?');
const LIST_META_CLASS = classAfter(
  feedRowSource,
  'data-testid="signal-card-meta"',
);
const chrome = [
  '/usr/local/bin/google-chrome',
  '/usr/bin/google-chrome',
  '/opt/google/chrome/chrome',
].find((path) => existsSync(path));

const LABEL =
  'text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground';

function Meta({
  label,
  value,
  avatar = false,
}: {
  label: string;
  value: string;
  avatar?: boolean;
}) {
  return (
    <div className={SIGNAL_PAGE_META_ITEM_CLASS}>
      <dt className={LABEL}>{label}</dt>
      <dd className="m-0 flex max-w-full flex-wrap items-center gap-2 break-words text-1 text-foreground">
        {avatar ? (
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 24,
              height: 24,
              flex: 'none',
            }}
          />
        ) : null}
        <span className="break-words">{value}</span>
      </dd>
    </div>
  );
}

function DetailAndList({ pad }: { pad: number }) {
  return (
    <div id="shell" style={{ display: 'flex', width: '100vw' }}>
      <div id="left" style={{ flex: 'none' }} />
      <div
        id="col"
        style={{
          minWidth: 0,
          flex: '1 1 auto',
          boxSizing: 'border-box',
          padding: `0 ${pad}px`,
        }}
      >
        <section className={SIGNAL_PAGE_CARD_CLASS} data-testid="card">
          <div className={SIGNAL_PAGE_CARD_BODY_CLASS}>
            <dl
              className={SIGNAL_PAGE_META_ROW_CLASS}
              data-testid="signal-page-meta"
            >
              <Meta label="Created by" value="Vlad Hramtsov" avatar />
              <Meta label="Created" value="2 weeks ago" />
              <Meta label="Last reply" value="2 weeks ago · Grok Tester" />
              <Meta label="Discussion" value="15 comments · 4 people" />
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
          </div>
        </section>
        <article className={LIST_ARTICLE_CLASS} data-testid="signal-card">
          <div className={LIST_COLUMN_CLASS}>
            <h3
              className="m-0 truncate text-3 font-medium leading-snug text-foreground"
              data-testid="title"
            >
              A signal title that is fairly long
            </h3>
            <p className={LIST_DESC_CLASS} data-testid="desc">
              A one line description of the signal that sits under the title.
            </p>
            <div className={LIST_META_CLASS} data-testid="signal-card-meta">
              <span>12</span>
              <span>4 hours ago</span>
              <span>2 hours ago</span>
              <span>15 comments</span>
            </div>
          </div>
        </article>
      </div>
      <div id="right" style={{ flex: 'none' }} />
    </div>
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
              'packages/epics/src/coherence/components/signal-feed-row.tsx',
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

      const htmlFor = (pad: number) => `<!doctype html><html><head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;700&display=swap">
        <style>html,body{margin:0} :root{--font-body:"Manrope";}${css}</style>
        </head><body>${renderToStaticMarkup(
          <DetailAndList pad={pad} />,
        )}</body></html>`;
      const { chromium } = await import('@playwright/test');
      const browser = await chromium.launch({
        executablePath: chrome,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      });
      try {
        const layouts: Array<{
          name: string;
          width: number;
          left: number;
          right: number;
          pad: number;
          sameRow: boolean;
          gapMin: number;
          gapMax: number;
          matchList: boolean;
        }> = [
          {
            name: '320',
            width: 320,
            left: 0,
            right: 0,
            pad: 0,
            sameRow: false,
            gapMin: 24,
            gapMax: 24.5,
            matchList: true,
          },
          {
            name: '390',
            width: 390,
            left: 0,
            right: 0,
            pad: 16,
            sameRow: false,
            gapMin: 24,
            gapMax: 24.5,
            matchList: true,
          },
          {
            name: '421',
            width: 421,
            left: 0,
            right: 0,
            pad: 16,
            sameRow: false,
            gapMin: 24,
            gapMax: 26,
            matchList: true,
          },
          {
            name: '520',
            width: 520,
            left: 0,
            right: 0,
            pad: 0,
            sameRow: false,
            gapMin: 24,
            gapMax: 32,
            matchList: true,
          },
          {
            name: '720',
            width: 720,
            left: 0,
            right: 0,
            pad: 24,
            sameRow: false,
            gapMin: 36,
            gapMax: 42,
            matchList: true,
          },
          {
            name: '900',
            width: 900,
            left: 0,
            right: 0,
            pad: 24,
            sameRow: true,
            gapMin: 50,
            gapMax: 58,
            matchList: true,
          },
          {
            name: '1024',
            width: 1024,
            left: 0,
            right: 0,
            pad: 24,
            sameRow: true,
            gapMin: 58,
            gapMax: 66,
            matchList: true,
          },
          {
            name: '1280',
            width: 1280,
            left: 0,
            right: 0,
            pad: 24,
            sameRow: true,
            gapMin: 70,
            gapMax: 82,
            matchList: true,
          },
          // Icon rail + chat panel. This is the width where the list card's
          // content box crosses 720px and the old p-5 detail card did not.
          {
            name: '1200-chat',
            width: 1200,
            left: 72,
            right: 320,
            pad: 24,
            sameRow: false,
            gapMin: 64,
            gapMax: 78,
            matchList: true,
          },
          {
            name: '1440-chat',
            width: 1440,
            left: 72,
            right: 320,
            pad: 24,
            sameRow: true,
            gapMin: 78,
            gapMax: 80.5,
            matchList: true,
          },
          {
            name: '1440-both',
            width: 1440,
            left: 320,
            right: 320,
            pad: 24,
            sameRow: false,
            gapMin: 40,
            gapMax: 50,
            matchList: true,
          },
        ];
        for (const layout of layouts) {
          const page = await browser.newPage({
            viewport: { width: layout.width, height: 800 },
          });
          await page.setContent(htmlFor(layout.pad), {
            waitUntil: 'networkidle',
          });
          await page.evaluate(() => document.fonts.ready);
          await page.evaluate(({ left, right }) => {
            (
              document.getElementById('left') as HTMLElement
            ).style.width = `${left}px`;
            (
              document.getElementById('right') as HTMLElement
            ).style.width = `${right}px`;
          }, layout);
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
            const meta = document.querySelector(
              '[data-testid="signal-card-meta"]',
            ) as HTMLElement;
            const title = document.querySelector(
              '[data-testid="title"]',
            ) as HTMLElement;
            const desc = document.querySelector(
              '[data-testid="desc"]',
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
            const metaItems = [...meta.children] as HTMLElement[];
            const metaGap =
              metaItems[1]!.getBoundingClientRect().left -
              metaItems[0]!.getBoundingClientRect().right;
            const columnGap = parseFloat(getComputedStyle(row).columnGap);
            const listColumnGap = parseFloat(getComputedStyle(meta).columnGap);
            const texts = [
              ...row.querySelectorAll('dt, dd span, button'),
            ] as HTMLElement[];
            const clipped = texts
              .filter((el) => el.scrollWidth > el.clientWidth + 1)
              .map((el) => el.textContent ?? '');
            const rowBox = row.getBoundingClientRect();
            let sameLineGap: number | null = null;
            for (let index = 1; index < items.length; index += 1) {
              const previous = items[index - 1]!.getBoundingClientRect();
              const current = items[index]!.getBoundingClientRect();
              if (Math.abs(previous.top - current.top) < 2) {
                sameLineGap = current.left - previous.right;
                break;
              }
            }
            const body = card.firstElementChild as HTMLElement;
            const inset =
              parseFloat(getComputedStyle(card).paddingLeft) +
              parseFloat(getComputedStyle(body).paddingLeft);
            const titleBox = title.getBoundingClientRect();
            const descBox = desc.getBoundingClientRect();
            const metaBox = meta.getBoundingClientRect();
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
              sameRow: Math.abs(first.top - linkRow.top) < 2,
              gap: second.left - first.right,
              sameLineGap,
              clipped,
              linkRight: rowBox.right - linkBox.right,
              columnGap,
              listGap: metaGap,
              listColumnGap,
              inset,
              titleToDesc: descBox.top - titleBox.bottom,
              descToMeta: metaBox.top - descBox.bottom,
            };
          });
          expect(
            box.overflow,
            `overflow at ${layout.name}`,
          ).toBeLessThanOrEqual(1);
          expect(box.linkInside, `link at ${layout.name}`).toBe(true);
          expect(box.discussionInside, `discussion at ${layout.name}`).toBe(
            true,
          );
          expect(box.childrenInside, `children at ${layout.name}`).toBe(true);
          expect(box.clipped, `clipped at ${layout.name}`).toEqual([]);
          expect(
            box.linkRight,
            `open discussion at ${layout.name}`,
          ).toBeLessThan(2);
          expect(
            box.linkRight,
            `open discussion at ${layout.name}`,
          ).toBeGreaterThan(-1);
          expect(box.sameRow, `${layout.name} row`).toBe(layout.sameRow);
          if (box.sameLineGap != null) {
            expect(
              Math.abs(box.sameLineGap - box.columnGap),
              `${layout.name} painted gap`,
            ).toBeLessThan(1);
          }
          expect(box.columnGap, `${layout.name} gap`).toBeGreaterThanOrEqual(
            layout.gapMin,
          );
          expect(box.columnGap, `${layout.name} gap`).toBeLessThanOrEqual(
            layout.gapMax,
          );
          expect(box.inset, `${layout.name} inset`).toBe(24);
          if (layout.matchList) {
            expect(
              Math.abs(box.columnGap - box.listColumnGap),
              `${layout.name} matches list`,
            ).toBeLessThan(1);
          }
          if (layout.sameRow) {
            expect(
              Math.abs(box.gap - box.columnGap),
              `${layout.name} painted gap`,
            ).toBeLessThan(1);
            expect(
              Math.abs(box.gap - box.listGap),
              `${layout.name} painted list gap`,
            ).toBeLessThan(1);
          }
          if (layout.name === '1280') {
            expect(box.titleToDesc, 'title to description').toBeGreaterThan(10);
            expect(box.titleToDesc, 'title to description').toBeLessThan(14);
            expect(box.descToMeta, 'description to vote row').toBeGreaterThan(
              14,
            );
            expect(box.descToMeta, 'description to vote row').toBeLessThan(18);
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

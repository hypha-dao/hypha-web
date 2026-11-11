import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const chrome = [
  '/usr/bin/google-chrome',
  '/usr/local/bin/google-chrome',
  '/opt/google/chrome/chrome',
].find((path) => existsSync(path));
const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../../',
);
const esbuild = join(repoRoot, 'node_modules/.bin/esbuild');

describe('token vote allocation in a browser', () => {
  it.skipIf(!chrome || !existsSync(esbuild))(
    'opens the slider inside the viewport and confirms the allocation',
    async () => {
      const dir = join(tmpdir(), `hypha-vote-click-${process.pid}`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'mock-client.ts'),
        `
          export function applyPendingSignalUpvotes() {}
          export function resolveSignalVoteAction(current, clicked) {
            return current === clicked ? 'remove' : clicked;
          }
          export function signalUpvoteCellMeasure() {
            return { kind: 'count', count: 4 };
          }
          export function useCoherenceUpvoteMutations() {
            return {
              upvote: async (input) => {
                window.__vote = input;
                return {
                  totalVotingPower: '2', upvoteCount: 1, downvoteCount: 0,
                  upVotingPower: '2', downVotingPower: '0', netVoteCount: 1,
                  tokenDecimals: 0, voters: [],
                  myUpvote: { votingPower: '2', maxVotingPower: '4', direction: 'up' },
                };
              },
              removeUpvote: async () => null,
              isUpvoting: false,
              isRemovingUpvote: false,
            };
          }
          export function useJwt() { return { jwt: 'token' }; }
          export function useMatrix() { return { client: null }; }
          export function useMatrixUserIdsByPersonIds() {
            return { personIdToMatrixUserId: {} };
          }
        `,
      );
      writeFileSync(
        join(dir, 'mock-intl.tsx'),
        `
          export function useLocale() { return 'en'; }
          export function useTranslations() { return (key) => key; }
          export function useFormatter() { return { number: (value) => String(value) }; }
        `,
      );
      writeFileSync(
        join(dir, 'mock-nav.ts'),
        `export function useParams() { return { id: 'myspace' }; }`,
      );
      writeFileSync(
        join(dir, 'mock-ui.ts'),
        `
          import type React from 'react';
          export function Avatar(props: { children?: React.ReactNode }) { return props.children ?? null; }
          export const AvatarImage = Avatar;
          export const AvatarFallback = Avatar;
          export function Skeleton() { return null; }
          export { Button } from '${join(
            repoRoot,
            'packages/ui/src/button.tsx',
          )}';
          export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '${join(
            repoRoot,
            'packages/ui/src/popover.tsx',
          )}';
          export { Separator } from '${join(
            repoRoot,
            'packages/ui/src/separator.tsx',
          )}';
          export { Slider } from '${join(
            repoRoot,
            'packages/ui/src/slider.tsx',
          )}';
        `,
      );
      writeFileSync(
        join(dir, 'entry.tsx'),
        `
          import React from 'react';
          import { createRoot } from 'react-dom/client';
          import { SignalUpvoteButton } from '${join(
            repoRoot,
            'packages/epics/src/coherence/components/signal-upvote-button.tsx',
          )}';
          const summary = {
            totalVotingPower: '4', upvoteCount: 1, downvoteCount: 0,
            upVotingPower: '4', downVotingPower: '0', netVoteCount: 1,
            tokenDecimals: 0, voters: [], myUpvote: null,
          };
          createRoot(document.getElementById('root')).render(
            <div style={{ padding: 48 }}>
              <SignalUpvoteButton slug="signal" spaceSlug="myspace" votingMode="token" upvotes={summary} />
            </div>,
          );
        `,
      );
      writeFileSync(
        join(dir, 'index.html'),
        `<!doctype html><html><body><div id="root"></div><script type="module" src="./bundle.js"></script></body></html>`,
      );
      const react = join(
        repoRoot,
        'node_modules/.pnpm/react@19.1.2/node_modules/react',
      );
      const dom = join(
        repoRoot,
        'node_modules/.pnpm/react-dom@19.1.2_react@19.1.2/node_modules/react-dom',
      );
      execFileSync(
        esbuild,
        [
          join(dir, 'entry.tsx'),
          '--bundle',
          `--outfile=${join(dir, 'bundle.js')}`,
          '--format=esm',
          '--jsx=automatic',
          `--alias:react=${join(react, 'index.js')}`,
          `--alias:react/jsx-runtime=${join(react, 'jsx-runtime.js')}`,
          `--alias:react-dom=${join(dom, 'index.js')}`,
          `--alias:react-dom/client=${join(dom, 'client.js')}`,
          `--alias:@hypha-platform/core/client=${join(dir, 'mock-client.ts')}`,
          `--alias:next-intl=${join(dir, 'mock-intl.tsx')}`,
          `--alias:next/navigation=${join(dir, 'mock-nav.ts')}`,
          `--alias:@hypha-platform/ui=${join(dir, 'mock-ui.ts')}`,
          `--alias:@hypha-platform/ui-utils=${join(
            repoRoot,
            'packages/ui-utils/src/index.ts',
          )}`,
        ],
        { stdio: 'pipe' },
      );

      const server = createServer(async (request, response) => {
        const { readFile } = await import('node:fs/promises');
        const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
        const file = join(dir, path === '/' ? 'index.html' : path);
        try {
          const body = await readFile(file);
          response.setHeader(
            'content-type',
            file.endsWith('.js') ? 'text/javascript' : 'text/html',
          );
          response.end(body);
        } catch {
          response.statusCode = 404;
          response.end();
        }
      });
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      );
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      const { chromium } = await import('@playwright/test');
      const browser = await chromium.launch({
        executablePath: chrome,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      });
      try {
        const page = await browser.newPage({
          viewport: { width: 390, height: 800 },
        });
        await page.goto(`http://127.0.0.1:${port}/`, {
          waitUntil: 'networkidle',
        });
        await page.getByTestId('signal-vote-up').click();
        const panel = page.getByTestId('signal-vote-allocation');
        await panel.waitFor({ state: 'visible' });
        const box = await panel.boundingBox();
        expect(box).toBeTruthy();
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.y + box!.height).toBeLessThanOrEqual(800);
        await page.getByTestId('signal-vote-confirm').click();
        await page.waitForFunction(() => window.__vote != null);
        const vote = await page.evaluate(() => window.__vote);
        expect(vote).toEqual({
          slug: 'signal',
          direction: 'up',
          votingPowerPercent: 100,
        });
      } finally {
        await browser.close();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
    60_000,
  );
});

declare global {
  interface Window {
    __vote?: { slug: string; direction: string; votingPowerPercent: number };
  }
}

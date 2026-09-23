/**
 * Runs once per server instance at startup (Next.js instrumentation hook). Wires
 * `@hypha-platform/notifications`' dispatch into `@hypha-platform/core`'s signal-assigned
 * notifier slot (#2470) — `core` can't depend on `notifications` directly (it would create a
 * package cycle, since `notifications` depends on `core`), so `apps/web`, which already depends
 * on both with no cycle, does the wiring here instead.
 *
 * The actual wiring lives in `./instrumentation-node.ts`, imported only under the Node.js
 * runtime — Next.js also bundles this file for the edge runtime, and inlining the wiring here
 * pulls `pg` (via `@hypha-platform/core/server` -> `energy/server`) into that edge bundle, which
 * has no `fs`/`path`/`stream`. A separate file is what Next's docs say is needed for this branch
 * to actually be tree-shaken out of the edge build.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { register: registerNode } = await import('./instrumentation-node');
    await registerNode();
  }
}

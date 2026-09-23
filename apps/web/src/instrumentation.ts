/**
 * Runs once per server instance at startup (Next.js instrumentation hook). Wires
 * `@hypha-platform/notifications`' dispatch into `@hypha-platform/core`'s signal-assigned
 * notifier slot (#2470) — `core` can't depend on `notifications` directly (it would create a
 * package cycle, since `notifications` depends on `core`), so `apps/web`, which already depends
 * on both with no cycle, does the wiring here instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const [
    { setSignalAssignedNotifier },
    { dispatch, buildSignalAssignedEvent },
  ] = await Promise.all([
    import('@hypha-platform/core/server'),
    import('@hypha-platform/notifications/server'),
  ]);

  setSignalAssignedNotifier(async (input) => {
    await dispatch(buildSignalAssignedEvent(input));
  });
}

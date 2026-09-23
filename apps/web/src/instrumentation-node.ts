/**
 * Node-only half of `instrumentation.ts`, split into its own module so the edge-runtime build of
 * `instrumentation.ts` never has to bundle this (or the `pg`/Node-builtin-dependent modules it
 * pulls in via `@hypha-platform/core/server`) — see `instrumentation.ts` for why this exists.
 */
export async function register() {
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

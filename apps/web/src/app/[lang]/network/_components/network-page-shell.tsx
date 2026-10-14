/**
 * One horizontal box for the network route, including its loading state.
 * A second shell (a centered max-width container, then this full-width
 * column) lets the heading paint on the left and slide to the middle.
 */
export function NetworkPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-var(--menu-top-height,4.5rem))] w-full min-w-0 flex-col px-4 py-9 sm:px-5">
      <div className="flex w-full min-w-0 flex-col gap-9">{children}</div>
    </div>
  );
}

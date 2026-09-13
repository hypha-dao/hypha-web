export const metadata = {
  title: 'Hypha | Coherent',
  description: 'Talk-first entrypoint to the organization',
};

/**
 * #2486 talk-first Coherent entrypoint. Standalone route — hypha-web providers
 * are inherited from the root layout; no parallel (`@tab`/`@aside`) routes.
 * The interaction bar replaces the app navbar via a pathname branch in
 * `ConnectedMenuTop` (spec §2.2), so this layout stays minimal.
 */
export default function CoherentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex w-full flex-col">{children}</div>;
}

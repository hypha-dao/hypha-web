/** One inset for the reciprocal exchange section. */
export function NetworkSectionShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col px-3 pt-2 pb-3 sm:px-4 sm:pt-3 sm:pb-4 lg:px-5 lg:pt-3 lg:pb-5">
      {children}
    </div>
  );
}

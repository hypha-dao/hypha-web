/** Same inset as needs, proof of action, proof of impact, and exchange. */
export function NetworkPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full min-w-0 flex-col px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5">
      {children}
    </div>
  );
}

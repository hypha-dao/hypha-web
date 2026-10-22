/** Shown as soon as an action is chosen, while that screen's data loads. */
export default function WalletActionLoading() {
  return (
    <div className="w-full min-w-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6 xl:gap-9 xl:px-9 xl:py-9">
        <div className="h-8 w-48 bg-neutral-3" />
        <div className="h-40 w-full bg-neutral-3" />
      </div>
    </div>
  );
}

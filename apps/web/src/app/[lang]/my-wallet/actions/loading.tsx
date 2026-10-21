import { Container } from '@hypha-platform/ui';

/** Shown as soon as an action is chosen, while that screen's data loads. */
export default function WalletActionLoading() {
  return (
    <div className="w-full min-w-0 overflow-y-auto">
      <Container className="flex max-w-2xl flex-col gap-5 py-6">
        <div className="h-8 w-48 bg-neutral-3" />
        <div className="h-40 w-full bg-neutral-3" />
      </Container>
    </div>
  );
}

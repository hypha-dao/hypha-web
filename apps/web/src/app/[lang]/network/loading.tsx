import { Container } from '@hypha-platform/ui';

import { NetworkIndexFallback } from './_components/network-index-fallback';

export default function NetworkLoading() {
  return (
    <div className="w-full min-w-0">
      <Container className="flex min-w-0 flex-col gap-9 py-9">
        <NetworkIndexFallback />
      </Container>
    </div>
  );
}

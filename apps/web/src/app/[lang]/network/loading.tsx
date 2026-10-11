import { Container } from '@hypha-platform/ui';

import { NetworkIndexFallback } from './_components/network-index-fallback';

export default function NetworkLoading() {
  return (
    <Container className="flex flex-col gap-9 py-9">
      <NetworkIndexFallback />
    </Container>
  );
}

import { NetworkIndexFallback } from './_components/network-index-fallback';
import { NetworkPageShell } from './_components/network-page-shell';

export default function NetworkLoading() {
  return (
    <NetworkPageShell>
      <NetworkIndexFallback />
    </NetworkPageShell>
  );
}

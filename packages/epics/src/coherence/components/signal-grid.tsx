import Link from 'next/link';
import { SignalCard } from './signal-card';
import { Coherence } from '@hypha-platform/core/client';

type SignalGridProps = {
  isLoading: boolean;
  signals: Coherence[];
  refresh: () => Promise<void>;
};

export function SignalGrid({ isLoading, signals, refresh }: SignalGridProps) {
  return (
    <div className="w-full grid grid-cols-1 gap-2">
      {signals.map((signal, index) => (
        <Link key={`signal-card-${index}`} href="#">
          <SignalCard {...signal} isLoading={isLoading} refresh={refresh} />
        </Link>
      ))}
    </div>
  );
}

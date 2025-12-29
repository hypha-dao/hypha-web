import Link from 'next/link';
import { Coherence } from '../types';
import { SignalCard } from './signal-card';

type SignalGridProps = {
  isLoading: boolean;
  signals: Coherence[];
};

export function SignalGrid({ isLoading, signals }: SignalGridProps) {
  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2">
      {signals.map((signal) => (
        <Link href="#">
          <SignalCard {...signal} isLoading={isLoading} />
        </Link>
      ))}
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import { cn } from '@hypha-platform/ui-utils';
import type { CallFloatingReaction } from './use-call-reactions';

const FLOAT_MS = 2_500;

export function CallFloatingReactionOverlay({
  reactions,
}: {
  reactions: CallFloatingReaction[];
}) {
  const slots = useMemo(
    () => reactions.slice(-3).map((reaction, index) => ({ reaction, index })),
    [reactions],
  );

  if (slots.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes hypha-call-floating-reaction {
          0% {
            opacity: 0;
            transform: translateY(0) scale(0.85);
          }
          15% {
            opacity: 1;
            transform: translateY(-8px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-48px) scale(1.05);
          }
        }
      `}</style>
      <div
        className="pointer-events-none absolute inset-0 z-[4] overflow-hidden"
        aria-hidden
      >
        {slots.map(({ reaction, index }) => (
          <span
            key={reaction.id}
            className={cn(
              'absolute drop-shadow-md motion-reduce:opacity-100',
              reaction.style === 'effect' ? 'text-4xl' : 'text-2xl',
            )}
            style={{
              left: `${18 + index * 22}%`,
              bottom: `${28 + index * 8}%`,
              animation: `hypha-call-floating-reaction ${FLOAT_MS}ms ease-out forwards`,
            }}
          >
            {reaction.emoji}
          </span>
        ))}
      </div>
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Chip, Kicker } from '@/components/primitives';
import { Frame } from '@/components/workspace';
import { jobs, space } from '@/lib/data';
import { useStore } from '@/lib/store';

export function PublicSpace() {
  const s = useStore();
  const pinned = jobs.find((j) => j.id === s.pinnedJob);

  return (
    <Frame>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl px-5 py-12 md:py-20">
          <p className="rise mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
            Public space
          </p>
          <h1 className="rise text-[38px] font-semibold leading-[1.08] tracking-[-0.035em]">
            {space.name}
          </h1>
          <p className="rise-1 mt-4 max-w-md text-[17px] leading-relaxed text-sub">
            {space.purpose} {space.audience}
          </p>

          <div className="rise-1 mt-8 flex gap-2.5">
            <Button onClick={s.joinSpace}>Join</Button>
            <Button variant="outline" onClick={s.requestJoin}>
              Request to join
            </Button>
          </div>

          {pinned && (
            <Card className="rise-2 mt-10 border-agent/25 bg-agent-soft/40 p-5">
              <Kicker className="text-agent">
                You said you were interested
              </Kicker>
              <p className="mt-2 text-[16px] font-medium tracking-[-0.015em]">
                {pinned.title}
              </p>
              <p className="mt-1 text-[13px] text-sub">
                Interest, not an assignment. Join first — the DRI will see it.
              </p>
            </Card>
          )}

          <div className="rise-2 mt-12 space-y-2.5">
            <Kicker>What this space has actually done</Kicker>
            <Card className="p-5">
              <div className="space-y-3">
                <p className="text-[14px] leading-relaxed">
                  Saturday stall held every week since March. Three growers
                  selling. A 4,200 USDC grant sits in the treasury — money moves
                  only through proposals everyone can see.
                </p>
                <p className="text-[14px] leading-relaxed text-sub">
                  Still unresolved: no weekday hall, and the licence question
                  keeps coming back.
                </p>
              </div>
            </Card>
          </div>

          <div className="rise-3 mt-10 space-y-2.5 pb-24">
            <Kicker>Open work nobody holds</Kicker>
            {jobs.map((job) => (
              <Card key={job.id} className="p-4">
                <div className="mb-1.5 flex items-center gap-2">
                  <Chip tone={job.kind === 'project' ? 'agent' : 'neutral'}>
                    {job.kind === 'project'
                      ? 'Project — needs a DRI'
                      : 'Ticket'}
                  </Chip>
                </div>
                <p className="text-[15px] font-medium tracking-[-0.015em]">
                  {job.title}
                </p>
                <p className="mt-1 text-[13px] text-sub">{job.why}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

export function RequestSent() {
  const s = useStore();
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAccepted(true), 2400);
    return () => clearTimeout(t);
  }, []);

  return (
    <Frame>
      <div className="flex min-h-0 flex-1 items-center justify-center px-6">
        <div className="max-w-sm text-center">
          {!accepted ? (
            <>
              <div className="rise mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-hair">
                <span className="flex gap-1">
                  <span className="dot h-1.5 w-1.5 rounded-full bg-faint" />
                  <span className="dot h-1.5 w-1.5 rounded-full bg-faint" />
                  <span className="dot h-1.5 w-1.5 rounded-full bg-faint" />
                </span>
              </div>
              <h1 className="rise text-[24px] font-semibold tracking-[-0.03em]">
                Request sent
              </h1>
              <p className="rise-1 mt-3 text-[15px] leading-relaxed text-sub">
                A Shaper will accept or decline. You cannot see member screens
                yet — no fake membership.
              </p>
            </>
          ) : (
            <>
              <div className="rise mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-ink text-white">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="m5 12.5 5 5L19 7"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h1 className="rise text-[24px] font-semibold tracking-[-0.03em]">
                Maya accepted
              </h1>
              <p className="rise-1 mt-3 text-[15px] leading-relaxed text-sub">
                One Shaper accept is enough. You are a member — you land in the
                space, not in a work queue.
              </p>
              <Button className="rise-2 mt-6" onClick={s.joinSpace}>
                Enter River Commons
              </Button>
            </>
          )}
        </div>
      </div>
    </Frame>
  );
}

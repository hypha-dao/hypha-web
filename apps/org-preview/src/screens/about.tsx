'use client';

import { Button, Card, Kicker } from '@/components/primitives';
import { Page, Workspace } from '@/components/workspace';
import { uiMapping } from '@/lib/data';
import { useStore } from '@/lib/store';

export function About() {
  const s = useStore();
  return (
    <Workspace>
      <Page kicker="A suggestion for the redesign" title="About this prototype">
        <div className="space-y-2.5">
          <Card className="p-5">
            <Kicker>What this is</Kicker>
            <p className="mt-2 text-[15px] leading-relaxed">
              A clickable sketch of Hypha rebuilt around the intelligent-org
              loop: the org <em>hears</em> what happens in chat and calls,{' '}
              <em>remembers</em> what it is for, puts the next action in front
              of the right person, watches what came of it, and revises what it
              believes.
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-sub">
              Dummy data, no backend, every AI behavior scripted. Use the
              persona switcher (bottom-left) to see the same world as five
              different people. “Reset the world” replays everything.
            </p>
          </Card>

          <Card className="p-5" delay={1}>
            <Kicker>Two rules hold everywhere</Kicker>
            <p className="mt-2 text-[15px] leading-relaxed">
              The AI drafts. People decide.
            </p>
            <p className="mt-1 text-[15px] leading-relaxed">
              Work is offered, never assigned.
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-sub">
              There is no code path that moves money, changes the direction, or
              puts work on a person without a named human’s confirm.
            </p>
          </Card>

          <Card className="p-5" delay={1}>
            <Kicker>Money — agreed in chat, moved by proposal</Kicker>
            <p className="mt-2 text-[15px] leading-relaxed">
              No sums on tickets or projects. Pay is agreed where people already
              talk — a ticket holder with the project DRI, a DRI with a Shaper —
              and the agent remembers the line.
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-sub">
              When the work is done, anyone involved tells their Personal
              Assistant “draft a proposal for the Shapers for my work — 150
              USDC”, or “…whatever we agreed”. The draft carries the agreement
              and the done receipt; the Shapers agree; the payment lands on the
              profile. Money lives in two places only: Decisions and My Profile.
            </p>
          </Card>

          <Card className="p-0" delay={2}>
            <div className="border-b border-hair px-5 py-3">
              <Kicker>Current Hypha → this prototype</Kicker>
            </div>
            <div className="px-5">
              {uiMapping.map((m) => (
                <div
                  key={m.old}
                  className="border-b border-hair py-3.5 last:border-0"
                >
                  <p className="text-[14px] font-medium">
                    <span className="text-sub">{m.old}</span>
                    <span className="mx-2 text-faint">→</span>
                    {m.now}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-sub">
                    {m.why}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5" delay={3}>
            <Kicker>The demo path, five minutes</Kicker>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed text-sub">
              <li>
                As You: onboard by talking, join, accept the setup ticket.
              </li>
              <li>
                As Lea: ask the assistant “Jun, could you print the Saturday
                cover rota?” — a ticket is drafted <em>under</em> hers, she
                offers it, Jun takes it. Work is a tree: whoever holds a piece
                can split it, any depth. Try closing the covers ticket while
                Jun’s piece is open.
              </li>
              <li>
                As Lea, once Jun is done: say “Found both covers — done” in the
                Saturday room, then confirm the done draft.
              </li>
              <li>
                As Lea (or as Sam): tell the assistant “draft a proposal for the
                Shapers for my covers work — whatever we agreed”. It finds the
                150 USDC line in “Saturday stall” and drafts; open it as a
                proposal. Try naming 200 instead and see what the draft says.
              </li>
              <li>
                As Maya: approve the payment (both Shapers must agree), confirm
                strategy v5 in the Shapers chat, run the Stall review, offer
                Weekday hall until Rafi holds it.
              </li>
              <li>
                As anyone: ask the agent “Have we dealt with the council
                before?” and follow the receipts.
              </li>
              <li>
                Switch to Hypha Energy (the rail on the left): the same five
                viewpoints, different people — Rogerio says the municipalities
                are done in “Pilots”, Rogerio or Pedro asks the assistant to
                draft the pay “whatever we agreed”, Alex approves it with the
                other Shapers and offers Carbon credits to Rowan.
              </li>
            </ol>
          </Card>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={s.reset}>
              Reset the world
            </Button>
          </div>
        </div>
      </Page>
    </Workspace>
  );
}

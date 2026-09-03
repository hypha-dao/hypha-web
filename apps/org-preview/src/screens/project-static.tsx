'use client';

import { Kicker } from '@/components/primitives';
import { Page, Workspace } from '@/components/workspace';
import {
  type Health,
  type StaticProject,
  type WorkTicketRow,
} from '@/lib/data';
import { useStore } from '@/lib/store';
import { Fact, HealthCard, TicketList, openUnder } from './work-bits';

/* =========================================================
   A project whose story does not move in the demo — brief
   and tickets (with whatever sits under them). Both orgs
   use it.
   ========================================================= */

/** "5 tickets · 2 open" — counting everything under the project, any depth */
export function ticketCount(tickets: WorkTicketRow[]): string {
  if (tickets.length === 0) return 'none yet';
  const open = tickets.reduce(
    (n, t) => n + (t.state === 'done' ? 0 : 1) + openUnder(t),
    0,
  );
  return `${tickets.length} · ${open === 0 ? 'all done' : `${open} open`}`;
}

/**
 * The agent's read on one project. No DRI yet → nothing to read, say so
 * instead of drawing an empty bar.
 */
export function ProjectHealth({
  health,
  dri,
}: {
  health?: Health;
  dri: string | null;
}) {
  if (!health)
    return (
      <div className="rise-2 mb-6 rounded-2xl border border-dashed border-hair px-5 py-4">
        <Kicker>Project health — the agent’s read</Kicker>
        <p className="mt-2 text-[13px] leading-relaxed text-sub">
          Nothing to read yet —{' '}
          {dri ? 'no ticket has moved' : 'nobody holds this'}. The bar appears
          once the project is held and work starts landing in the ledger.
        </p>
      </div>
    );
  return (
    <HealthCard
      className="rise-2 mb-6"
      health={health}
      kicker="Project health — the agent’s read"
      footnote="Read from this project’s tickets, dates and payments — what the brief promised vs what the trail shows. The DRI can dispute it in one line."
    />
  );
}

export function StaticProjectDetail({
  project,
  tickets = project.tickets,
  health = project.health,
}: {
  project: StaticProject;
  tickets?: WorkTicketRow[];
  health?: Health;
}) {
  const s = useStore();
  const p = project;

  return (
    <Workspace>
      <Page kicker={`Project · ${p.dri ? `held by ${p.dri}` : 'open'}`} wide>
        <button
          type="button"
          onClick={() => s.go('all')}
          className="rise mb-5 text-[13px] font-medium text-sub transition-colors hover:text-ink"
        >
          ← All Work
        </button>
        <h1 className="rise mb-2 text-[28px] font-semibold leading-tight tracking-[-0.03em]">
          {p.title}
        </h1>
        <p className="rise-1 mb-6 max-w-lg text-[15px] leading-relaxed text-sub">
          {p.brief}
        </p>

        <div className="rise-1 mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Fact label="DRI" value={p.dri ?? 'open'} />
          <Fact label="Tickets" value={ticketCount(tickets)} />
          <Fact label="Review" value={p.review} />
          <Fact label="Approved" value={p.approved ?? 'not yet'} />
        </div>

        <ProjectHealth health={health} dri={p.dri} />

        {tickets.length > 0 ? (
          <div className="rise-2 mb-6">
            <Kicker>Tickets</Kicker>
            <TicketList
              projectId={p.id}
              projectTitle={p.title}
              tickets={tickets}
            />
            <p className="mt-2 text-[12px] leading-relaxed text-faint">
              “n under it” means the holder split that ticket and offered the
              pieces — open it to see them.
            </p>
          </div>
        ) : (
          <p className="rise-2 mb-6 text-[13px] text-faint">
            No tickets yet — they appear once someone holds the project and
            splits the work.
          </p>
        )}
      </Page>
    </Workspace>
  );
}

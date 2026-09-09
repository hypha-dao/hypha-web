'use client';

import { PersonLink } from '@/components/person';
import { Button, Card } from '@/components/primitives';
import { Page, Workspace } from '@/components/workspace';
import {
  TICKET_SUGGESTED,
  energyOrg,
  isWaitingOnMe,
  projectsData,
  type EnergyProjectId,
  type RiverProjectId,
  type TicketView,
} from '@/lib/data';
import { useStore } from '@/lib/store';
import { ChildList, Fact, HolderFact, StateChip } from './work-bits';

/* =========================================================
   Any ticket, opened by anyone — read-only. Only the person
   who holds it can move it; everyone else sees the state,
   the receipts, what sits under it, and where to say
   something about it. Works at any depth: a ticket under a
   ticket has the same page, with the path above it.
   ========================================================= */

export function TicketViewScreen() {
  const s = useStore();
  const t = s.ticketView;
  if (!t) return null;

  const energy = s.org === 'energy';
  const key = t.ticketKey ?? t.id;
  const assigned = key ? s.ticketPerson[key] ?? t.who : t.who;
  const accepted = t.state === 'doing' || t.state === 'done';
  const holder = accepted && assigned && assigned !== 'open' ? assigned : null;
  const room = energy ? 'e-pilots' : 'saturday';
  const roomName = energy ? 'Pilots' : 'Saturday stall';
  const isYou = assigned ? isWaitingOnMe(assigned, s.org, s.persona) : false;
  const projectDri =
    (energy
      ? energyOrg.projects[t.projectId as EnergyProjectId]?.dri
      : projectsData[t.projectId as RiverProjectId]?.dri) ?? 'the project DRI';
  // whoever holds the thing above this one offered it — the parent's holder,
  // or the project DRI at the top level
  const offeredBy = t.parent
    ? t.parent.who === 'open'
      ? 'the ticket holder'
      : t.parent.who
    : projectDri;
  const above = t.parent ?? null;
  const rows = t.children ?? [];

  // every ticket above this one, top first — each is a click away
  const chain: TicketView[] = [];
  for (let c = t.parent; c; c = c.parent) chain.unshift(c);
  const depth = chain.length + 1;

  return (
    <Workspace>
      <Page
        kicker={`Ticket · ${
          depth === 1
            ? 'directly under the project'
            : `${depth} levels under the project`
        }`}
        wide
      >
        <nav className="rise mb-5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px]">
          <button
            type="button"
            onClick={() => s.openProject(t.projectId)}
            className="font-medium text-sub transition-colors hover:text-ink"
          >
            {t.projectTitle}
          </button>
          {chain.map((c) => (
            <span key={c.title} className="flex items-center gap-x-1.5">
              <span className="text-faint">›</span>
              <button
                type="button"
                onClick={() => s.viewTicket(c)}
                className="max-w-[16rem] truncate font-medium text-sub transition-colors hover:text-ink"
              >
                {c.title}
              </button>
            </span>
          ))}
          <span className="text-faint">›</span>
          <span className="max-w-[16rem] truncate text-faint">{t.title}</span>
        </nav>

        <div className="rise mb-2 flex items-center gap-2">
          <StateChip state={t.state} label={t.stateLabel} />
          {above && (
            <span className="text-[12px] text-faint">
              a piece of “{above.title}”
            </span>
          )}
        </div>
        <h1 className="rise mb-6 text-[26px] font-semibold leading-tight tracking-[-0.03em]">
          {t.title}
        </h1>

        <div className="rise-1 mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {key && t.state !== 'open' ? (
            <HolderFact
              ticketKey={key}
              current={assigned}
              suggested={t.suggested ?? TICKET_SUGGESTED[key]}
              accepted={accepted}
              done={t.state === 'done'}
            />
          ) : (
            <Fact label="Holds it" value="nobody yet" />
          )}
          <Fact
            label="Offered by"
            value={
              offeredBy === 'the ticket holder' ||
              offeredBy === 'the project DRI' ? (
                offeredBy
              ) : (
                <PersonLink name={offeredBy} />
              )
            }
          />
          <Fact label="Due" value={t.due ?? '—'} />
          <Fact
            label={above ? 'Under ticket' : 'Under project'}
            value={above ? above.title : t.projectTitle}
          />
        </div>

        {t.state === 'open' && (
          <Card className="rise-2 mb-4 border-ink/15 p-5">
            <p className="text-[15px] font-medium">Nobody holds this yet</p>
            <p className="mt-1 text-[13px] leading-relaxed text-sub">
              It stays open until someone accepts it. Work is offered, never
              assigned — {offeredBy} offers it, one person says yes.
            </p>
          </Card>
        )}

        {(rows.length > 0 || (holder && t.state !== 'done')) && (
          <div className="rise-2 mb-4">
            <ChildList parent={t} rows={rows} />
          </div>
        )}

        <div className="rise-3 mt-6 flex flex-wrap gap-2">
          {isYou && t.state !== 'done' && (
            <Button onClick={() => s.go('my')}>Open in My Work</Button>
          )}
          <Button variant="outline" onClick={() => s.openThread(room)}>
            Open “{roomName}”
          </Button>
          <Button variant="ghost" onClick={() => s.openThread('agent')}>
            Ask the assistant
          </Button>
        </div>
      </Page>
    </Workspace>
  );
}

'use client';

import { Avatar, Button, Card, Kicker } from '@/components/primitives';
import { Page, Workspace } from '@/components/workspace';
import {
  energyOrg,
  personaName,
  projectsData,
  type EnergyProjectId,
  type RiverProjectId,
  type TicketView,
} from '@/lib/data';
import { useStore } from '@/lib/store';
import { ChildList, Fact, StateChip, Trail } from './work-bits';

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
  const holder = t.who === 'open' || t.state === 'open' ? null : t.who;
  const room = energy ? 'e-pilots' : 'saturday';
  const roomName = energy ? 'Pilots' : 'Saturday stall';
  const isYou = holder === 'You' || holder === personaName(s.org, s.persona);
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

  const trail = [
    ...(holder && holder !== 'created via the assistant'
      ? [
          {
            when: 'earlier',
            what:
              offeredBy === holder
                ? `${holder} split the piece above and kept this one`
                : `Offered by ${offeredBy} — accepted by ${holder}`,
            receipt: `“${roomName}”`,
          },
        ]
      : holder === 'created via the assistant'
      ? [
          {
            when: 'today',
            what: 'Drafted through the assistant — open, nobody holds it yet',
            receipt: 'Personal Assistant',
          },
        ]
      : [
          {
            when: 'earlier',
            what: `Drafted under “${
              above ? above.title : t.projectTitle
            }” — open, nobody holds it yet`,
            receipt: `“${roomName}”`,
          },
        ]),
    ...(rows.length > 0 && holder
      ? [
          {
            when: 'earlier',
            what: `${holder} split it — ${rows.length} piece${
              rows.length === 1 ? '' : 's'
            } offered, each to one person`,
            receipt: `“${roomName}”`,
          },
        ]
      : []),
    ...(t.state === 'waiting' && t.stateLabel?.includes('done draft')
      ? [
          {
            when: 'today',
            what: `Done drafted from talk — waiting on ${holder}`,
            receipt: `“${roomName}”`,
          },
        ]
      : []),
    ...(t.state === 'done'
      ? [
          {
            when: 'earlier',
            what: `Done — confirmed by ${holder}`,
            receipt: `“${roomName}”`,
          },
        ]
      : []),
  ];

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
          <Fact label="Holds it" value={holder ?? 'nobody yet'} />
          <Fact label="Offered by" value={offeredBy} />
          <Fact label="Due" value={t.due ?? '—'} />
          <Fact
            label={above ? 'Under ticket' : 'Under project'}
            value={above ? above.title : t.projectTitle}
          />
        </div>

        {holder && (
          <Card className="rise-2 mb-4 p-5">
            <div className="flex items-center gap-3">
              <Avatar name={holder} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium">
                  {holder} holds this{isYou ? ' — that is you' : ''}
                </p>
                <p className="text-[13px] leading-relaxed text-sub">
                  {t.state === 'done'
                    ? 'Finished, with the receipt attached. It stays readable forever.'
                    : isYou
                    ? 'Open it from My Work to edit the draft, split it, or mark it done.'
                    : `Only ${holder} can mark it done or split it further. Say something about it in “${roomName}” and the agent hears it.`}
                </p>
              </div>
            </div>
          </Card>
        )}

        {!holder && (
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

        <div className="rise-3">
          <Kicker>Trail — every state change, with its receipt</Kicker>
          <Trail rows={trail} />
        </div>

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

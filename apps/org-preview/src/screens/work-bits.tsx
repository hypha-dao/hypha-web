'use client';

import type { ReactNode } from 'react';
import { PersonLink } from '@/components/person';
import {
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  Kicker,
  cn,
} from '@/components/primitives';
import {
  HOLDERS,
  TICKET_SUGGESTED,
  displayPerson,
  isWaitingOnMe,
  type Health,
  type OrgId,
  type PersonaId,
  type ProjectId,
  type TicketId,
  type TicketView,
  type WorkTicketRow,
} from '@/lib/data';
import { OFFERS, useStore, type OfferId, type ShaperAskId } from '@/lib/store';

/* Shared pieces for the work surfaces — used by both orgs. */

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Kicker className="mb-2">{title}</Kicker>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

/** All Work board: stacked on mobile, waiting | accepted on desktop. */
export function WorkBoard({
  waiting,
  accepted,
}: {
  waiting: ReactNode;
  accepted: ReactNode;
}) {
  return (
    <div className="grid items-start gap-7 md:grid-cols-2 md:gap-6">
      <Section title="Not accepted yet">{waiting}</Section>
      <Section title="Ongoing">{accepted}</Section>
    </div>
  );
}

/** My Work: stacked on mobile, ask | hold | you offered | finished on desktop. */
export function MyWorkBoard({
  asks,
  held,
  offered,
  finished,
}: {
  asks: ReactNode[];
  held: ReactNode[];
  offered: ReactNode[];
  finished: ReactNode[];
}) {
  return (
    <div className="grid items-start gap-7 lg:grid-cols-2 xl:grid-cols-4 xl:gap-5">
      <div className={cn(asks.length === 0 && 'hidden lg:block')}>
        <Section title="Needs your answer">{asks}</Section>
      </div>
      <div className={cn(held.length === 0 && 'hidden lg:block')}>
        <Section title="You hold">{held}</Section>
      </div>
      <div className={cn(offered.length === 0 && 'hidden lg:block')}>
        <Section title="You offered">{offered}</Section>
      </div>
      <div className={cn(finished.length === 0 && 'hidden lg:block')}>
        <Section title="Finished">{finished}</Section>
      </div>
    </div>
  );
}

export function myWorkOrEmpty(
  asks: ReactNode[],
  held: ReactNode[],
  offered: ReactNode[],
  finished: ReactNode[],
  empty: { title: string; sub: string },
) {
  if (asks.length + held.length + offered.length + finished.length === 0) {
    return <EmptyState title={empty.title} sub={empty.sub} />;
  }
  return (
    <MyWorkBoard
      asks={asks}
      held={held}
      offered={offered}
      finished={finished}
    />
  );
}

export type OfferedState = 'draft' | 'open' | 'waiting' | 'held';

export function useHolder(key: string): string {
  const s = useStore();
  return s.ticketPerson[key] ?? TICKET_SUGGESTED[key] ?? 'open';
}

/** Waiting-on-me stays in Needs your answer; otherwise You offered. */
export function placeOffer(
  asks: ReactNode[],
  offered: ReactNode[],
  to: string | undefined,
  waiting: boolean,
  org: OrgId,
  persona: PersonaId,
  card: ReactNode,
) {
  if (waiting && isWaitingOnMe(to, org, persona)) asks.push(card);
  else offered.push(card);
}

/** List card for a Shaper ask — kind + title. Full brief is on the open page. */
export function ShaperAskCard({
  ask,
  kind,
  title,
  delay,
}: {
  ask: ShaperAskId;
  kind: string;
  title: string;
  delay?: 1 | 2 | 3;
}) {
  const s = useStore();
  const tone =
    kind === 'money' ? 'money' : kind === 'project' ? 'agent' : 'neutral';
  return (
    <Card className="p-5" delay={delay} onClick={() => s.openShaperAsk(ask)}>
      <Chip className="px-2 py-0.5 text-[10px]" tone={tone}>
        {kind}
      </Chip>
      <p className="mt-2 text-[15px] font-semibold leading-snug tracking-[-0.015em]">
        {title}
      </p>
    </Card>
  );
}

/** Same card in every My Work column: who / what / due. */
export function WorkItemCard({
  askedBy,
  title,
  due,
  asking,
  offered,
  suggested,
  delay,
  onOpen,
}: {
  askedBy?: string;
  title: string;
  due?: string;
  asking?: boolean;
  offered?: { to?: string; state: OfferedState };
  suggested?: string;
  delay?: 1 | 2 | 3;
  onOpen: () => void;
}) {
  const s = useStore();
  const who = (name: string) => displayPerson(name, s.persona);
  const kicker = offered ? (
    offered.state === 'draft' ? (
      'Draft'
    ) : offered.state === 'open' ? (
      'Open'
    ) : offered.state === 'waiting' && offered.to ? (
      <>
        Waiting on <PersonLink name={who(offered.to)} />
      </>
    ) : offered.to ? (
      <>
        <PersonLink name={who(offered.to)} /> holds it
      </>
    ) : (
      'Open'
    )
  ) : asking ? (
    <>
      <PersonLink name={who(askedBy ?? '')} /> is asking you
    </>
  ) : (
    <>
      Asked by <PersonLink name={who(askedBy ?? '')} />
    </>
  );

  return (
    <Card className="p-5" delay={delay} onClick={onOpen}>
      <Kicker>{kicker}</Kicker>
      <p className="mt-2 text-[16px] font-semibold leading-snug tracking-[-0.015em]">
        {title}
      </p>
      {due && <p className="mt-2.5 text-[13px] text-sub">Due {due}</p>}
    </Card>
  );
}

/**
 * Compact person picker for the metadata row.
 * Waiting → “Offered to”. Accepted → “Holds it”.
 */
export function HolderFact({
  ticketKey,
  current,
  accepted,
  done,
}: {
  ticketKey: string;
  current: string;
  suggested?: string;
  accepted: boolean;
  done?: boolean;
}) {
  const s = useStore();
  const options = HOLDERS[s.org];
  const currentStored = s.ticketPerson[ticketKey] ?? current;
  const label =
    accepted || done
      ? 'Holds it'
      : currentStored && currentStored !== 'open'
      ? 'Offered to'
      : 'Holds it';
  const shown = displayPerson(currentStored, s.persona);

  if (done || currentStored === 'open') {
    return (
      <Fact
        label={label}
        value={
          currentStored === 'open' ? 'nobody yet' : <PersonLink name={shown} />
        }
      />
    );
  }

  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
        {label}
      </p>
      <div className="relative mt-1.5">
        <select
          value={currentStored === 'the new member' ? 'You' : currentStored}
          onChange={(e) => s.setTicketPerson(ticketKey, e.target.value)}
          className="w-full cursor-pointer appearance-none bg-transparent pr-5 text-[15px] font-semibold tracking-[-0.01em] outline-none"
        >
          {options.map((name) => {
            const stored = name === 'the new member' ? 'You' : name;
            return (
              <option key={name} value={stored}>
                {displayPerson(stored, s.persona)}
              </option>
            );
          })}
        </select>
        <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[11px] text-faint">
          ▾
        </span>
      </div>
    </Card>
  );
}

export type WorkState = 'done' | 'doing' | 'waiting' | 'open';

export function StateChip({
  state,
  label,
}: {
  state: WorkState;
  label?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[12px] font-medium',
        state === 'done' && 'bg-chip text-faint',
        state === 'doing' && 'bg-agent-soft text-agent',
        state === 'waiting' && 'border border-hair text-sub',
        state === 'open' && 'bg-ink text-white',
      )}
    >
      {label ??
        (state === 'doing'
          ? 'in progress'
          : state === 'waiting'
          ? 'waiting on a yes'
          : state)}
    </span>
  );
}

export type TicketRow = WorkTicketRow;

/* ---- health: the agent's read, one bar red→yellow→green ---- */

export function healthColor(pct: number): string {
  return pct >= 70 ? '#3d8f63' : pct >= 40 ? '#b8931c' : '#c2503d';
}

/** The full card — used for the org and for every project page. */
export function HealthCard({
  health,
  kicker,
  footnote,
  delay,
  className,
}: {
  health: Health;
  kicker: string;
  footnote?: string;
  delay?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <Card className={cn('p-5', className)} delay={delay}>
      <div className="flex items-center justify-between gap-3">
        <Kicker>{kicker}</Kicker>
        <span
          className="shrink-0 text-[13px] font-semibold"
          style={{ color: healthColor(health.pct) }}
        >
          {health.label}
        </span>
      </div>

      <div className="relative mt-4 mb-1 h-2.5 rounded-full bg-gradient-to-r from-[#d96a56] via-[#e5c24e] to-[#57a877]">
        <span
          className="absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-ink bg-paper shadow-[0_1px_4px_rgba(0,0,0,0.2)] transition-[left] duration-700 ease-out"
          style={{ left: `${health.pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-faint">
        <span>struggling</span>
        <span>wobbly</span>
        <span>healthy</span>
      </div>

      <p className="mt-4 text-[14px] leading-relaxed">{health.text}</p>
      {footnote && (
        <p className="mt-3 text-[12px] leading-relaxed text-faint">
          {footnote}
        </p>
      )}
    </Card>
  );
}

/** One line for lists — a dot in the health colour and the label. */
export function HealthPill({ health }: { health?: Health }) {
  if (!health)
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-faint">
        <span className="h-2 w-2 rounded-full border border-faint/60" />
        not held yet
      </span>
    );
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-sub">
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: healthColor(health.pct) }}
      />
      {health.label}
    </span>
  );
}

/** everything under a row, all depths */
export function countUnder(t: TicketRow): number {
  return (t.children ?? []).reduce((n, c) => n + 1 + countUnder(c), 0);
}

export function openUnder(t: TicketRow): number {
  return (t.children ?? []).reduce(
    (n, c) => n + (c.state === 'done' ? 0 : 1) + openUnder(c),
    0,
  );
}

/** how many levels of tickets sit below this one */
export function depthUnder(t: TicketRow): number {
  return (t.children ?? []).reduce((d, c) => Math.max(d, 1 + depthUnder(c)), 0);
}

export function ticketMeta(t: TicketRow) {
  const bits = [t.who === 'open' ? 'nobody yet' : t.who];
  const rest = ticketMetaRest(t);
  if (rest) bits.push(rest);
  return bits.join(' · ');
}

function ticketMetaRest(t: TicketRow) {
  const bits: string[] = [];
  if (t.due && t.state !== 'done') bits.push(`due ${t.due}`);
  const under = countUnder(t);
  if (under > 0) {
    const open = openUnder(t);
    const deep = depthUnder(t);
    bits.push(
      `${under} under it${
        t.state !== 'done' && open > 0 ? `, ${open} open` : ''
      }${deep > 1 ? `, ${deep} levels deep` : ''}`,
    );
  }
  return bits.join(' · ');
}

/** who holds each live ticket — their click lands on the editable screen */
const owner: Partial<Record<TicketId, PersonaId>> = {
  covers: 'lea',
  setup: 'you',
  'e-summary': 'you',
  'e-muni': 'lea',
};

/**
 * One click handler for any ticket row: yours → your screen, else read-only.
 * Pass `parent` when the row sits under another ticket — the view keeps the
 * path, so "back" climbs one level instead of jumping to the project.
 */
export function useTicketOpener(
  projectId: ProjectId,
  projectTitle: string,
  parent?: TicketView,
) {
  const s = useStore();
  return (t: TicketRow) => {
    if (t.id && owner[t.id] === s.persona) {
      if (t.id === 'setup' && s.setup === 'offered')
        return s.openOffer('setup');
      if (t.id !== 'setup' || s.setup === 'accepted') return s.openTicket(t.id);
    }
    s.viewTicket({ ...t, projectId, projectTitle, parent });
  };
}

function TicketLine({
  t,
  onOpen,
  compact,
}: {
  t: TicketRow;
  onOpen: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group flex w-full items-center justify-between gap-3 border-b border-hair text-left last:border-0',
        compact ? 'py-2.5' : 'py-3',
      )}
    >
      <div className="min-w-0">
        <p
          className={cn(
            'truncate font-medium decoration-hair underline-offset-4 group-hover:underline',
            compact ? 'text-[13.5px]' : 'text-[14px]',
            t.state === 'done' && 'text-faint',
          )}
        >
          {t.title}
        </p>
        <p className="mt-0.5 text-[12px] text-sub">
          {t.who === 'open' ? 'nobody yet' : <PersonLink name={t.who} />}
          {ticketMetaRest(t) ? ` · ${ticketMetaRest(t)}` : ''}
        </p>
      </div>
      <StateChip state={t.state} label={t.stateLabel} />
    </button>
  );
}

/**
 * The tickets under a ticket, on that ticket's page. The holder of the parent
 * offered each of these; each opens its own page with its own children.
 */
export function ChildList({
  parent,
  rows,
  mine,
  onSplit,
  splitLabel = 'Split it — offer a piece to someone',
}: {
  parent: TicketView;
  rows: TicketRow[];
  /** the viewer holds the parent */
  mine?: boolean;
  /** shown only to the person holding the parent, while they can still split */
  onSplit?: () => void;
  splitLabel?: string;
}) {
  const open = useTicketOpener(parent.projectId, parent.projectTitle, parent);
  const openCount = rows.filter((c) => c.state !== 'done').length;
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between gap-3 border-b border-hair px-5 py-3">
        <Kicker>Under this ticket</Kicker>
        <span className="text-[12px] text-faint">
          {rows.length === 0
            ? 'nothing yet'
            : openCount === 0
            ? `${rows.length} · all done`
            : `${rows.length} · ${openCount} open`}
        </span>
      </div>
      {rows.length > 0 && (
        <div className="px-5 py-1">
          {rows.map((c) => (
            <TicketLine key={c.title} t={c} onOpen={() => open(c)} compact />
          ))}
        </div>
      )}
      <div className="px-5 py-3.5">
        <p className="text-[12.5px] leading-relaxed text-faint">
          {mine || onSplit
            ? 'You hold this, so you can offer pieces of it to anyone — no need to go through the project DRI. It cannot close while a piece is open.'
            : rows.length > 0
            ? `Offered by whoever holds ${
                parent.who === 'open' ? 'the ticket' : 'it'
              }. Any depth — each piece has its own page.`
            : 'Whoever holds this can split it and offer the pieces. Nothing here yet.'}
        </p>
        {onSplit && (
          <Button
            className="mt-3"
            size="sm"
            variant="outline"
            onClick={onSplit}
          >
            {splitLabel}
          </Button>
        )}
      </div>
    </Card>
  );
}

export function OpenProjectCard({
  title,
  review,
  onOpen,
}: {
  title: string;
  review: string;
  onOpen: () => void;
}) {
  return (
    <Card className="p-5" onClick={onOpen}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[16px] font-semibold leading-snug tracking-[-0.02em]">
            {title}
          </p>
          <p className="mt-1 text-[13px] leading-snug text-sub">{review}</p>
        </div>
        <StateChip state="open" label="needs a DRI" />
      </div>
    </Card>
  );
}

export function ProjectBlock({
  title,
  dri,
  meta,
  onOpen,
  health,
}: {
  title: string;
  dri: string;
  meta: string;
  onOpen: () => void;
  health?: Health;
}) {
  return (
    <Card className="p-0">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start justify-between gap-3 rounded-2xl px-5 py-4 text-left transition-colors hover:bg-wash"
      >
        <div className="flex min-w-0 items-start gap-3">
          <Avatar name={dri} size="md" />
          <div className="min-w-0">
            <p className="text-[16px] font-semibold leading-snug tracking-[-0.02em]">
              {title}
            </p>
            <p className="mt-1 text-[12px] leading-snug text-sub">
              <PersonLink name={dri} /> holds it
            </p>
            <p className="text-[12px] leading-snug text-sub">{meta}</p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-3 pt-0.5">
          {health && <HealthPill health={health} />}
          <span className="text-[13px] font-medium text-ink">Open →</span>
        </span>
      </button>
    </Card>
  );
}

/** The ticket list on a project page — every row opens. */
export function TicketList({
  projectId,
  projectTitle,
  tickets,
}: {
  projectId: ProjectId;
  projectTitle: string;
  tickets: TicketRow[];
}) {
  const openTicket = useTicketOpener(projectId, projectTitle);
  return (
    <div className="mt-2">
      {tickets.map((t) => (
        <TicketLine key={t.title} t={t} onOpen={() => openTicket(t)} />
      ))}
    </div>
  );
}

/** Project + due on an offer — project opens, due sits under it. */
export function OfferWhere({
  project,
  projectId,
  due,
}: {
  project: string;
  projectId: ProjectId;
  due: string;
}) {
  const s = useStore();
  return (
    <div className="mt-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
        Project
      </p>
      <button
        type="button"
        onClick={() => s.openProject(projectId)}
        className="mt-0.5 text-left text-[14px] font-medium text-ink underline-offset-2 transition-colors hover:underline"
      >
        {project}
      </button>
      <p className="mt-1 text-[13px] text-sub">Due {due}</p>
    </div>
  );
}

/** An offer to You, in "Needs your answer" — accept or send it back, in place. */
export function OfferCard({ id }: { id: OfferId }) {
  const s = useStore();
  const o = OFFERS[id];
  if (s.offers[id] !== 'offered') return null;
  return (
    <WorkItemCard
      asking
      askedBy={o.from}
      title={o.title}
      due={o.due}
      suggested={TICKET_SUGGESTED[id]}
      onOpen={() => s.openOffer(id)}
    />
  );
}

/** the row an accepted offer becomes on the boards */
export function offerRow(id: OfferId): TicketRow {
  const o = OFFERS[id];
  return {
    title: o.title,
    who: 'You',
    state: 'doing',
    due: o.due,
  };
}

/** Something you hold that does not move in the demo — opens read-only. */
export function HeldCard({
  view,
  askedBy,
  delay,
}: {
  view: TicketView;
  askedBy: string;
  delay?: 1 | 2 | 3;
}) {
  const s = useStore();
  return (
    <WorkItemCard
      askedBy={askedBy}
      title={view.title}
      due={view.due}
      delay={delay}
      onOpen={() => s.viewTicket(view)}
    />
  );
}

export function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
        {label}
      </p>
      <p className="mt-1.5 text-[15px] font-semibold tabular-nums tracking-[-0.01em]">
        {value}
      </p>
    </Card>
  );
}

export function Waiting({ who }: { who: string }) {
  return (
    <div className="rise flex items-center gap-2.5 text-[14px] text-sub">
      <span className="flex gap-1">
        <span className="dot h-1.5 w-1.5 rounded-full bg-faint" />
        <span className="dot h-1.5 w-1.5 rounded-full bg-faint" />
        <span className="dot h-1.5 w-1.5 rounded-full bg-faint" />
      </span>
      Offered to <PersonLink name={who} /> — their yes or no, nobody else’s.
    </div>
  );
}

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
  Row,
} from '@/components/primitives';
import { Page, Workspace } from '@/components/workspace';
import {
  TICKET_SUGGESTED,
  energyOrg,
  type EnergyProjectId,
  type EnergyTicketId,
  type Health,
  type TicketView,
} from '@/lib/data';
import { OFFERS, useStore, PAY_ROGERIO_ID } from '@/lib/store';
import { ProposalCard } from './proposals';
import { ProjectHealth, ticketCount } from './project-static';
import {
  ChildList,
  Fact,
  HeldCard,
  HolderFact,
  myWorkOrEmpty,
  OfferCard,
  OpenProjectCard,
  placeOffer,
  ProjectBlock,
  Section,
  ShaperAskCard,
  TicketList,
  Waiting,
  WorkBoard,
  WorkItemCard,
  offerRow,
  useHolder,
  type TicketRow,
} from './work-bits';

/* =========================================================
   Hypha Energy — the same surfaces, a different world.
   You: holds the Ameland summary ticket.
   Rogerio (ticket DRI): municipalities — done-from-talk.
   Pedro (project DRI): Iberia pilots — pays Rogerio via proposal.
   Alex (Shaper): EECF vote, carbon credits offer, a join request.
   Nina (investor): watches.
   ========================================================= */

const P = energyOrg.projects;
const T = energyOrg.tickets;
/** live ticket rows — the two whose state moves, keyed by project */
function useLiveTickets() {
  const s = useStore();
  const muni: TicketRow = {
    id: 'e-muni',
    title: T['e-muni'].title,
    who: 'Rogerio',
    state:
      s.eMuni === 'done'
        ? 'done'
        : s.eMuni === 'draftDone'
        ? 'waiting'
        : 'doing',
    stateLabel:
      s.eMuni === 'draftDone' ? 'done draft — waiting on Rogerio' : undefined,
    due: T['e-muni'].due,
    children: T['e-muni'].children,
  };
  const summary: TicketRow = {
    id: 'e-summary',
    title: T['e-summary'].title,
    who: 'You',
    state: s.eSummary === 'done' ? 'done' : 'doing',
    due: T['e-summary'].due,
  };
  const chat: TicketRow[] =
    s.chatTicket?.state === 'created' && s.chatTicket.org === 'energy'
      ? [
          {
            title: s.chatTicket.title,
            who: 'created via the assistant',
            state: 'open',
            stateLabel: 'open — needs a DRI',
          },
        ]
      : [];

  // the FAQ row is open until You accept Suzana's offer
  const playbook = P.playbook.tickets.map((row) =>
    row.title === OFFERS['e-faq'].title && s.offers['e-faq'] === 'accepted'
      ? offerRow('e-faq')
      : row,
  );

  return {
    iberia: [muni, ...P.iberia.tickets, ...chat],
    ems: P.ems.tickets,
    islands: [summary, ...P.islands.tickets],
    carbon: P.carbon.tickets,
    playbook,
    hardware: P.hardware.tickets,
  } as Record<EnergyProjectId, TicketRow[]>;
}

/** Rogerio's and Pedro's second tickets, straight from the Iberia data */
const rogerioNotes = P.iberia.tickets.find((t) =>
  t.title.startsWith('Coopérnico quarterly'),
)!;
const pedroShortlist = P.iberia.tickets.find((t) =>
  t.title.startsWith('Shortlist six'),
)!;

/** the projects someone holds, in board order */
const HELD: EnergyProjectId[] = ['iberia', 'ems', 'islands', 'playbook'];

function projectMeta(id: EnergyProjectId) {
  const p = P[id];
  return `review ${p.review}`;
}

/* ---------------- My Work ---------------- */

export function EnergyMyWorkBody() {
  const s = useStore();
  switch (s.persona) {
    case 'you':
      return <YouEnergy />;
    case 'lea':
      return <RogerioWork />;
    case 'sam':
      return <PedroWork />;
    case 'maya':
      return <AlexWork />;
    case 'eli':
      return (
        <EmptyState
          title="Nothing needs you."
          sub="Investors watch. The Overview shows what was said and what was done — no work buttons, ever."
        />
      );
  }
}

function YouEnergy() {
  const s = useStore();
  const t = T['e-summary'];
  const faq = s.offers['e-faq'];
  const summaryView: TicketView = {
    id: 'e-summary',
    ticketKey: 'e-summary',
    title: t.title,
    who: 'You',
    suggested: TICKET_SUGGESTED['e-summary'],
    state: s.eSummary === 'done' ? 'done' : 'doing',
    due: t.due,
    projectId: 'islands',
    projectTitle: P.islands.title,
  };

  const asks: ReactNode[] = [];
  if (faq === 'offered') asks.push(<OfferCard key="faq" id="e-faq" />);

  const held: ReactNode[] = [];
  if (s.eSummary !== 'done')
    held.push(
      <WorkItemCard
        key="summary"
        askedBy="Marcus"
        title={t.title}
        due={t.due}
        suggested={TICKET_SUGGESTED['e-summary']}
        onOpen={() => s.openTicket('e-summary')}
      />,
    );
  if (faq === 'accepted')
    held.push(
      <HeldCard
        key="faq"
        askedBy="Suzana"
        delay={1}
        view={{
          ...offerRow('e-faq'),
          projectId: 'playbook',
          projectTitle: P.playbook.title,
        }}
      />,
    );

  const finished: ReactNode[] = [];
  if (s.eSummary === 'done')
    finished.push(
      <WorkItemCard
        key="summary-done"
        askedBy="Marcus"
        title={t.title}
        due={t.due}
        suggested={TICKET_SUGGESTED['e-summary']}
        onOpen={() => s.viewTicket({ ...summaryView, ticketKey: 'e-summary' })}
      />,
    );

  return myWorkOrEmpty(asks, held, [], finished, {
    title: 'Nothing needs you.',
    sub: 'When something fits you, it will be one card here — not a feed.',
  });
}

function RogerioWork() {
  const s = useStore();
  const t = T['e-muni'];
  const muniView: TicketView = {
    id: 'e-muni',
    ticketKey: 'e-muni',
    title: t.title,
    who: 'Rogerio',
    suggested: TICKET_SUGGESTED['e-muni'],
    state: s.eMuni === 'done' ? 'done' : 'doing',
    due: t.due,
    projectId: 'iberia',
    projectTitle: P.iberia.title,
  };
  const notes = (
    <HeldCard
      key="notes"
      askedBy="Pedro"
      delay={1}
      view={{
        ...rogerioNotes,
        projectId: 'iberia',
        projectTitle: P.iberia.title,
      }}
    />
  );
  const galicia = pedroShortlist.children![1];
  const galiciaCard = (
    <HeldCard
      key="galicia"
      askedBy="Pedro"
      delay={2}
      view={{
        ...galicia,
        projectId: 'iberia',
        projectTitle: P.iberia.title,
        parent: {
          ...pedroShortlist,
          projectId: 'iberia',
          projectTitle: P.iberia.title,
        },
      }}
    />
  );

  const asks: ReactNode[] = [];
  if (s.eMuni === 'draftDone')
    asks.push(
      <WorkItemCard
        key="muni"
        asking
        askedBy="Pedro"
        title={t.title}
        due={t.due}
        suggested={TICKET_SUGGESTED['e-muni']}
        onOpen={() => s.openTicket('e-muni')}
      />,
    );

  const held: ReactNode[] = [notes, galiciaCard];
  if (s.eMuni === 'doing')
    held.unshift(
      <WorkItemCard
        key="muni"
        askedBy="Pedro"
        title={t.title}
        due={t.due}
        suggested={TICKET_SUGGESTED['e-muni']}
        onOpen={() => s.openTicket('e-muni')}
      />,
    );

  const finished: ReactNode[] = [];
  if (s.eMuni === 'done')
    finished.push(
      <WorkItemCard
        key="muni-done"
        askedBy="Pedro"
        title={t.title}
        due={t.due}
        suggested={TICKET_SUGGESTED['e-muni']}
        onOpen={() => s.viewTicket({ ...muniView, ticketKey: 'e-muni' })}
      />,
    );

  return myWorkOrEmpty(asks, held, [], finished, {
    title: 'Nothing needs you.',
    sub: 'When something fits you, it will be one card here.',
  });
}

function PedroWork() {
  const s = useStore();
  const p = P.iberia;
  const muniTo = useHolder('e-muni');
  const muniDone: TicketView = {
    id: 'e-muni',
    ticketKey: 'e-muni',
    title: T['e-muni'].title,
    who: muniTo,
    suggested: TICKET_SUGGESTED['e-muni'],
    state: 'done',
    due: T['e-muni'].due,
    projectId: 'iberia',
    projectTitle: p.title,
  };

  const asks: ReactNode[] = [];
  if (s.eMuni === 'done' && !s.ePayDraft)
    asks.push(
      <WorkItemCard
        key="pay"
        asking
        askedBy="Rogerio"
        title="Draft the pay proposal for the municipalities — what we agreed"
        onOpen={() => s.viewTicket(muniDone)}
      />,
    );

  const held: ReactNode[] = [
    <WorkItemCard
      key="iberia"
      askedBy="the Shapers"
      title={p.title}
      due={p.review}
      onOpen={() => s.openProject('iberia')}
    />,
    <HeldCard
      key="shortlist"
      askedBy="Alex"
      delay={1}
      view={{
        ...pedroShortlist,
        projectId: 'iberia',
        projectTitle: p.title,
      }}
    />,
  ];

  const offered: ReactNode[] = [];
  if (s.eMuni === 'doing' || s.eMuni === 'draftDone')
    offered.push(
      <WorkItemCard
        key="muni"
        offered={{ state: 'held', to: muniTo }}
        title={T['e-muni'].title}
        due={T['e-muni'].due}
        suggested={TICKET_SUGGESTED['e-muni']}
        onOpen={() =>
          s.viewTicket({
            ...muniDone,
            state: 'doing',
          })
        }
      />,
    );

  const finished: ReactNode[] = [];
  if (s.eMuni === 'done')
    finished.push(
      <WorkItemCard
        key="muni-done"
        offered={{ state: 'held', to: muniTo }}
        title={T['e-muni'].title}
        due={T['e-muni'].due}
        suggested={TICKET_SUGGESTED['e-muni']}
        onOpen={() => s.viewTicket(muniDone)}
      />,
    );

  return myWorkOrEmpty(asks, held, offered, finished, {
    title: 'Nothing needs you.',
    sub: 'When something fits you, it will be one card here.',
  });
}

function AlexWork() {
  const s = useStore();
  const carbonTo = useHolder('carbon');
  const openDecisions = s.eProposals.filter((p) => p.state === 'open');

  const asks: ReactNode[] = openDecisions.map((p) => (
    <ProposalCard key={p.id} p={p} />
  ));
  if (s.eCarbon === 'draft')
    asks.push(
      <ShaperAskCard
        key="carbon"
        ask="carbon"
        kind="project"
        title={`${P.carbon.title} — needs a DRI`}
        delay={1}
      />,
    );
  if (!s.eJoin)
    asks.push(
      <ShaperAskCard
        key="join"
        ask="join"
        kind="join"
        title="Ameland Energy Coop wants in"
        delay={2}
      />,
    );

  const carbonView: TicketView = {
    ticketKey: 'carbon',
    title: P.carbon.title,
    who: carbonTo,
    suggested: TICKET_SUGGESTED.carbon,
    state: s.eCarbon === 'held' ? 'doing' : 'waiting',
    due: P.carbon.review,
    projectId: 'carbon',
    projectTitle: P.carbon.title,
  };

  const offered: ReactNode[] = [];
  if (s.eCarbon === 'offering')
    placeOffer(
      asks,
      offered,
      carbonTo,
      true,
      s.org,
      s.persona,
      <WorkItemCard
        key="carbon"
        offered={{ state: 'waiting', to: carbonTo }}
        title={P.carbon.title}
        due={P.carbon.review}
        suggested={TICKET_SUGGESTED.carbon}
        onOpen={() => s.viewTicket(carbonView)}
      />,
    );
  if (s.eCarbon === 'held')
    offered.push(
      <WorkItemCard
        key="carbon"
        offered={{ state: 'held', to: carbonTo }}
        title={P.carbon.title}
        due={P.carbon.review}
        suggested={TICKET_SUGGESTED.carbon}
        onOpen={() => s.viewTicket(carbonView)}
      />,
    );

  return myWorkOrEmpty(asks, [], offered, [], {
    title: 'Nothing needs a Shaper.',
    sub: 'The org runs itself between these cards. That is the point.',
  });
}

export function CarbonDetail() {
  const s = useStore();
  const p = P.carbon;
  return (
    <Card className="p-5" delay={1}>
      <Chip tone="agent">
        Project draft — {p.from.replace('Drafted from ', 'from ')}
      </Chip>
      <p className="mt-3 text-[17px] font-semibold tracking-[-0.02em]">
        {p.title} — needs a DRI
      </p>
      <div className="mt-3">
        <Row label="Review" value={p.review} />
        <Row label="Needs" value="someone who knows carbon accounting" />
      </div>
      <div className="mt-4">
        {s.eCarbon === 'draft' && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={s.offerCarbon}>
              Offer to Rowan
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                s.toast('Amended in place — review, wording. No form.')
              }
            >
              Amend
            </Button>
          </div>
        )}
        {s.eCarbon === 'offering' && <Waiting who="Rowan" />}
      </div>
    </Card>
  );
}

export function JoinDetail() {
  const s = useStore();
  return (
    <Card className="p-5" delay={2}>
      <Chip>Join request</Chip>
      <div className="mt-3 flex items-start gap-3">
        <Avatar name="Ameland Energy Coop" size="md" />
        <div className="flex-1">
          <p className="text-[15px] font-medium">
            Ameland Energy Coop wants in
          </p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-sub">
            “The sandbox pilot worked for us. We want to be a member community,
            not a test site.” — 340 households, already producing.
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            s.acceptEnergyJoin();
            s.go('my');
          }}
        >
          Accept
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            s.toast('Declined politely. They can ask again.');
            s.go('my');
          }}
        >
          Decline
        </Button>
      </div>
    </Card>
  );
}

/* ---------------- All Work ---------------- */

/**
 * Health per Energy project — static reads from data, adjusted where the
 * demo moves the story (Iberia paid, Ameland summary, FAQ accepted, carbon held).
 */
function useEnergyHealth(): Record<EnergyProjectId, Health | undefined> {
  const s = useStore();
  const paid =
    s.eProposals.find((x) => x.id === PAY_ROGERIO_ID)?.state === 'passed';

  const iberia: Health = (() => {
    const base = P.iberia.health!;
    if (s.eMuni !== 'done') return base;
    return {
      pct: paid ? 70 : 66,
      label: 'Moving',
      text:
        'Both municipalities are onboarded — done today, confirmed by Rogerio' +
        (paid
          ? ', and Rogerio has been paid — agreed in the room, moved by proposal. '
          : '. ') +
        'What still holds it back is upstream: the EECF round-2 application waits on a 6,000 EURC proposal with one of three Shapers so far.',
    };
  })();

  const islands: Health =
    s.eSummary === 'done'
      ? {
          pct: 94,
          label: 'Healthy',
          text: 'Ameland ran a full sandbox cycle, the coop signed the grid-sharing rules, and the summary for new communities landed today — three of three done with receipts. Only the second island is open, and it is not due until September.',
        }
      : P.islands.health!;

  const playbook: Health =
    s.offers['e-faq'] === 'accepted'
      ? {
          pct: 52,
          label: 'Wobbly, improving',
          text: 'The video is done and Portugal’s template is in; the Portuguese FAQ found a holder today. Still: two of three countries have no one on them, Spain is one person deep on a July date, and the review is Q4.',
        }
      : P.playbook.health!;

  const carbon: Health | undefined =
    s.eCarbon === 'held'
      ? {
          pct: 55,
          label: 'Just started',
          text: 'Rowan accepted today, so there is a holder — and nothing else yet. The measurement method is the whole project until it exists. Too early to be worried; too early to be pleased.',
        }
      : undefined;

  return {
    iberia,
    ems: P.ems.health,
    islands,
    carbon,
    playbook,
    hardware: undefined,
  };
}

export function EnergyAllWork() {
  const s = useStore();
  const health = useEnergyHealth();

  return (
    <Workspace>
      <Page kicker="Who is working on what" title="Projects" wide="board">
        <WorkBoard
          waiting={
            <>
              {s.eCarbon !== 'held' && (
                <OpenProjectCard
                  title={P.carbon.title}
                  review={projectMeta('carbon')}
                  onOpen={() => s.openProject('carbon')}
                />
              )}
              <OpenProjectCard
                title={P.hardware.title}
                review={projectMeta('hardware')}
                onOpen={() => s.openProject('hardware')}
              />
            </>
          }
          accepted={
            <>
              {HELD.map((id) => (
                <ProjectBlock
                  key={id}
                  title={P[id].title}
                  dri={P[id].dri ?? 'open'}
                  meta={projectMeta(id)}
                  onOpen={() => s.openProject(id)}
                  health={health[id]}
                />
              ))}
              {s.eCarbon === 'held' && (
                <ProjectBlock
                  title={P.carbon.title}
                  dri="Rowan"
                  meta={projectMeta('carbon')}
                  onOpen={() => s.openProject('carbon')}
                  health={health.carbon}
                />
              )}
            </>
          }
        />
      </Page>
    </Workspace>
  );
}

/* ---------------- Project detail ---------------- */

export function EnergyProjectDetail() {
  const s = useStore();
  const live = useLiveTickets();
  const health = useEnergyHealth();
  const id = (s.projectId in P ? s.projectId : 'iberia') as EnergyProjectId;
  const p = P[id];

  const dri = id === 'carbon' ? (s.eCarbon === 'held' ? 'Rowan' : null) : p.dri;

  return (
    <Workspace>
      <Page kicker={`Project · ${dri ? `held by ${dri}` : 'open'}`} wide>
        <button
          type="button"
          onClick={() => s.go('all')}
          className="rise mb-5 text-[13px] font-medium text-sub transition-colors hover:text-ink"
        >
          ← Projects
        </button>
        <h1 className="rise mb-2 text-[28px] font-semibold leading-tight tracking-[-0.03em]">
          {p.title}
        </h1>
        <p className="rise-1 mb-6 max-w-lg text-[15px] leading-relaxed text-sub">
          {p.brief}
        </p>

        <div className="rise-1 mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Fact label="DRI" value={dri ? <PersonLink name={dri} /> : 'open'} />
          <Fact label="Tickets" value={ticketCount(live[id])} />
          <Fact label="Review" value={p.review} />
          <Fact
            label="Approved"
            value={
              p.approved ??
              (id === 'carbon' && s.eCarbon === 'held' ? 'today' : 'not yet')
            }
          />
        </div>

        <ProjectHealth health={health[id]} dri={dri} />

        {live[id].length > 0 && (
          <div className="rise-2 mb-6">
            <Kicker>Tickets</Kicker>
            <TicketList
              projectId={id}
              projectTitle={p.title}
              tickets={live[id]}
            />
          </div>
        )}
      </Page>
    </Workspace>
  );
}

/* ---------------- Ticket screen ---------------- */

export function EnergyTicketScreen() {
  const s = useStore();
  const id = (s.ticketId in T ? s.ticketId : 'e-summary') as EnergyTicketId;
  const t = T[id];
  const project = P[t.projectId];
  const isMuni = id === 'e-muni';
  const under: TicketRow[] = isMuni ? T['e-muni'].children : [];
  const asView: TicketView = {
    id,
    title: t.title,
    who: t.dri,
    state: 'doing',
    projectId: t.projectId,
    projectTitle: project.title,
  };

  return (
    <Workspace>
      <Page kicker={`Ticket · ${project.title}`} wide>
        <button
          type="button"
          onClick={() => s.go('my')}
          className="rise mb-5 text-[13px] font-medium text-sub transition-colors hover:text-ink"
        >
          ← My Work
        </button>
        <nav className="rise mb-5 text-[13px]">
          <button
            type="button"
            onClick={() => s.openProject(t.projectId)}
            className="font-medium text-sub transition-colors hover:text-ink"
          >
            {project.title}
          </button>
          <span className="text-faint"> › </span>
          <span className="text-faint">{t.title}</span>
        </nav>
        <h1 className="rise mb-2 text-[26px] font-semibold leading-tight tracking-[-0.03em]">
          {t.title}
        </h1>
        <p className="rise-1 mb-6 text-[14px] text-sub">
          Asked by{' '}
          {project.dri ? <PersonLink name={project.dri} /> : 'the project DRI'}{' '}
          · due {t.due}
        </p>

        <div className="rise-1 mb-6 max-w-[12.5rem]">
          <HolderFact
            ticketKey={id}
            current={s.ticketPerson[id] ?? t.dri}
            accepted
          />
        </div>

        <Card className="mb-4 p-0" delay={1}>
          <div className="border-b border-hair px-5 py-3">
            <Kicker>Draft — already written, yours to correct</Kicker>
          </div>
          <div className="px-5 py-4">
            <textarea
              defaultValue={t.draft}
              rows={6}
              className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none"
            />
          </div>
        </Card>

        {isMuni && (
          <div className="rise-2 mb-5">
            <ChildList
              parent={asView}
              rows={under}
              mine
              onSplit={() =>
                s.toast(
                  'Same move as Lea’s in River Commons — say it to the assistant, it drafts the piece, you offer it.',
                )
              }
            />
          </div>
        )}

        <div className="rise-2 flex flex-wrap gap-2">
          <Button onClick={isMuni ? s.confirmMuniDone : s.finishSummary}>
            Mark done
          </Button>
          <Button variant="ghost" onClick={() => s.go('my')}>
            Later
          </Button>
        </div>

        <p className="rise-3 mt-6 max-w-md text-[13px] leading-relaxed text-faint">
          {isMuni
            ? 'Or just say it is done in “Pilots” — the agent drafts the done with the receipt, and you one-tap it here.'
            : 'A card is one door onto the work; saying “done” where you already talk is another. Both end in the same log.'}
        </p>
      </Page>
    </Workspace>
  );
}

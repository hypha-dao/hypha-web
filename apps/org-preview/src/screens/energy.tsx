'use client';

import type { ReactNode } from 'react';
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
  energyOrg,
  type EnergyProjectId,
  type EnergyTicketId,
  type Health,
  type TicketView,
} from '@/lib/data';
import { OFFERS, useStore, PAY_ROGERIO_ID } from '@/lib/store';
import { ProjectHealth, ticketCount } from './project-static';
import {
  ChildList,
  Fact,
  HeldCard,
  OfferCard,
  ProjectBlock,
  Section,
  StateChip,
  TicketList,
  Waiting,
  offerRow,
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
  const faqHeld =
    faq === 'accepted' ? (
      <HeldCard
        key="faq"
        approvedBy="Suzana"
        delay={1}
        view={{
          ...offerRow('e-faq'),
          projectId: 'playbook',
          projectTitle: P.playbook.title,
        }}
      />
    ) : null;

  if (s.eSummary === 'done') {
    if (faq === 'offered')
      return (
        <Section title="Needs your answer">
          <OfferCard id="e-faq" />
        </Section>
      );
    if (faqHeld) return <Section title="You hold">{faqHeld}</Section>;
    return (
      <EmptyState
        title="Nothing needs you."
        sub="The summary is done — Marcus sees it on All Work, with your name on it."
      />
    );
  }
  return (
    <div className="space-y-7">
      {faq === 'offered' && (
        <Section title="Needs your answer">
          <OfferCard id="e-faq" />
        </Section>
      )}
      <Section title="You hold">
        <Card className="p-6" onClick={() => s.openTicket('e-summary')}>
          <div className="mb-2 flex items-center gap-2">
            <Chip>Island grids · approved by Marcus</Chip>
            <Chip>due {t.due}</Chip>
          </div>
          <p className="text-[19px] font-semibold leading-snug tracking-[-0.02em]">
            {t.title}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-sub">
            Why you: {t.why}
          </p>
          <p className="mt-4 text-[13px] font-medium text-ink">
            Open the draft →
          </p>
        </Card>
        {faqHeld}
      </Section>
    </div>
  );
}

function RogerioWork() {
  const s = useStore();
  const t = T['e-muni'];
  const notes = (
    <HeldCard
      key="notes"
      approvedBy="Pedro"
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
      approvedBy="Pedro"
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

  if (s.eMuni === 'done') {
    return (
      <div className="space-y-7">
        <Section title="You hold">
          {notes}
          {galiciaCard}
        </Section>
        <p className="text-[13px] leading-relaxed text-faint">
          The municipalities are done, with the receipt on the ticket. Ask your
          assistant to draft the pay proposal — whatever you and Pedro agreed in
          “Pilots” — or Pedro will.
        </p>
      </div>
    );
  }

  if (s.eMuni === 'draftDone') {
    return (
      <div className="space-y-7">
        <Section title="Needs your answer">
          <Card className="border-agent/30 p-5">
            <Chip tone="agent">Done — drafted from talk</Chip>
            <p className="mt-3 text-[17px] font-semibold leading-snug tracking-[-0.02em]">
              {t.title}
            </p>
            <blockquote className="mt-3 rounded-xl bg-wash px-3.5 py-2.5 text-[13px] leading-relaxed text-sub">
              “{s.eMuniQuote}” — from “Pilots”, today
            </blockquote>
            <p className="mt-3 text-[13px] leading-relaxed text-sub">
              Confirm, or it confirms itself in <strong>48h</strong> if nobody
              objects. The agent never flips state on its own.
            </p>
            <div className="mt-4 flex gap-2">
              <Button size="sm" onClick={s.confirmMuniDone}>
                Confirm — it is done
              </Button>
              <Button size="sm" variant="ghost" onClick={s.reopenMuni}>
                Not done yet
              </Button>
            </div>
          </Card>
        </Section>
        <Section title="You hold">
          {notes}
          {galiciaCard}
        </Section>
      </div>
    );
  }

  return (
    <Section title="You hold">
      <Card className="p-6" onClick={() => s.openTicket('e-muni')}>
        <div className="mb-2 flex items-center gap-2">
          <Chip>Iberia pilots · approved by Pedro</Chip>
          <Chip>due {t.due}</Chip>
        </div>
        <p className="text-[19px] font-semibold leading-snug tracking-[-0.02em]">
          {t.title}
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-sub">
          Why you: {t.why}
        </p>
        <p className="mt-4 text-[13px] font-medium text-ink">
          Open the draft →
        </p>
      </Card>
      {notes}
      {galiciaCard}
    </Section>
  );
}

function PedroWork() {
  const s = useStore();
  const p = P.iberia;
  const needsAnswer = s.eMuni === 'done' && !s.ePayDraft;

  return (
    <div className="space-y-7">
      {needsAnswer && (
        <Section title="Needs your answer">
          <Card className="border-agent/30 p-5">
            <Chip tone="agent">Work finished — money is a proposal</Chip>
            <p className="mt-3 text-[16px] font-medium tracking-[-0.015em]">
              Rogerio onboarded both municipalities. You agreed his pay in
              “Pilots” — the agent has the line.
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-sub">
              Tell the agent and it drafts the payment proposal with the
              evidence attached — you never fill a form.
            </p>
            <Button
              className="mt-4"
              size="sm"
              onClick={() => {
                s.openThread('agent');
                s.sendMsg('e-agent', {
                  id: `epp${Date.now()}`,
                  from: 'you',
                  text: 'Rogerio finished the municipalities — draft the pay proposal, what we agreed.',
                });
                setTimeout(() => s.draftPayment(), 900);
              }}
            >
              Ask the agent to draft it
            </Button>
          </Card>
        </Section>
      )}

      <Section title="You hold">
        <Card className="p-5" onClick={() => s.openProject('iberia')}>
          <div className="flex items-baseline justify-between">
            <Kicker>Project</Kicker>
            <span className="text-[12px] text-faint">review {p.review}</span>
          </div>
          <p className="mt-2 text-[19px] font-semibold tracking-[-0.02em]">
            {p.title}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-sub">{p.brief}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip>
              {s.eMuni === 'done'
                ? 'municipalities — done'
                : s.eMuni === 'draftDone'
                ? 'municipalities — done draft, waiting on Rogerio'
                : 'municipalities — Rogerio is on it'}
            </Chip>
            <Chip>EECF round 2 — waiting on the proposal</Chip>
            <Chip>shortlist — you, 2 under it</Chip>
          </div>
        </Card>
        <HeldCard
          approvedBy="you"
          delay={1}
          view={{
            ...pedroShortlist,
            projectId: 'iberia',
            projectTitle: p.title,
          }}
        />
      </Section>

      <p className="text-[13px] leading-relaxed text-faint">
        No money on the project. Pay is agreed in chat — you with the Shapers,
        or with whoever holds a piece under you — and moves only through
        proposals.
      </p>
    </div>
  );
}

function AlexWork() {
  const s = useStore();
  const openVotes = s.eProposals.filter(
    (p) => p.state === 'open' && !s.eVotes[p.id],
  );

  const decisions: ReactNode[] = openVotes.map((p) => (
    <Card
      key={p.id}
      className="border-ink/15 p-5"
      onClick={() => s.openProposal(p.id)}
    >
      <Chip tone={p.kind === 'money' ? 'money' : 'agent'}>
        {p.kind === 'money' ? 'Money' : 'Project'} — Shapers decide
      </Chip>
      <p className="mt-2 text-[15px] font-medium">{p.title}</p>
      <p className="mt-1 text-[13px] text-sub">
        Your agreement is waiting — all three Shapers must say yes. Opened by{' '}
        {p.openedBy}.
      </p>
    </Card>
  ));
  if (s.eCarbon !== 'held') decisions.push(<CarbonCard key="carbon" />);
  if (!s.eJoin) decisions.push(<JoinCard key="join" />);

  if (decisions.length === 0) {
    return (
      <EmptyState
        title="Nothing needs a Shaper."
        sub="The org runs itself between these cards. That is the point."
      />
    );
  }

  return (
    <div className="space-y-7">
      <Section title="Needs your answer">{decisions}</Section>
      <p className="text-[13px] leading-relaxed text-faint">
        Everything here was drafted by the org from the rooms and the calls. You
        amend, offer, confirm — you never type a form.
      </p>
    </div>
  );
}

function CarbonCard() {
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

function JoinCard() {
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
        <Button size="sm" onClick={s.acceptEnergyJoin}>
          Accept
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => s.toast('Declined politely. They can ask again.')}
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
  const live = useLiveTickets();
  const health = useEnergyHealth();
  const carbonStatus =
    s.eCarbon === 'draft'
      ? 'draft — with the Shapers'
      : s.eCarbon === 'offering'
      ? 'offered to Rowan — his yes or no'
      : 'held';

  return (
    <Workspace>
      <Page kicker="Who is working on what" title="All Work">
        <div className="space-y-7">
          <Section title="Not accepted yet — waiting for someone to hold it">
            {s.eCarbon !== 'held' && (
              <Card className="p-5" onClick={() => s.openProject('carbon')}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[16px] font-semibold tracking-[-0.02em]">
                    {P.carbon.title}
                  </p>
                  <StateChip state="open" label="needs a DRI" />
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-sub">
                  Project · {projectMeta('carbon')} · {carbonStatus}
                </p>
              </Card>
            )}
            <Card className="p-5" onClick={() => s.openProject('hardware')}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[16px] font-semibold tracking-[-0.02em]">
                  {P.hardware.title}
                </p>
                <StateChip state="open" label="needs a DRI" />
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-sub">
                Project · {projectMeta('hardware')} · draft — with the Shapers
              </p>
            </Card>
          </Section>

          <Section title="Ongoing — accepted, someone holds each one">
            {HELD.map((id) => (
              <ProjectBlock
                key={id}
                projectId={id}
                title={P[id].title}
                dri={P[id].dri ?? 'open'}
                meta={projectMeta(id)}
                onOpen={() => s.openProject(id)}
                tickets={live[id]}
                health={health[id]}
              />
            ))}
            {s.eCarbon === 'held' && (
              <ProjectBlock
                projectId="carbon"
                title={P.carbon.title}
                dri="Rowan"
                meta={projectMeta('carbon')}
                onOpen={() => s.openProject('carbon')}
                tickets={[]}
                health={health.carbon}
              />
            )}
          </Section>
        </div>

        <p className="pt-6 text-[13px] leading-relaxed text-faint">
          Every project with its tickets — who holds each one, its state, its
          date. “n under it” means the holder split that ticket further; open it
          to see the pieces. Nothing here was filed; it is what the org heard in
          the rooms and someone confirmed.
        </p>
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
          ← All Work
        </button>
        <h1 className="rise mb-2 text-[28px] font-semibold leading-tight tracking-[-0.03em]">
          {p.title}
        </h1>
        <p className="rise-1 mb-6 max-w-lg text-[15px] leading-relaxed text-sub">
          {p.brief}
        </p>

        <div className="rise-1 mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Fact label="DRI" value={dri ?? 'open'} />
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
        <h1 className="rise mb-2 text-[26px] font-semibold leading-tight tracking-[-0.03em]">
          {t.title}
        </h1>
        <p className="rise-1 mb-6 text-[14px] text-sub">
          Approved by {project.dri} · due {t.due} · why you:{' '}
          {t.why.charAt(0).toLowerCase() + t.why.slice(1)}
        </p>

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

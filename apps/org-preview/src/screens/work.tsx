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
  pricesChildren,
  projectsData,
  ticketsData,
  type Health,
  type RiverProjectId,
  type RiverTicketId,
  type TicketView,
  type WorkTicketRow,
} from '@/lib/data';
import {
  useStore,
  PAY_LEA_ID,
  SUB_COVERS_TITLE,
  type SubCoversState,
} from '@/lib/store';
import {
  EnergyAllWork,
  EnergyMyWorkBody,
  EnergyProjectDetail,
  EnergyTicketScreen,
} from './energy';
import {
  ProjectHealth,
  StaticProjectDetail,
  ticketCount,
} from './project-static';
import {
  ChildList,
  Fact,
  HeldCard,
  OfferCard,
  OfferWhere,
  OpenProjectCard,
  ProjectBlock,
  Section,
  StateChip,
  TicketList,
  Waiting,
  WorkBoard,
  countUnder,
  offerRow,
} from './work-bits';

/** the tickets Lea and Sam hold under other projects — static, read-only */
const cashBox = projectsData.currency.tickets[1];
const leaTeaches: TicketView = {
  ...cashBox.children![1],
  projectId: 'currency',
  projectTitle: projectsData.currency.title,
  parent: {
    ...cashBox,
    projectId: 'currency',
    projectTitle: projectsData.currency.title,
  },
};
const samLicence: WorkTicketRow = {
  title: 'Renew the market pitch licence',
  who: 'Sam',
  state: 'doing',
  due: '30 Jun',
};

/* =========================================================
   Saturday stall — the live rows, shared by All Work, the
   project page, and the ticket pages so they never disagree.
   ========================================================= */

/** Jun's piece under Lea's covers ticket, once it exists */
export function subCoversRow(state: SubCoversState): WorkTicketRow | null {
  if (state === 'none' || state === 'drafted') return null;
  return {
    title: SUB_COVERS_TITLE,
    who: 'Jun',
    state:
      state === 'done' ? 'done' : state === 'offered' ? 'waiting' : 'doing',
    stateLabel:
      state === 'offered' ? 'offered to Jun — his yes or no' : undefined,
    due: '6 Jun',
  };
}

function useStallTickets(): WorkTicketRow[] {
  const s = useStore();
  const sub = subCoversRow(s.subCovers);
  return [
    {
      id: 'covers',
      title: 'Find two neighbours who can cover a Saturday',
      who: 'Lea',
      state:
        s.covers === 'done'
          ? 'done'
          : s.covers === 'draftDone'
          ? 'waiting'
          : 'doing',
      stateLabel:
        s.covers === 'draftDone' ? 'done draft — waiting on Lea' : undefined,
      due: '7 Jun',
      children: sub ? [sub] : undefined,
    },
    {
      id: 'setup',
      title: 'Write the Saturday setup',
      who: s.setup === 'declined' ? 'Sam' : 'New member',
      state:
        s.setup === 'done'
          ? 'done'
          : s.setup === 'accepted'
          ? 'doing'
          : 'waiting',
      stateLabel: s.setup === 'declined' ? 'declined — re-offer' : undefined,
      due: '14 Jun',
    },
    samLicence,
    {
      title: 'Host the stall on Saturdays',
      who: 'Lea',
      state: 'doing',
      stateLabel: 'ongoing',
    },
    {
      title: 'Agree grower prices for the season',
      who: 'Jun',
      state: 'done',
      children: pricesChildren,
    },
    ...(s.chatTicket?.state === 'created' && s.chatTicket.org === 'river'
      ? [
          {
            title: s.chatTicket.title,
            who: 'created via the assistant',
            state: 'open' as const,
            stateLabel: 'open — needs a DRI',
          },
        ]
      : []),
  ];
}

/* =========================================================
   My Work — one door for everyone; contents differ
   ========================================================= */

export function MyWork() {
  const s = useStore();

  const body = (() => {
    if (s.org === 'energy') return <EnergyMyWorkBody />;
    switch (s.persona) {
      case 'you':
        return <YouWork />;
      case 'lea':
        return <LeaWork />;
      case 'sam':
        return <SamWork />;
      case 'maya':
        return <MayaWork />;
      case 'eli':
        return (
          <EmptyState
            title="Nothing needs you."
            sub="Investors watch. The Overview shows what was said and what was done — no work buttons, ever."
          />
        );
    }
  })();

  return (
    <Workspace>
      <Page kicker="What needs me, what I hold" title="My Work">
        {body}
      </Page>
    </Workspace>
  );
}

/* ---- You (member) ---- */

function YouWork() {
  const s = useStore();
  const setup = ticketsData.setup;
  const photo = s.offers.photo;

  const asks: ReactNode[] = [];
  if (s.setup === 'offered')
    asks.push(
      <Card key="setup" className="border-ink/15 p-5">
        <Kicker className="text-ink">Sam is asking you</Kicker>
        <p className="mt-2 text-[16px] font-medium tracking-[-0.015em]">
          {setup.title}
        </p>
        <OfferWhere
          project="Saturday stall"
          projectId="stall"
          due={setup.due}
        />
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" onClick={s.acceptSetup}>
            Accept
          </Button>
          <Button size="sm" variant="ghost" onClick={s.declineSetup}>
            Not now
          </Button>
          <button
            type="button"
            onClick={() => s.go('offer')}
            className="ml-auto text-[13px] font-medium text-sub transition-colors hover:text-ink"
          >
            Read the whole offer →
          </button>
        </div>
      </Card>,
    );
  if (photo === 'offered') asks.push(<OfferCard key="photo" id="photo" />);

  const held: ReactNode[] = [];
  if (s.setup === 'accepted')
    held.push(
      <Card key="setup" className="p-5" onClick={() => s.openTicket('setup')}>
        <div className="mb-2 flex items-center gap-2">
          <Chip>Saturday stall</Chip>
          <Chip>due {setup.due}</Chip>
        </div>
        <p className="text-[17px] font-semibold leading-snug tracking-[-0.02em]">
          {setup.title}
        </p>
        <p className="mt-2 text-[13px] font-medium text-ink">
          Open the draft →
        </p>
      </Card>,
    );
  if (photo === 'accepted')
    held.push(
      <HeldCard
        key="photo"
        view={{
          ...offerRow('photo'),
          projectId: 'growers',
          projectTitle: projectsData.growers.title,
        }}
      />,
    );

  if (asks.length === 0 && held.length === 0) {
    return (
      <EmptyState
        title="Nothing needs you."
        sub={
          s.setup === 'done'
            ? 'The ticket is done. When something fits you, it will be one card here — not a feed.'
            : 'You sent it back. Whoever offered it picks someone else or leaves it open.'
        }
      />
    );
  }

  return (
    <div className="space-y-7">
      {asks.length > 0 && <Section title="Needs your answer">{asks}</Section>}
      {held.length > 0 && <Section title="You hold">{held}</Section>}
    </div>
  );
}

/* ---- Lea (ticket DRI) ---- */

function LeaWork() {
  const s = useStore();
  const t = ticketsData.covers;
  const teaches = <HeldCard key="teaches" view={leaTeaches} delay={1} />;

  if (s.covers === 'done') {
    return (
      <div className="space-y-7">
        <Section title="You hold">{teaches}</Section>
        <p className="text-[13px] leading-relaxed text-faint">
          The covers are done, with the receipt on the ticket. Ask your
          assistant to draft the pay proposal — whatever you and Sam agreed in
          “Saturday stall” — or Sam will.
        </p>
      </div>
    );
  }

  if (s.covers === 'draftDone') {
    return (
      <div className="space-y-7">
        <Section title="Needs your answer">
          <Card className="border-agent/30 p-5">
            <Chip tone="agent">Done — drafted from talk</Chip>
            <p className="mt-3 text-[17px] font-semibold leading-snug tracking-[-0.02em]">
              {t.title}
            </p>
            <blockquote className="mt-3 rounded-xl bg-wash px-3.5 py-2.5 text-[13px] leading-relaxed text-sub">
              “{s.coversQuote}” — from “Saturday stall”, today
            </blockquote>
            <p className="mt-3 text-[13px] leading-relaxed text-sub">
              Confirm, or it confirms itself in <strong>48h</strong> if nobody
              objects. The agent never flips state on its own.
            </p>
            <div className="mt-4 flex gap-2">
              <Button size="sm" onClick={s.confirmCoversDone}>
                Confirm — it is done
              </Button>
              <Button size="sm" variant="ghost" onClick={s.reopenCovers}>
                Not done yet
              </Button>
            </div>
          </Card>
        </Section>
        <Section title="You hold">{teaches}</Section>
      </div>
    );
  }

  return (
    <Section title="You hold">
      <Card className="p-6" onClick={() => s.openTicket('covers')}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Chip>Saturday stall</Chip>
          <Chip>due {t.due}</Chip>
          {s.subCovers === 'offered' && <Chip>rota — offered to Jun</Chip>}
          {s.subCovers === 'accepted' && (
            <Chip tone="agent">rota — Jun is on it</Chip>
          )}
          {s.subCovers === 'done' && <Chip>rota — Jun, done</Chip>}
        </div>
        <p className="text-[19px] font-semibold leading-snug tracking-[-0.02em]">
          {t.title}
        </p>
        <p className="mt-4 text-[13px] font-medium text-ink">
          Open the draft →
        </p>
      </Card>
      {teaches}
    </Section>
  );
}

/* ---- Sam (project DRI) ---- */

function SamWork() {
  const s = useStore();
  const p = projectsData.stall;
  const needsAnswer = s.covers === 'done' && !s.payDraft;

  return (
    <div className="space-y-7">
      {needsAnswer && (
        <Section title="Needs your answer">
          <Card className="border-agent/30 p-5">
            <Chip tone="agent">Work finished — money is a proposal</Chip>
            <p className="mt-3 text-[16px] font-medium tracking-[-0.015em]">
              Lea finished the covers. You agreed her pay in “Saturday stall” —
              the agent has the line.
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
                s.sendMsg('agent', {
                  id: `pp${Date.now()}`,
                  from: 'you',
                  text: 'Lea finished the covers — draft the pay proposal, what we agreed.',
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
        <Card className="p-5" onClick={() => s.openProject('stall')}>
          <div className="flex items-baseline justify-between">
            <Kicker>Project</Kicker>
            <span className="text-[12px] text-faint">review {p.review}</span>
          </div>
          <p className="mt-2 text-[19px] font-semibold tracking-[-0.02em]">
            {p.title}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-sub">{p.brief}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip>{coversLine(s.covers)}</Chip>
            <Chip>{setupLine(s.setup)}</Chip>
            <Chip>licence — you, due 30 Jun</Chip>
          </div>
        </Card>
        <HeldCard
          view={{
            ...samLicence,
            projectId: 'stall',
            projectTitle: 'Saturday stall',
          }}
          delay={1}
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

function coversLine(state: string) {
  return state === 'done'
    ? 'covers — done'
    : state === 'draftDone'
    ? 'covers — done draft, waiting on Lea'
    : 'covers — Lea is on it';
}

function setupLine(state: string) {
  return state === 'done'
    ? 'setup — done'
    : state === 'accepted'
    ? 'setup — the new member is on it'
    : state === 'declined'
    ? 'setup — declined, re-offer it'
    : 'setup — offered to the new member';
}

/* ---- Maya (Shaper) ---- */

function MayaWork() {
  const s = useStore();
  const openVotes = s.proposals.filter(
    (p) => p.state === 'open' && !s.myVotes[p.id],
  );
  const currency = projectsData.currency;

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
        Your agreement is waiting — both Shapers must say yes. Opened by{' '}
        {p.openedBy}.
      </p>
    </Card>
  ));
  if (s.review === 'due') decisions.push(<ReviewCard key="review" />);
  if (s.weekday !== 'held') decisions.push(<WeekdayCard key="weekday" />);
  if (!s.rafiJoined) decisions.push(<RafiCard key="rafi" />);
  if (s.strategyPending) decisions.push(<StrategyCard key="strategy" />);

  return (
    <div className="space-y-7">
      {decisions.length === 0 ? (
        <EmptyState
          title="Nothing needs a Shaper."
          sub="The org runs itself between these cards. That is the point."
        />
      ) : (
        <Section title="Needs your answer">{decisions}</Section>
      )}

      <Section title="You hold">
        <Card className="p-5" onClick={() => s.openProject('currency')}>
          <div className="flex items-baseline justify-between">
            <Kicker>Project</Kicker>
            <span className="text-[12px] text-faint">
              review {currency.review}
            </span>
          </div>
          <p className="mt-2 text-[19px] font-semibold tracking-[-0.02em]">
            {currency.title}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-sub">
            {currency.brief}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip>vouchers — Priya, done</Chip>
            <Chip>
              cash box — Tom is on it, {countUnder(currency.tickets[1])} under
              it
            </Chip>
            <Chip>rules — you, done</Chip>
          </div>
        </Card>
      </Section>

      <p className="text-[13px] leading-relaxed text-faint">
        Everything above was drafted by the org from the threads and the calls.
        You amend, offer, confirm — you never type a form. A Shaper can hold a
        project too; the rules are the same.
      </p>
    </div>
  );
}

/* ---- Shaper cards ---- */

function ReviewCard() {
  const s = useStore();
  return (
    <Card className="border-ink/15 p-5">
      <div className="flex items-center justify-between gap-3">
        <Chip tone="agent">Ends 1 Jun 2026 — last fifth of its run</Chip>
        <StateChip state="waiting" label="Shapers decide" />
      </div>
      <p className="mt-3 text-[17px] font-semibold tracking-[-0.02em]">
        Saturday stall closes on 1 Jun — does anything follow it?
      </p>

      <Kicker className="mt-4">Brief</Kicker>
      <div className="mt-1">
        <Row label="Held" value="every Saturday since March, Sam as DRI" />
        <Row
          label="Done"
          value={
            s.covers === 'done' ? '2 tickets, covers found' : '1 ticket, prices'
          }
        />
        <Row label="Not done" value="setup doc still open" />
        <Row label="Money moved" value="2 payments, both by proposal" />
        <Row
          label="Objective"
          value="“Saturday held every week” — still live"
        />
      </div>

      <div className="mt-4 rounded-xl bg-agent-soft px-4 py-3">
        <Kicker className="text-agent">
          Recommendation — a follow-up project
        </Kicker>
        <p className="mt-1.5 text-[15px] font-medium tracking-[-0.015em]">
          Saturday stall — summer season
        </p>
        <p className="mt-0.5 text-[13px] text-sub">
          Sam as DRI · ends 31 Oct 2026
        </p>
        <p className="mt-2 text-[14px] leading-relaxed">
          The objective is not done — the season runs to October and the growers
          expect the Saturdays to continue. The setup doc carries over as the
          first ticket. Same shape, new dates, nothing invented.
        </p>
        <p className="mt-1.5 text-[12px] text-faint">
          From the ledger and “Saturday stall”. If nothing pointed to more work
          here, I would say so instead. The stall closes on 1 Jun either way —
          your tap is only about what follows, and it is the approval.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="agent" onClick={s.reviewCloseFollowUp}>
          Open the follow-up
        </Button>
        <Button size="sm" variant="outline" onClick={s.reviewClose}>
          Nothing more
        </Button>
        <Button size="sm" variant="ghost" onClick={s.reviewExtend}>
          Keep the stall open until 1 Sep
        </Button>
      </div>
    </Card>
  );
}

function WeekdayCard() {
  const s = useStore();
  return (
    <Card className="p-5" delay={1}>
      <Chip tone="agent">
        Project draft — from Jun’s licence question in “Saturday stall”
      </Chip>
      <p className="mt-3 text-[17px] font-semibold tracking-[-0.02em]">
        Weekday hall — needs a DRI
      </p>
      <div className="mt-3">
        <Row label="Review" value="1 Aug" />
        <Row label="Needs" value="someone who can sign a licence" />
      </div>

      <div className="mt-4">
        {s.weekday === 'draft' && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => s.offerWeekday('lea')}>
              Offer to Lea
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
        {s.weekday === 'offering-lea' && <Waiting who="Lea" />}
        {s.weekday === 'declined-lea' && (
          <div className="rise">
            <p className="mb-3 rounded-xl bg-wash px-3.5 py-2.5 text-[13px] leading-relaxed text-sub">
              <span className="font-medium text-ink">Lea declined:</span> “I can
              host a Saturday, I cannot sign a licence.” The card came back — it
              never became her problem.
            </p>
            <Button
              size="sm"
              onClick={() => s.offerWeekday('rafi')}
              disabled={!s.rafiJoined}
            >
              Offer to Rafi
            </Button>
            {!s.rafiJoined && (
              <p className="mt-2 text-[12px] text-faint">
                Rafi is still at the door — let him in first.
              </p>
            )}
          </div>
        )}
        {s.weekday === 'offering-rafi' && <Waiting who="Rafi" />}
      </div>
    </Card>
  );
}

function RafiCard() {
  const s = useStore();
  return (
    <Card className="p-5" delay={2}>
      <Chip>Join request</Chip>
      <div className="mt-3 flex items-start gap-3">
        <Avatar name="Rafi" size="md" />
        <div className="flex-1">
          <p className="text-[15px] font-medium">Rafi wants in</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-sub">
            “I ran the market office for six years. I can deal with the
            council.” — exactly what the weekday hall needs.
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button size="sm" onClick={s.acceptRafi}>
          Accept
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => s.toast('Declined politely. He can ask again.')}
        >
          Decline
        </Button>
      </div>
    </Card>
  );
}

function StrategyCard() {
  const s = useStore();
  return (
    <Card className="p-5" delay={3}>
      <Chip tone="agent">Strategy v5 — drafted from Tuesday’s call</Chip>
      <p className="mt-3 text-[15px] font-medium">
        “We do not take the brand sponsorship. Not this year.”
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-sub">
        One line added to the strategy; mission, vision and objectives stay as
        they are. Confirm it and everything the agent does reads from v5 —
        including holding you to it.
      </p>
      <div className="mt-4 flex gap-2">
        <Button size="sm" onClick={s.confirmStrategy}>
          Confirm v5
        </Button>
        <Button size="sm" variant="ghost" onClick={s.rejectStrategy}>
          That is not what we decided
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => s.openThread('shapers')}
        >
          Open Shapers chat
        </Button>
      </div>
    </Card>
  );
}

/* =========================================================
   All Work — the board. Open things first, then each
   project with its tickets.
   ========================================================= */

export function AllWork() {
  const s = useStore();
  if (s.org === 'energy') return <EnergyAllWork />;
  return <RiverAllWork />;
}

/** Grower onboarding's rows, plus the photo ticket once You accept it */
function useGrowerTickets(): WorkTicketRow[] {
  const s = useStore();
  const base = projectsData.growers.tickets;
  return s.offers.photo === 'accepted' ? [...base, offerRow('photo')] : base;
}

function RiverAllWork() {
  const s = useStore();
  const stallHealth = useStallHealth();
  const weekdayHealth = useWeekdayHealth();
  const growers = projectsData.growers;
  const currency = projectsData.currency;
  const harvest = projectsData.harvest;

  return (
    <Workspace>
      <Page kicker="Who is working on what" title="Projects" wide="board">
        <WorkBoard
          waiting={
            <>
              {s.weekday !== 'held' && (
                <OpenProjectCard
                  title="Weekday hall"
                  review="review 1 Aug"
                  onOpen={() => s.openProject('weekday')}
                />
              )}
              <OpenProjectCard
                title={harvest.title}
                review={`review ${harvest.review}`}
                onOpen={() => s.openProject('harvest')}
              />
            </>
          }
          accepted={
            <>
              <ProjectBlock
                title="Saturday stall"
                dri="Sam"
                meta={`review ${s.review === 'extended' ? '1 Sep' : '1 Jun'}${
                  s.review === 'closed' ? ' · closed' : ''
                }`}
                onOpen={() => s.openProject('stall')}
                health={stallHealth}
              />

              {s.weekday === 'held' && (
                <ProjectBlock
                  title="Weekday hall"
                  dri="Rafi"
                  meta="review 1 Aug"
                  onOpen={() => s.openProject('weekday')}
                  health={weekdayHealth}
                />
              )}

              <ProjectBlock
                title={growers.title}
                dri={growers.dri ?? 'open'}
                meta={`review ${growers.review}`}
                onOpen={() => s.openProject('growers')}
                health={growers.health}
              />

              <ProjectBlock
                title={currency.title}
                dri={currency.dri ?? 'open'}
                meta={`review ${currency.review}`}
                onOpen={() => s.openProject('currency')}
                health={currency.health}
              />
            </>
          }
        />
      </Page>
    </Workspace>
  );
}

/* =========================================================
   Project detail — brief, tickets
   ========================================================= */

export function ProjectDetail() {
  const s = useStore();
  if (s.org === 'energy') return <EnergyProjectDetail />;
  return <RiverProjectDetail />;
}

function RiverProjectDetail() {
  const s = useStore();
  const p = projectsData[s.projectId as RiverProjectId] ?? projectsData.stall;
  const growerTickets = useGrowerTickets();
  if (p.id === 'growers')
    return <StaticProjectDetail project={p} tickets={growerTickets} />;
  if (p.id !== 'stall' && p.id !== 'weekday')
    return <StaticProjectDetail project={p} />;
  return <LiveRiverProjectDetail />;
}

/**
 * The agent's read on the two River projects whose story moves in the demo.
 * Written from the same state the trail is written from.
 */
function useStallHealth(): Health {
  const s = useStore();
  const paid = s.proposals.find((x) => x.id === PAY_LEA_ID)?.state === 'passed';
  let pct = 72;
  if (s.covers === 'done') pct += 10;
  if (s.setup === 'accepted' || s.setup === 'done') pct += 6;
  if (s.setup === 'done') pct += 4;
  if (s.review === 'extended' || s.review === 'closed') pct += 4;
  if (s.setup === 'declined') pct -= 6;
  pct = Math.min(96, pct);

  const label = pct >= 85 ? 'Healthy' : pct >= 70 ? 'Holding' : 'Wobbly';
  const text =
    'Every Saturday since March has happened, growers were paid the week they sold, and prices are agreed for the season. ' +
    (s.covers === 'done'
      ? 'The covers are found and confirmed — the stall no longer rests on one person. '
      : 'The soft spot is people: one person has hosted nine of nine Saturdays, and the covers ticket is still open. ') +
    (s.setup === 'done'
      ? 'The setup is written down, so anyone can run it. '
      : s.setup === 'accepted'
      ? 'The setup doc is held, due 14 Jun — until it lands, the stall lives in one head. '
      : s.setup === 'declined'
      ? 'The setup doc was sent back and has no DRI — the stall still lives in one head. '
      : 'The setup doc has been offered and not answered — the stall still lives in one head. ') +
    (paid
      ? 'Every payment so far — the holding, the Saturdays, the covers — was agreed in the room first and moved by a proposal both Shapers passed.'
      : 'Every payment so far was agreed in the room first and moved by a proposal; the covers pay is agreed and waits on the ticket closing.');
  return { pct, label, text };
}

function useWeekdayHealth(): Health | undefined {
  const s = useStore();
  if (s.weekday !== 'held') return undefined;
  return {
    pct: 55,
    label: 'Just started',
    text: 'Rafi accepted today, so there is a holder — and nothing else yet. The licence is the whole project until it is signed. Too early to be worried; too early to be pleased.',
  };
}

function LiveRiverProjectDetail() {
  const s = useStore();
  const p = projectsData[s.projectId as RiverProjectId] ?? projectsData.stall;
  const stallTickets = useStallTickets();
  const isStall = p.id === 'stall';
  const stallHealth = useStallHealth();
  const weekdayHealth = useWeekdayHealth();

  return (
    <Workspace>
      <Page
        kicker={`Project · ${
          isStall
            ? 'held by Sam'
            : s.weekday === 'held'
            ? 'held by Rafi'
            : 'open'
        }`}
        wide
      >
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
          <Fact
            label="DRI"
            value={isStall ? 'Sam' : s.weekday === 'held' ? 'Rafi' : 'open'}
          />
          <Fact
            label="Tickets"
            value={isStall ? ticketCount(stallTickets) : 'none yet'}
          />
          <Fact
            label="Review"
            value={
              isStall && s.review === 'extended'
                ? '1 Sep'
                : isStall && s.review === 'closed'
                ? 'closed'
                : p.review
            }
          />
          <Fact
            label="Approved"
            value={
              isStall ? '12 May' : s.weekday === 'held' ? 'today' : 'not yet'
            }
          />
        </div>

        <ProjectHealth
          health={isStall ? stallHealth : weekdayHealth}
          dri={isStall ? 'Sam' : s.weekday === 'held' ? 'Rafi' : null}
        />

        {isStall && (
          <div className="rise-2 mb-6">
            <Kicker>Tickets</Kicker>
            <TicketList
              projectId="stall"
              projectTitle="Saturday stall"
              tickets={stallTickets}
            />
            <p className="mt-2 text-[12px] leading-relaxed text-faint">
              “n under it” means the holder split that ticket and offered the
              pieces — open it to see them.
            </p>
          </div>
        )}
      </Page>
    </Workspace>
  );
}

/* =========================================================
   Ticket screen — You's setup or Lea's covers
   ========================================================= */

export function TicketScreen() {
  const s = useStore();
  if (s.org === 'energy') return <EnergyTicketScreen />;
  return <RiverTicketScreen />;
}

function RiverTicketScreen() {
  const s = useStore();
  const t = ticketsData[s.ticketId as RiverTicketId] ?? ticketsData.covers;
  const isSetup = t.id === 'setup';
  const sub = subCoversRow(s.subCovers);
  const asView: TicketView = {
    id: t.id,
    title: t.title,
    who: t.dri ?? 'You',
    state: 'doing',
    projectId: 'stall',
    projectTitle: 'Saturday stall',
  };
  const split = () => {
    s.openThread('agent');
    s.sendMsg('agent', {
      id: `sp${Date.now()}`,
      from: 'you',
      text: 'Jun, could you print the Saturday cover rota?',
    });
    setTimeout(() => s.draftSubTicket(), 900);
  };

  return (
    <Workspace>
      <Page kicker="Ticket · Saturday stall" wide>
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
          Approved by Sam · due {t.due} · why you: {t.why.toLowerCase()}
        </p>

        <Card className="mb-4 p-0" delay={1}>
          <div className="border-b border-hair px-5 py-3">
            <Kicker>Draft — already written, yours to correct</Kicker>
          </div>
          <div className="px-5 py-4">
            <textarea
              defaultValue={
                isSetup
                  ? 'One page: open at 7:45, keys with Maya, cash box setup, grower list and prices, close-down list.'
                  : 'Hi neighbours — Saturday needs two more hands so it never depends on one person.\n\nCould you cover one Saturday a month?\n\n1. ____\n2. ____'
              }
              rows={6}
              className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none"
            />
          </div>
        </Card>

        {!isSetup && (
          <div className="rise-2 mb-5">
            <ChildList
              parent={asView}
              rows={sub ? [sub] : []}
              mine
              onSplit={s.subCovers === 'none' ? split : undefined}
              splitLabel="Split it — ask Jun to print the rota"
            />
            {s.subCovers === 'drafted' && (
              <p className="mt-2 text-[12.5px] text-sub">
                The draft is in your Personal Assistant — offer it to Jun from
                there.{' '}
                <button
                  type="button"
                  className="font-medium text-ink underline decoration-hair underline-offset-4"
                  onClick={() => s.openThread('agent')}
                >
                  Open it →
                </button>
              </p>
            )}
          </div>
        )}

        <div className="rise-2 flex flex-wrap gap-2">
          {isSetup ? (
            <Button onClick={s.finishSetup}>Mark done</Button>
          ) : (
            <Button onClick={s.confirmCoversDone}>Mark done</Button>
          )}
          <Button variant="ghost" onClick={() => s.go('my')}>
            Later
          </Button>
        </div>

        <p className="rise-3 mt-6 max-w-md text-[13px] leading-relaxed text-faint">
          {isSetup
            ? 'A card is one door onto the work; saying “done” where you already talk is another. Both end in the same log.'
            : 'Or just say it is done in “Saturday stall” — the agent drafts the done with the receipt, and you one-tap it here.'}
        </p>
      </Page>
    </Workspace>
  );
}

/* =========================================================
   Offer screen (You — the setup ticket)
   ========================================================= */

export function OfferScreen() {
  const s = useStore();
  return (
    <Workspace>
      <Page kicker="Offer · from Sam" wide>
        <div className="mx-auto max-w-md pt-6 text-center">
          <div className="rise mx-auto mb-5 w-fit">
            <Avatar name="Sam" size="lg" />
          </div>
          <h1 className="rise text-[24px] font-semibold leading-snug tracking-[-0.03em]">
            Sam is asking you to take one piece of work
          </h1>
          <p className="rise-1 mt-3 text-[15px] leading-relaxed text-sub">
            Write the Saturday setup so someone else could run it. One page, by
            14 Jun. If pay should come with it, say so to Sam in the room — the
            agent remembers.
          </p>
          <Card className="rise-2 mt-6 p-4 text-left">
            <Row label="Under project" value="Saturday stall — Sam" />
            <Row label="Due" value="14 Jun" />
            <Row label="If you accept" value="You are DRI of this piece only" />
          </Card>
          <div className="rise-3 mt-6 flex justify-center gap-2.5">
            <Button onClick={s.acceptSetup}>Accept</Button>
            <Button variant="outline" onClick={s.declineSetup}>
              Not now
            </Button>
          </div>
        </div>
      </Page>
    </Workspace>
  );
}

'use client';

import { useState } from 'react';
import { Avatar, Card, Chip, Kicker } from '@/components/primitives';
import { Page, Workspace } from '@/components/workspace';
import {
  energyOrg,
  personaList,
  projectsData,
  space,
  type Health,
  type OrgId,
  type PersonaId,
  type Proposal,
} from '@/lib/data';
import { useStore, PAY_LEA_ID, PAY_ROGERIO_ID } from '@/lib/store';
import { CurrencyRow } from './org';
import { HealthCard } from './work-bits';

type HeldWork = {
  kind: 'project' | 'ticket';
  title: string;
  orgId: OrgId;
  org: string;
  due?: string;
  go?: 'project' | 'ticket';
  id?: string;
};

type PastWork = {
  kind: 'project' | 'ticket';
  title: string;
  org: string;
  when: string;
};

type RecentDecision = {
  id: string;
  title: string;
  state: string;
  when: string;
  org: string;
  orgId: OrgId;
};

type ProfileData = {
  name: string;
  role: string;
  since: string;
  orgs: string[];
  currencies: { symbol: string; name: string; amount: string }[];
  isShaper: boolean;
  isDri: boolean;
  decisions: RecentDecision[];
  current: HeldWork[];
  past: PastWork[];
  health: Health;
};

const RIVER = space.name;
const ENERGY = energyOrg.space.name;

function decisionTitle(p: Proposal): string {
  return p.title.replace(/^Approve project:\s*/, '').replace(/^Confirm\s+/, '');
}

function asDecisions(
  list: Proposal[],
  orgId: OrgId,
  org: string,
): RecentDecision[] {
  return list.slice(0, 5).map((p) => ({
    id: p.id,
    title: decisionTitle(p),
    state: p.state === 'open' ? 'open' : `${p.state}`,
    when: p.state === 'open' ? 'open' : p.decided ?? '',
    org,
    orgId,
  }));
}

function healthOf(label: Health['label'], pct: number, text: string): Health {
  return { label, pct, text };
}

function energySlice(
  s: ReturnType<typeof useStore>,
  persona: PersonaId,
): ProfileData {
  const rogerioPaid =
    s.eProposals.find((p) => p.id === PAY_ROGERIO_ID)?.state === 'passed';
  const rogerioAmount = (
    s.eProposals.find((p) => p.id === PAY_ROGERIO_ID)?.amount ?? 0
  ).toLocaleString();
  const kwh = (n: string) => ({
    symbol: 'KWH',
    name: 'Tokenised energy credits',
    amount: n,
  });

  switch (persona) {
    case 'lea':
      return {
        name: 'Rogerio',
        role: 'Member · Ticket DRI',
        since: 'since 2024',
        orgs: [ENERGY],
        currencies: [
          kwh('42,000 kWh'),
          ...(rogerioPaid
            ? [
                {
                  symbol: 'EURC',
                  name: 'Euro Coin',
                  amount: rogerioAmount,
                },
              ]
            : []),
        ],
        isShaper: false,
        isDri: true,
        decisions: [],
        current: [
          ...(s.eMuni !== 'done'
            ? [
                {
                  kind: 'ticket' as const,
                  title: 'Onboard two Portuguese municipalities',
                  orgId: 'energy' as const,
                  org: ENERGY,
                  due: '30 Jun',
                  go: 'ticket' as const,
                  id: 'e-muni',
                },
              ]
            : []),
          {
            kind: 'ticket',
            title: 'Coopérnico quarterly notes',
            orgId: 'energy',
            org: ENERGY,
          },
        ],
        past: [
          ...(s.eMuni === 'done'
            ? [
                {
                  kind: 'ticket' as const,
                  title: 'Onboard two Portuguese municipalities',
                  org: ENERGY,
                  when: 'today',
                },
              ]
            : []),
          {
            kind: 'ticket',
            title: 'Onboarding for 4 Portuguese communities',
            org: ENERGY,
            when: '2025',
          },
        ],
        health: healthOf(
          'Reliable',
          86,
          'Four communities onboarded, four still producing. Every ticket he accepted ended done, with a receipt — and when a council stalls he says so in the room the same day, not at the review.',
        ),
      };
    case 'sam':
      return {
        name: 'Pedro',
        role: 'Project DRI',
        since: 'since 2023',
        orgs: [ENERGY],
        currencies: [
          kwh('118,000 kWh'),
          { symbol: 'EURC', name: 'Euro Coin', amount: '1,200' },
        ],
        isShaper: false,
        isDri: true,
        decisions: [],
        current: [
          {
            kind: 'project',
            title: energyOrg.projects.iberia.title,
            orgId: 'energy',
            org: ENERGY,
            due: energyOrg.projects.iberia.review,
            go: 'project',
            id: 'iberia',
          },
        ],
        past: [
          {
            kind: 'project',
            title: 'Signed the Coopérnico partnership',
            org: ENERGY,
            when: 'Jan 2026',
          },
        ],
        health: healthOf(
          'Steady',
          78,
          'The pilots have held under him through two grant cycles. Offers work instead of assigning it.',
        ),
      };
    case 'maya':
      return {
        name: 'Alex',
        role: 'Shaper · Founder',
        since: 'founded 2022',
        orgs: [ENERGY],
        currencies: [kwh('260,000 kWh')],
        isShaper: true,
        isDri: false,
        decisions: asDecisions(s.eProposals, 'energy', ENERGY),
        current: [],
        past: [
          {
            kind: 'project',
            title: 'Founded Hypha Energy with Edgar and Zekeriya',
            org: ENERGY,
            when: '2022',
          },
        ],
        health: healthOf(
          'Consistent',
          88,
          'Every direction version he confirmed matches what the org then did — four white papers promised, four published. Rejects drafts as often as he confirms them.',
        ),
      };
    case 'eli':
      return {
        name: 'Nina',
        role: 'Investor · watches',
        since: 'since 2025',
        orgs: [ENERGY],
        currencies: [],
        isShaper: false,
        isDri: false,
        decisions: [],
        current: [],
        past: [],
        health: healthOf(
          'Observer',
          50,
          'No work history — investors watch, they do not hold. She funded the sandbox and sees everything on the Overview.',
        ),
      };
    default:
      return {
        name: s.profile.name || 'You',
        role: 'Member',
        since: 'joined from the Ameland pilot',
        orgs: [ENERGY],
        currencies: [kwh(s.eSummary === 'done' ? '1,200 kWh' : '800 kWh')],
        isShaper: false,
        isDri: s.eSummary !== 'done',
        decisions: [],
        current:
          s.eSummary !== 'done'
            ? [
                {
                  kind: 'ticket',
                  title: 'Write the Ameland pilot summary for new communities',
                  orgId: 'energy',
                  org: ENERGY,
                  due: '15 Jul',
                  go: 'ticket',
                  id: 'e-summary',
                },
              ]
            : [],
        past: [
          ...(s.eSummary === 'done'
            ? [
                {
                  kind: 'ticket' as const,
                  title: 'Write the Ameland pilot summary for new communities',
                  org: ENERGY,
                  when: 'today',
                },
              ]
            : []),
          {
            kind: 'ticket',
            title: 'Household in the Ameland sandbox pilot',
            org: ENERGY,
            when: '2026',
          },
        ],
        health: healthOf(
          'New',
          s.eSummary === 'done' ? 48 : 36,
          s.eSummary === 'done'
            ? 'First ticket accepted and done, same week. One receipt is not a track record — but it is exactly how one starts.'
            : 'One ticket held, none finished yet. Finish it and the record starts writing itself.',
        ),
      };
  }
}

function riverSlice(
  s: ReturnType<typeof useStore>,
  persona: PersonaId,
): ProfileData {
  const leaPaid =
    s.proposals.find((p) => p.id === PAY_LEA_ID)?.state === 'passed';
  const leaAmountN = s.proposals.find((p) => p.id === PAY_LEA_ID)?.amount ?? 0;

  switch (persona) {
    case 'lea':
      return {
        name: 'Lea',
        role: 'Member · Ticket DRI',
        since: 'since March',
        orgs: [RIVER],
        currencies: [
          { symbol: 'RIVER', name: 'River Commons currency', amount: '380' },
          {
            symbol: 'USDC',
            name: 'USD Coin',
            amount: leaPaid ? (80 + leaAmountN).toLocaleString() : '80',
          },
        ],
        isShaper: false,
        isDri: true,
        decisions: [],
        current: [
          ...(s.covers !== 'done'
            ? [
                {
                  kind: 'ticket' as const,
                  title: 'Find two neighbours who can cover a Saturday',
                  orgId: 'river' as const,
                  org: RIVER,
                  due: '7 Jun',
                  go: 'ticket' as const,
                  id: 'covers',
                },
              ]
            : []),
          {
            kind: 'ticket',
            title: 'Teach the cash-box count',
            orgId: 'river',
            org: RIVER,
          },
        ],
        past: [
          ...(s.covers === 'done'
            ? [
                {
                  kind: 'ticket' as const,
                  title: 'Find two neighbours who can cover a Saturday',
                  org: RIVER,
                  when: 'today',
                },
              ]
            : []),
          {
            kind: 'ticket',
            title: 'Hosted the Saturday stall 9 times',
            org: RIVER,
            when: 'since March',
          },
          {
            kind: 'ticket',
            title: 'Helped agree grower prices',
            org: RIVER,
            when: 'May',
          },
        ],
        health: healthOf(
          'Reliable',
          88,
          'Nine of nine Saturdays she said she would host, she hosted. Every ticket she accepted ended done, with a receipt. When she declines, she says why.',
        ),
      };
    case 'sam':
      return {
        name: 'Sam',
        role: 'Shaper · Project DRI',
        since: 'since March',
        orgs: [RIVER],
        currencies: [
          { symbol: 'RIVER', name: 'River Commons currency', amount: '640' },
          { symbol: 'USDC', name: 'USD Coin', amount: '60' },
        ],
        isShaper: true,
        isDri: true,
        decisions: asDecisions(s.proposals, 'river', RIVER),
        current: [
          {
            kind: 'project',
            title: projectsData.stall.title,
            orgId: 'river',
            org: RIVER,
            due: s.review === 'extended' ? '1 Sep' : projectsData.stall.review,
            go: 'project',
            id: 'stall',
          },
          {
            kind: 'ticket',
            title: 'Renew the market pitch licence',
            orgId: 'river',
            org: RIVER,
            due: '30 Jun',
          },
        ],
        past: [
          {
            kind: 'project',
            title: 'Approved as project DRI',
            org: RIVER,
            when: '12 May',
          },
        ],
        health: healthOf(
          'Steady',
          80,
          'The stall has held every week under him. Offers work instead of assigning it.',
        ),
      };
    case 'maya':
      return {
        name: 'Maya',
        role: 'Shaper · Founder',
        since: 'founded March',
        orgs: [RIVER],
        currencies: [
          { symbol: 'RIVER', name: 'River Commons currency', amount: '720' },
        ],
        isShaper: true,
        isDri: true,
        decisions: asDecisions(s.proposals, 'river', RIVER),
        current: [
          {
            kind: 'project',
            title: projectsData.currency.title,
            orgId: 'river',
            org: RIVER,
            due: projectsData.currency.review,
            go: 'project',
            id: 'currency',
          },
        ],
        past: [
          {
            kind: 'project',
            title: 'Founded River Commons',
            org: RIVER,
            when: 'March',
          },
        ],
        health: healthOf(
          'Consistent',
          90,
          'Every direction version she confirmed matches what the org then actually did — said and done line up. She rejects drafts as often as she confirms them.',
        ),
      };
    case 'eli':
      return {
        name: 'Eli',
        role: 'Investor · watches',
        since: 'since April',
        orgs: [RIVER],
        currencies: [],
        isShaper: false,
        isDri: false,
        decisions: [],
        current: [],
        past: [],
        health: healthOf(
          'Observer',
          50,
          'No work history — investors watch, they do not hold. He sees everything on the Overview.',
        ),
      };
    default:
      return {
        name: s.profile.name || 'You',
        role: 'Member · new',
        since: 'joined today',
        orgs: [RIVER],
        currencies: [
          {
            symbol: 'RIVER',
            name: 'River Commons currency',
            amount: s.setup === 'done' ? '25' : '0',
          },
        ],
        isShaper: false,
        isDri: s.setup === 'accepted',
        decisions: [],
        current:
          s.setup === 'accepted'
            ? [
                {
                  kind: 'ticket',
                  title:
                    'Write the Saturday setup so someone else could run it',
                  orgId: 'river',
                  org: RIVER,
                  due: '14 Jun',
                  go: 'ticket',
                  id: 'setup',
                },
              ]
            : [],
        past: [
          ...(s.setup === 'done'
            ? [
                {
                  kind: 'ticket' as const,
                  title:
                    'Write the Saturday setup so someone else could run it',
                  org: RIVER,
                  when: 'today',
                },
              ]
            : []),
          {
            kind: 'ticket',
            title: 'Joined River Commons',
            org: RIVER,
            when: 'today',
          },
        ],
        health: healthOf(
          'New',
          s.setup === 'done' ? 48 : 32,
          s.setup === 'done'
            ? 'First ticket accepted and done, same week. One receipt is not a track record — but it is exactly how one starts.'
            : 'No history yet. Accept a ticket, finish it, and the record starts writing itself.',
        ),
      };
  }
}

function mergeYou(river: ProfileData, energy: ProfileData): ProfileData {
  return {
    name: river.name,
    role: 'Member',
    since: 'in River Commons and Hypha Energy',
    orgs: [RIVER, ENERGY],
    currencies: [...river.currencies, ...energy.currencies],
    isShaper: false,
    isDri: river.isDri || energy.isDri,
    decisions: [],
    current: [...river.current, ...energy.current],
    past: [...river.past, ...energy.past],
    health: healthOf(
      river.health.label,
      Math.round((river.health.pct + energy.health.pct) / 2),
      'New in both orgs. Trust is built from receipts — finish the tickets you hold and the record starts writing itself.',
    ),
  };
}

const GUESTS: Record<
  string,
  {
    role: string;
    since: string;
    health: Health;
    isShaper?: boolean;
    isDri?: boolean;
    current?: HeldWork[];
    past?: PastWork[];
  }
> = {
  Jun: {
    role: 'Project DRI',
    since: 'since April',
    isDri: true,
    current: [
      {
        kind: 'project',
        title: projectsData.growers.title,
        orgId: 'river',
        org: RIVER,
        due: projectsData.growers.review,
        go: 'project',
        id: 'growers',
      },
    ],
    health: healthOf(
      'Steady',
      76,
      'Holds grower onboarding. Offers work instead of assigning it — every grower who said yes still shows up.',
    ),
  },
  Suzana: {
    role: 'Project DRI',
    since: 'since 2025',
    isDri: true,
    current: [
      {
        kind: 'project',
        title: energyOrg.projects.playbook.title,
        orgId: 'energy',
        org: ENERGY,
        go: 'project',
        id: 'playbook',
      },
    ],
    health: healthOf(
      'Steady',
      74,
      'Holds the community onboarding playbook. Offers the pieces; the record is the receipts.',
    ),
  },
  Rowan: {
    role: 'Project DRI',
    since: 'since 2024',
    isDri: true,
    health: healthOf(
      'Reliable',
      84,
      'On-call for Ameland EMS. Tickets he accepts end done, with a receipt.',
    ),
  },
  Marcus: {
    role: 'Project DRI',
    since: 'since 2024',
    isDri: true,
    current: [
      {
        kind: 'project',
        title: energyOrg.projects.islands.title,
        orgId: 'energy',
        org: ENERGY,
        go: 'project',
        id: 'islands',
      },
    ],
    health: healthOf(
      'Steady',
      80,
      'Holds island grids. The Ameland sandbox closed with receipts, not slides.',
    ),
  },
  Edgar: {
    role: 'Shaper',
    since: 'since 2022',
    isShaper: true,
    health: healthOf(
      'Consistent',
      86,
      'Agrees or rejects in the open. Money and direction move only when the three Shapers do.',
    ),
  },
  Zekeriya: {
    role: 'Shaper',
    since: 'since 2023',
    isShaper: true,
    health: healthOf(
      'Consistent',
      85,
      'Agrees or rejects in the open. The record is the vote, not a sidebar.',
    ),
  },
  Rafi: {
    role: 'Member',
    since: 'at the door',
    health: healthOf(
      'New',
      30,
      'Ran the market office six years. The weekday hall is waiting for someone who can sign a licence.',
    ),
  },
  Priya: {
    role: 'Member',
    since: 'since April',
    past: [
      {
        kind: 'ticket',
        title: 'Voucher design',
        org: RIVER,
        when: '2 May',
      },
    ],
    health: healthOf(
      'Reliable',
      72,
      'The voucher design is done, paid by a proposal. One receipt, on time.',
    ),
  },
  Tom: {
    role: 'Member',
    since: 'since April',
    isDri: true,
    current: [
      {
        kind: 'ticket',
        title: 'Hold the cash box',
        orgId: 'river',
        org: RIVER,
      },
    ],
    health: healthOf(
      'Reliable',
      75,
      'Holds the cash box ticket under the currency project, and splits the pieces under it.',
    ),
  },
  Surya: {
    role: 'Project DRI',
    since: 'since 2024',
    isDri: true,
    health: healthOf(
      'Steady',
      77,
      'Holds the tech work under Energy. Offers the pieces; pay moves by proposal.',
    ),
  },
  Inês: {
    role: 'Member',
    since: 'since 2025',
    past: [
      {
        kind: 'ticket',
        title: 'Letter of intent — Beja',
        org: ENERGY,
        when: 'done',
      },
    ],
    health: healthOf(
      'New',
      42,
      'The Beja letter of intent is done. First receipt in this org.',
    ),
  },
};

function guestProfile(
  s: ReturnType<typeof useStore>,
  org: OrgId,
  name: string,
): ProfileData {
  const g = GUESTS[name];
  const orgName = org === 'energy' ? ENERGY : RIVER;
  const shaper = Boolean(g?.isShaper);
  return {
    name,
    role: g?.role ?? 'Member',
    since: g?.since ?? 'in this org',
    orgs: [orgName],
    currencies: [],
    isShaper: shaper,
    isDri: Boolean(g?.isDri),
    decisions: shaper
      ? asDecisions(org === 'energy' ? s.eProposals : s.proposals, org, orgName)
      : [],
    current: g?.current ?? [],
    past: g?.past ?? [],
    health:
      g?.health ??
      healthOf(
        'Member',
        50,
        `${name} is in this org. The record fills in as they hold and finish work.`,
      ),
  };
}

function profileFor(
  s: ReturnType<typeof useStore>,
  name: string | null,
): ProfileData {
  const youName = s.profile.name || 'You';
  const mine = name == null;
  const id =
    name == null || name === 'You' || name === youName
      ? name == null
        ? s.persona
        : ('you' as PersonaId)
      : personaList(s.org).find((p) => p.name === name)?.id;

  if (id === 'you' || (mine && s.persona === 'you')) {
    return mergeYou(riverSlice(s, 'you'), energySlice(s, 'you'));
  }
  if (id) return s.org === 'energy' ? energySlice(s, id) : riverSlice(s, id);
  return guestProfile(s, s.org, name ?? youName);
}

function WorkRow({
  kind,
  title,
  org,
  meta,
  onOpen,
}: {
  kind: string;
  title: string;
  org: string;
  meta?: string;
  onOpen?: () => void;
}) {
  const inner = (
    <>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <Chip className="px-2 py-0.5 text-[10px]">{kind}</Chip>
          <span className="text-[12px] text-faint">{org}</span>
        </span>
        <span className="mt-1 block text-[14px] font-medium">{title}</span>
      </span>
      {meta && <span className="shrink-0 text-[12px] text-faint">{meta}</span>}
    </>
  );
  if (!onOpen) {
    return (
      <div className="flex items-baseline justify-between gap-4 border-b border-hair py-2.5 last:border-0">
        {inner}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-baseline justify-between gap-4 border-b border-hair py-2.5 text-left last:border-0 hover:text-ink"
    >
      {inner}
    </button>
  );
}

export function ProfileScreen() {
  const s = useStore();
  const mine = !s.viewingProfile;
  const data = profileFor(s, s.viewingProfile);
  const [showPast, setShowPast] = useState(false);

  const openHeld = (w: HeldWork) => {
    if (!w.go || !w.id) return;
    if (w.orgId !== s.org) {
      s.switchOrg(w.orgId);
      return;
    }
    if (w.go === 'project') s.openProject(w.id as 'stall');
    else s.openTicket(w.id as 'covers');
  };

  const openDecision = (d: RecentDecision) => {
    if (d.orgId !== s.org) {
      s.switchOrg(d.orgId);
      return;
    }
    s.openProposal(d.id);
  };

  return (
    <Workspace>
      <Page
        kicker={
          mine
            ? 'Your activity across organisations'
            : 'Who they are across the network'
        }
        title={mine ? 'My Profile' : data.name}
      >
        {!mine && (
          <button
            type="button"
            onClick={() => s.go('my')}
            className="mb-5 text-[13px] font-medium text-sub transition-colors hover:text-ink"
          >
            ← Back
          </button>
        )}
        <div className="space-y-2.5">
          <Card className="p-5">
            <div className="flex items-center gap-4">
              <Avatar name={data.name} size="lg" />
              <div>
                <p className="text-[19px] font-semibold tracking-[-0.02em]">
                  {data.name}
                </p>
                <p className="text-[13px] text-sub">
                  {data.role} · {data.since}
                </p>
                <p className="mt-1 text-[12px] text-faint">
                  {data.orgs.join(' · ')}
                </p>
              </div>
            </div>
          </Card>

          <HealthCard
            delay={1}
            health={data.health}
            kicker={mine ? 'Your health' : 'Their health'}
          />

          <Card className="p-5" delay={1}>
            <Kicker>{mine ? 'What you hold' : 'What they hold'}</Kicker>
            {data.currencies.length === 0 ? (
              <p className="mt-2 text-[14px] text-sub">
                No org currency — watching, not holding.
              </p>
            ) : (
              <div className="mt-2">
                {data.currencies.map((c) => (
                  <CurrencyRow
                    key={`${c.symbol}-${c.amount}`}
                    symbol={c.symbol}
                    name={c.name}
                    amount={c.amount}
                  />
                ))}
              </div>
            )}
          </Card>

          {data.isShaper && data.decisions.length > 0 && (
            <Card className="p-5" delay={2}>
              <Kicker>Recent decisions</Kicker>
              <div className="mt-2">
                {data.decisions.map((d) => (
                  <WorkRow
                    key={`${d.orgId}-${d.id}`}
                    kind={d.state}
                    title={d.title}
                    org={d.org}
                    meta={d.when}
                    onOpen={() => openDecision(d)}
                  />
                ))}
              </div>
            </Card>
          )}

          {data.isDri && (
            <Card className="p-5" delay={2}>
              <Kicker>
                {mine ? 'What you hold now' : 'What they hold now'}
              </Kicker>
              {data.current.length === 0 ? (
                <p className="mt-2 text-[14px] text-sub">
                  Nothing open — earlier work is below.
                </p>
              ) : (
                <div className="mt-2">
                  {data.current.map((w) => (
                    <WorkRow
                      key={`${w.org}-${w.title}`}
                      kind={w.kind}
                      title={w.title}
                      org={w.org}
                      meta={w.due ? `Due ${w.due}` : undefined}
                      onOpen={w.go ? () => openHeld(w) : undefined}
                    />
                  ))}
                </div>
              )}
              {data.past.length > 0 && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setShowPast((v) => !v)}
                    className="text-[13px] font-medium text-sub transition-colors hover:text-ink"
                  >
                    {showPast
                      ? 'Hide earlier work'
                      : `Earlier work (${data.past.length})`}
                  </button>
                  {showPast && (
                    <div className="mt-1">
                      {data.past.map((w) => (
                        <WorkRow
                          key={`${w.org}-${w.title}`}
                          kind={w.kind}
                          title={w.title}
                          org={w.org}
                          meta={w.when}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {!data.isDri && data.past.length > 0 && (
            <Card className="p-5" delay={2}>
              <Kicker>Earlier work</Kicker>
              <div className="mt-2">
                {data.past.map((w) => (
                  <WorkRow
                    key={`${w.org}-${w.title}`}
                    kind={w.kind}
                    title={w.title}
                    org={w.org}
                    meta={w.when}
                  />
                ))}
              </div>
            </Card>
          )}
        </div>
      </Page>
    </Workspace>
  );
}

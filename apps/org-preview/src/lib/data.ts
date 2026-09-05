export type Receipt = {
  label: string;
  go: 'thread' | 'proposal' | 'project';
  id: string;
};

export type MsgCardType =
  | 'payment-draft'
  | 'done-draft'
  | 'strategy-draft'
  | 'project-draft'
  | 'ticket-draft'
  | 'sub-ticket-draft'
  | 'e-done-draft';

export type Msg = {
  id: string;
  from: string; // 'you' | 'agent' | display name
  text: string;
  system?: boolean;
  card?: MsgCardType;
  receipts?: Receipt[];
};

export const space = {
  name: 'River Commons',
  short: 'RC',
  established: 'March 2026',
  founder: 'Maya',
  shapers: ['Maya', 'Sam'],
  members: ['Maya', 'Sam', 'Lea', 'Jun', 'Noor', 'Tom', 'Priya'],
  purpose: 'A street food hub from people we know, not a supermarket.',
  audience: 'Neighbours, and the three growers we already buy from.',
  willNot: 'No restaurant. No brand money.',
  working: 'Two days a week, five growers, hall paid without a whip-round.',
};

/**
 * L3 — direction. Four reserved artifacts, each versioned on its own and
 * confirmed by a Shaper: mission (why), vision (where), objectives (what,
 * soon), strategy (how). Together they replace the old single "brief".
 */
export type DirectionVersion = {
  version: number;
  confirmedBy: string;
  confirmedOn: string;
};

export type DirectionKind = 'mission' | 'vision' | 'objectives' | 'strategy';

/**
 * A proof is an L2 ledger fact that bears on an L3 line — a proposal that
 * passed, a project that closed, a line someone said in a room. It links to
 * the receipt when there is one. Never a claim without a place to check it.
 */
export type Proof = {
  when: string;
  what: string;
  go?: Receipt['go'];
  id?: string;
};

/** one line of objectives or strategy — the sentence, and what backs it */
export type DirectionLine = {
  text: string;
  /** the agent's one-line read against the ledger — where this stands today */
  read?: string;
  proofs: Proof[];
};

/** one confirmed version — what changed, who confirmed, when */
export type DirectionHistory = DirectionVersion & { change: string };

type Artifact = DirectionVersion & {
  /** the full document behind the card — a paragraph or two, at most */
  body: string[];
  history: DirectionHistory[];
};

export type Direction = {
  mission: Artifact & { text: string; proofs: Proof[] };
  vision: Artifact & { text: string; proofs: Proof[] };
  /** one short sentence each — the timing is part of the sentence; a met
   *  objective is simply dropped in the next version, never struck through */
  objectives: Artifact & { text: string; items: DirectionLine[] };
  /** one bullet per strategic bet */
  strategy: Artifact & { text: string; lines: DirectionLine[] };
};

export const direction: Direction = {
  mission: {
    version: 1,
    confirmedBy: 'Maya',
    confirmedOn: 'March',
    text: 'A street food hub from people we know, not a supermarket — for neighbours, and the three growers we already buy from.',
    body: [
      'We already buy from three growers — Ana, Tomasz and the Ferreira family. The hub exists so the whole street can do the same without a supermarket in between, and so the growers see the money the same week.',
      'It is a stall, then a hall, run by people who live here. Not a restaurant, not a marketplace app, not a brand’s community programme.',
    ],
    proofs: [
      {
        when: 'since March',
        what: 'Every USDC paid out so far went to a grower or a neighbour who hosted — none to a middleman.',
        go: 'proposal',
        id: 'lea-saturdays',
      },
      {
        when: '2 May',
        what: 'A drinks brand offered 2,000 USDC. Both Shapers rejected it.',
        go: 'proposal',
        id: 'sponsor',
      },
      {
        when: 'April',
        what: 'The three growers from the mission are the three selling at the stall.',
        go: 'project',
        id: 'growers',
      },
    ],
    history: [
      {
        version: 1,
        confirmedBy: 'Maya',
        confirmedOn: 'March',
        change:
          'Written the day the space opened — Maya alone, in her own chat, from what she told the agent at creation.',
      },
    ],
  },
  vision: {
    version: 1,
    confirmedBy: 'Maya',
    confirmedOn: 'March',
    text: 'A neighbourhood that feeds itself two days a week: five growers, a hall paid without a whip-round, every grower paid the week they sell.',
    body: [
      'Two days a week means the Saturday stall and a weekday hall. Five growers is what a hall can carry without a van. “Paid the week they sell” is the whole point — no invoices, no waiting, no one fronting the money.',
    ],
    proofs: [
      {
        when: 'since March',
        what: 'Saturday stall every week — one of the two days is real.',
        go: 'project',
        id: 'stall',
      },
      {
        when: 'May',
        what: 'Three growers selling of the five. Two visits booked.',
        go: 'project',
        id: 'growers',
      },
      {
        when: '2 Jun',
        what: 'Lea paid 80 USDC for four Saturdays — the week after the fourth.',
        go: 'proposal',
        id: 'lea-saturdays',
      },
    ],
    history: [
      {
        version: 1,
        confirmedBy: 'Maya',
        confirmedOn: 'March',
        change: 'Confirmed with the mission, the same day.',
      },
    ],
  },
  objectives: {
    version: 3,
    confirmedBy: 'Maya',
    confirmedOn: '14 May',
    text: 'This season: Saturday every week, a weekday hall by August, and five growers paid the week they sell.',
    body: [
      'What we mean to have done soon. One sentence each, with the timing inside it. When one is met, it leaves the list in the next version — the proof stays here.',
    ],
    items: [
      {
        text: 'The Saturday stall runs every week, all season.',
        read: 'Holding — every Saturday since March, none missed.',
        proofs: [
          {
            when: '12 May',
            what: 'Saturday stall approved as a project — Sam holds it.',
            go: 'proposal',
            id: 'fund-stall',
          },
          {
            when: '2 Jun',
            what: 'The ledger shows 4 of 4 May stalls happened — Lea paid for hosting them.',
            go: 'proposal',
            id: 'lea-saturdays',
          },
          {
            when: 'May',
            what: 'Sam reviewed on time; three offers answered.',
            go: 'proposal',
            id: 'sam-stipend',
          },
        ],
      },
      {
        text: 'A weekday hall is open before August.',
        proofs: [
          {
            when: 'April',
            what: 'Added after the April Shapers call — the second of the two days.',
            go: 'thread',
            id: 'shapers',
          },
        ],
      },
      {
        text: 'Five growers by autumn, each paid the week they sell.',
        read: '3 of 5 — two visits booked, both paid on time so far.',
        proofs: [
          {
            when: '3 May',
            what: 'Grower onboarding approved — Jun holds it, ends 1 Oct.',
            go: 'proposal',
            id: 'approve-growers',
          },
          {
            when: '2 May',
            what: 'Priya paid 120 USDC the week the voucher design was done.',
            go: 'proposal',
            id: 'pay-priya',
          },
          {
            when: 'May',
            what: 'Three growers selling; the welcome sheet is in progress.',
            go: 'project',
            id: 'growers',
          },
        ],
      },
    ],
    history: [
      {
        version: 1,
        confirmedBy: 'Maya',
        confirmedOn: 'March',
        change: 'Two lines: a stall every Saturday; two more growers.',
      },
      {
        version: 2,
        confirmedBy: 'Maya',
        confirmedOn: 'April',
        change: 'Weekday hall added, from the April Shapers call.',
      },
      {
        version: 3,
        confirmedBy: 'Maya',
        confirmedOn: '14 May',
        change:
          'Growers raised to five with a date, once Grower onboarding was approved. “Two more growers” met and dropped.',
      },
    ],
  },
  strategy: {
    version: 4,
    confirmedBy: 'Maya',
    confirmedOn: '14 May',
    text: 'Small money and many neighbours — the stall pays for the hall, not a grant or a restaurant.',
    body: [
      'How we get there — the bets, and what we say no to. Every project draft and every proposal the agent writes is checked against these lines.',
    ],
    lines: [
      {
        text: 'Small money, many hands — the stall funds the hall, not a grant round.',
        proofs: [
          {
            when: '2 Jun',
            what: 'Two payments this month, 80 and 60 USDC — small, on time, from the stall’s takings.',
            go: 'proposal',
            id: 'lea-saturdays',
          },
          {
            when: 'May',
            what: 'The 4,200 USDC grant is the only outside money. It only moves through proposals.',
            go: 'proposal',
            id: 'sam-stipend',
          },
        ],
      },
      {
        text: 'No restaurant. Two days a week, not a fleet.',
        proofs: [
          {
            when: '25 Apr',
            what: 'A second-hand van at 3,500 USDC — rejected. This line was written the week after.',
            go: 'proposal',
            id: 'van',
          },
        ],
      },
      {
        text: 'RIVER vouchers keep value with the growers, not the middle.',
        proofs: [
          {
            when: '20 Apr',
            what: 'RIVER currency launch approved — Maya holds it, ends 1 Sep.',
            go: 'proposal',
            id: 'approve-currency',
          },
          {
            when: '2 May',
            what: 'Voucher design done and paid.',
            go: 'proposal',
            id: 'pay-priya',
          },
        ],
      },
    ],
    history: [
      {
        version: 1,
        confirmedBy: 'Maya',
        confirmedOn: 'March',
        change: 'One line: small money, many hands.',
      },
      {
        version: 2,
        confirmedBy: 'Maya',
        confirmedOn: 'April',
        change:
          '“Two days a week, not a fleet” — the week after the van was rejected.',
      },
      {
        version: 3,
        confirmedBy: 'Maya',
        confirmedOn: '20 Apr',
        change: 'RIVER vouchers line, with the currency project.',
      },
      {
        version: 4,
        confirmedBy: 'Maya',
        confirmedOn: '14 May',
        change: 'Wording tightened; “the stall funds the hall” made explicit.',
      },
    ],
  },
};

/** The one direction change that moves in the demo — a strategy line. */
export const strategyDraft = {
  version: 5,
  source: 'Tuesday’s call',
  added: 'We do not take the brand sponsorship. Not this year.',
  line: {
    text: 'We do not take the brand sponsorship. Not this year.',
    proofs: [
      {
        when: '2 May',
        what: 'The 2,000 USDC sponsorship was rejected by both Shapers.',
        go: 'proposal',
        id: 'sponsor',
      },
      {
        when: 'Tuesday',
        what: 'Said on the Shapers call; the agent drafted the line from the transcript.',
        go: 'thread',
        id: 'shapers',
      },
    ],
  } as DirectionLine,
  history: {
    version: 5,
    confirmedBy: 'Maya',
    confirmedOn: 'today',
    change: '“No brand sponsorship” put in writing, from Tuesday’s call.',
  } as DirectionHistory,
};

export const personas = [
  {
    id: 'you',
    name: 'You',
    role: 'New person',
    line: 'First login. No profile yet.',
  },
  {
    id: 'lea',
    name: 'Lea',
    role: 'Ticket DRI',
    line: 'Holds one ticket on Saturday stall.',
  },
  {
    id: 'sam',
    name: 'Sam',
    role: 'Project DRI',
    line: 'Holds Saturday stall.',
  },
  {
    id: 'maya',
    name: 'Maya',
    role: 'Shaper',
    line: 'Direction, projects, money.',
  },
  {
    id: 'eli',
    name: 'Eli',
    role: 'Investor',
    line: 'Put in the grant. Looks in.',
  },
] as const;

export type PersonaId = (typeof personas)[number]['id'];

export type OrgId = 'river' | 'energy';

/**
 * Money lives in two places only: proposals and profiles. Tickets and projects
 * carry no numbers — pay is agreed in chat between the person holding the work
 * and the person above them, and the agent remembers the line.
 * River Commons pays in USDC, Hypha Energy in EURC.
 */
export const USD = 'USDC';
export const EUR = 'EURC';
export function unitFor(org: OrgId): string {
  return org === 'energy' ? EUR : USD;
}

/** What was agreed in chat for the two tickets whose pay moves in the demo. */
export const agreedPay = {
  river: {
    amount: 150,
    who: 'Lea',
    withWhom: 'Sam',
    room: 'saturday',
    roomName: 'Saturday stall',
    when: '20 May',
    work: 'the Saturday covers',
  },
  energy: {
    amount: 1500,
    who: 'Rogerio',
    withWhom: 'Pedro',
    room: 'e-pilots',
    roomName: 'Pilots',
    when: '4 May',
    work: 'the municipalities',
  },
} as const;

/** The five viewpoints exist in both orgs — different people fill them. */
export function personaList(org: OrgId): readonly PersonaView[] {
  return org === 'energy' ? energyOrg.personas : personas;
}

export function personaName(org: OrgId, id: PersonaId): string {
  return personaList(org).find((p) => p.id === id)?.name ?? 'You';
}

export type RiverProjectId =
  | 'stall'
  | 'weekday'
  | 'growers'
  | 'currency'
  | 'harvest';
export type EnergyProjectId =
  | 'iberia'
  | 'ems'
  | 'islands'
  | 'carbon'
  | 'playbook'
  | 'hardware';
export type ProjectId = RiverProjectId | EnergyProjectId;

/**
 * Work is one tree. A project is a work item with no parent; a ticket sits
 * under a project or under another ticket — any depth. Whoever holds a piece
 * can split it further and offer the pieces.
 */
export type WorkTicketRow = {
  title: string;
  who: string;
  state: 'done' | 'doing' | 'waiting' | 'open';
  stateLabel?: string;
  due?: string;
  /** set on the tickets whose state lives in the store — opens the owner's screen */
  id?: TicketId;
  /** work under this ticket — the person holding it offered these pieces */
  children?: WorkTicketRow[];
};

export type TrailRow = { when: string; what: string; receipt?: string };

/** A project whose story does not move in the demo — both orgs have several. */
/**
 * The agent's read on how something is doing — one position on a
 * red→yellow→green bar and a short "why". Read from the ledger, not vibes.
 */
export type Health = {
  /** 0 = struggling, 100 = healthy */
  pct: number;
  label: string;
  text: string;
};

export type StaticProject = {
  id: ProjectId;
  title: string;
  dri: string | null;
  review: string;
  approved: string | null;
  brief: string;
  from: string;
  tickets: WorkTicketRow[];
  trail: TrailRow[];
  /** absent while nobody holds the project — there is nothing to read yet */
  health?: Health;
};

/** Static halves of the work objects — states live in the store. */
export const projectsData: Record<RiverProjectId, StaticProject> = {
  stall: {
    id: 'stall',
    title: 'Saturday stall',
    dri: 'Sam',
    review: '1 Jun 2026',
    approved: '12 May',
    brief:
      'Run the Saturday stall every week: growers, tables, cash box, and the people to hold it.',
    from: 'Founding chat — funded by proposal, 12 May',
    tickets: [],
    trail: [],
  },
  weekday: {
    id: 'weekday',
    title: 'Weekday hall',
    dri: null,
    review: '1 Aug 2026',
    approved: null,
    brief:
      'Find a weekday hall and hold it: the licence, the deposit, the keys.',
    from: 'Drafted from Jun’s licence question in “Saturday stall”',
    tickets: [],
    trail: [],
  },
  growers: {
    id: 'growers',
    title: 'Grower onboarding',
    dri: 'Jun',
    review: '1 Oct 2026',
    approved: '3 May',
    brief:
      'Five growers by autumn, each paid the week they sell — the visits, the delivery days, the welcome sheet.',
    from: 'Drafted from the Growers room — approved by the Shapers, 3 May',
    tickets: [
      {
        title: 'Visit the two orchards on the hill',
        who: 'Jun',
        state: 'done',
      },
      {
        title: 'Agree a delivery day with the dairy',
        who: 'Noor',
        state: 'doing',
        due: '21 Jun',
        children: [
          {
            title: 'Check the hall fridge holds four crates',
            who: 'Tom',
            state: 'done',
          },
          {
            title: 'Ask the dairy about glass returns',
            who: 'Priya',
            state: 'doing',
            due: '18 Jun',
          },
        ],
      },
      {
        title: 'Print the grower welcome sheet',
        who: 'open',
        state: 'open',
        stateLabel: 'open — needs a DRI',
      },
    ],
    trail: [
      {
        when: '3 May',
        what: 'Approved by the Shapers — Jun as DRI',
        receipt: 'Proposals',
      },
      {
        when: '9 May',
        what: 'Dairy ticket accepted by Noor',
        receipt: '“Growers”',
      },
      {
        when: '2 Jun',
        what: 'Noor split the dairy ticket — Tom took the fridge, Priya the glass',
        receipt: '“Growers”',
      },
      {
        when: '6 Jun',
        what: 'Orchards visited — done, confirmed by Jun',
        receipt: '“Growers”',
      },
    ],
    health: {
      pct: 62,
      label: 'On track, one gap',
      text: 'Two of three growers are lined up and the dairy ticket is moving — Noor split it and both pieces have someone. The gap: the welcome sheet has had no DRI for four weeks, and autumn is the deadline. Nothing paid out yet.',
    },
  },
  currency: {
    id: 'currency',
    title: 'RIVER currency launch',
    dri: 'Maya',
    review: '1 Sep 2026',
    approved: '20 Apr',
    brief:
      'Paper RIVER vouchers earned at the stall, spendable with any grower — the design, the float, and the rules on one page.',
    from: 'Drafted from the founding chat — approved by the Shapers, 20 Apr',
    tickets: [
      {
        title: 'Design the paper vouchers',
        who: 'Priya',
        state: 'done',
      },
      {
        title: 'Stall cash box takes RIVER',
        who: 'Tom',
        state: 'doing',
        due: '28 Jun',
        children: [
          {
            title: 'Make the change float — 200 RIVER',
            who: 'Sam',
            state: 'done',
          },
          {
            title: 'Teach the Saturday hosts the exchange rule',
            who: 'Lea',
            state: 'doing',
            due: '21 Jun',
            children: [
              {
                title: 'One-line card for the cash box lid',
                who: 'Priya',
                state: 'doing',
                due: '20 Jun',
                children: [
                  {
                    title: 'Laminate twenty cards',
                    who: 'Tom',
                    state: 'doing',
                    due: '19 Jun',
                    children: [
                      {
                        title: 'Borrow the school laminator for an evening',
                        who: 'Noor',
                        state: 'done',
                      },
                      {
                        title: 'Buy a pack of A7 pouches',
                        who: 'Tom',
                        state: 'doing',
                        due: '18 Jun',
                      },
                    ],
                  },
                  {
                    title: 'Proofread the wording with Maya',
                    who: 'Priya',
                    state: 'done',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        title: 'Write the one-page rules',
        who: 'Maya',
        state: 'done',
      },
    ],
    trail: [
      {
        when: '20 Apr',
        what: 'Approved by the Shapers — Maya as DRI',
        receipt: 'Proposals',
      },
      {
        when: '2 May',
        what: 'Vouchers designed — done, Priya paid by proposal',
        receipt: 'Proposals',
      },
      {
        when: '30 May',
        what: 'Tom split the cash-box ticket — Sam made the float, Lea teaches the hosts',
        receipt: '“Saturday stall”',
      },
      {
        when: '8 Jun',
        what: 'Lea asked Priya for a lid card; Priya asked Tom to laminate; Tom asked Noor for the laminator — five deep, nobody filed a form',
        receipt: '“Saturday stall”',
      },
    ],
    health: {
      pct: 86,
      label: 'Healthy',
      text: 'Vouchers exist, the rules are written, the float is made. The last open piece — the cash box taking RIVER — is held and due 28 Jun, with the hosts being taught this week; the lid card under it has gone five people deep and every piece has a name. One payment so far — Priya’s — through a proposal.',
    },
  },
  harvest: {
    id: 'harvest',
    title: 'Autumn harvest fair',
    dri: null,
    review: '15 Oct 2026',
    approved: null,
    brief:
      'One Saturday in October that is bigger than a stall: all five growers, music, the hall open all day.',
    from: 'Drafted from Maya’s line in “Growers” — “we should do one big one in October”',
    tickets: [],
    trail: [
      {
        when: 'yesterday',
        what: 'Drafted from the Growers room — needs a DRI',
        receipt: '“Growers”',
      },
    ],
  },
};

export const ticketsData = {
  covers: {
    id: 'covers' as const,
    projectId: 'stall' as const,
    title: 'Find two neighbours who can cover a Saturday',
    dri: 'Lea',
    due: '7 Jun',
    why: 'You just joined and said you can host.',
  },
  setup: {
    id: 'setup' as const,
    projectId: 'stall' as const,
    title: 'Write the Saturday setup so someone else could run it',
    dri: null,
    due: '14 Jun',
    why: 'Quiet writing. One page: open, cash box, grower list.',
  },
  prices: {
    id: 'prices' as const,
    projectId: 'stall' as const,
    title: 'Agree grower prices for the season',
    dri: 'Jun',
    due: null,
    why: '',
  },
};

/** Jun split the prices ticket in April — both pieces closed before it did. */
export const pricesChildren: WorkTicketRow[] = [
  { title: 'Call the orchard about apple prices', who: 'Jun', state: 'done' },
  { title: 'Post the price list in “Growers”', who: 'Noor', state: 'done' },
];

export type RiverTicketId = keyof typeof ticketsData;
export type EnergyTicketId = 'e-summary' | 'e-muni';
export type TicketId = RiverTicketId | EnergyTicketId;

export type ProposalKind = 'money' | 'project' | 'direction';

export type Proposal = {
  id: string;
  /** Money, a project, or a change to mission / vision / objectives / strategy. */
  kind: ProposalKind;
  /** direction only — which of the four was confirmed */
  artifact?: DirectionKind;
  title: string;
  sub: string;
  /** money proposals only — project approvals carry no number */
  amount?: number;
  state: 'open' | 'passed' | 'rejected';
  decided?: string;
  yes: number;
  no: number;
  needed: number;
  openedBy?: string;
  /** project approvals — what the project is */
  description?: string;
  /** project approvals — when the piece ends / comes up for review */
  ends?: string;
};

export const seedProposals: Proposal[] = [
  {
    id: 'reimburse-sam',
    kind: 'money',
    title: 'Reimburse Sam 85 USDC for ice and the cash float',
    sub: 'Stall expenses from the last two Saturdays',
    amount: 85,
    state: 'open',
    yes: 0,
    no: 0,
    needed: 2,
    openedBy: 'Sam',
  },
  {
    id: 'fund-stall',
    kind: 'project',
    title: 'Approve project: Saturday stall',
    sub: 'Sam as DRI',
    description:
      'Run the Saturday stall every week: growers, tables, cash box, and the people to hold it.',
    ends: '1 Jun 2026',
    state: 'passed',
    decided: '12 May',
    yes: 2,
    no: 0,
    needed: 2,
    openedBy: 'Maya',
  },
  {
    id: 'lea-saturdays',
    kind: 'money',
    title: 'Pay Lea 80 USDC — four Saturdays hosted in May',
    sub: 'Agreed with Sam in “Saturday stall” — 20 USDC a Saturday · the ledger shows 4 of 4 stalls happened',
    amount: 80,
    state: 'passed',
    decided: '2 Jun',
    yes: 2,
    no: 0,
    needed: 2,
    openedBy: 'Sam',
  },
  {
    id: 'sam-stipend',
    kind: 'money',
    title: 'Pay Sam 60 USDC — held Saturday stall through May',
    sub: 'Agreed with Maya in “Shapers” when Sam took the stall · the ledger shows 3 offers answered, review on time',
    amount: 60,
    state: 'passed',
    decided: '2 Jun',
    yes: 2,
    no: 0,
    needed: 2,
    openedBy: 'Maya',
  },
  {
    id: 'approve-growers',
    kind: 'project',
    title: 'Approve project: Grower onboarding',
    sub: 'Jun as DRI',
    description:
      'Five growers by autumn, each paid the week they sell — the visits, the delivery days, the welcome sheet.',
    ends: '1 Oct 2026',
    state: 'passed',
    decided: '3 May',
    yes: 2,
    no: 0,
    needed: 2,
    openedBy: 'Maya',
  },
  {
    id: 'sponsor',
    kind: 'money',
    title: 'Take the brand sponsorship — 2,000 USDC in',
    sub: 'A drinks brand offered 2,000 USDC · raised by Jun',
    amount: 2000,
    state: 'rejected',
    decided: '2 May',
    yes: 0,
    no: 2,
    needed: 2,
    openedBy: 'Jun',
  },
  {
    id: 'pay-priya',
    kind: 'money',
    title: 'Pay Priya 120 USDC for the voucher design',
    sub: 'Agreed with Maya in “Growers” before she started · the ticket is done, receipt attached',
    amount: 120,
    state: 'passed',
    decided: '2 May',
    yes: 2,
    no: 0,
    needed: 2,
    openedBy: 'Maya',
  },
  {
    id: 'van',
    kind: 'money',
    title: 'Buy a second-hand van — 3,500 USDC',
    sub: 'For grower pickups · raised by Sam · the strategy says two days a week, not a fleet',
    amount: 3500,
    state: 'rejected',
    decided: '25 Apr',
    yes: 1,
    no: 1,
    needed: 2,
    openedBy: 'Sam',
  },
  {
    id: 'approve-currency',
    kind: 'project',
    title: 'Approve project: RIVER currency launch',
    sub: 'Maya as DRI',
    description:
      'Paper RIVER vouchers earned at the stall, spendable with any grower — the design, the float, and the rules on one page.',
    ends: '1 Sep 2026',
    state: 'passed',
    decided: '20 Apr',
    yes: 2,
    no: 0,
    needed: 2,
    openedBy: 'Sam',
  },
  {
    id: 'dir-objectives-v3',
    kind: 'direction',
    artifact: 'objectives',
    title: 'Confirm objectives v3',
    sub: 'This season: Saturday every week, a weekday hall by August, and five growers paid the week they sell.',
    state: 'passed',
    decided: '14 May',
    yes: 2,
    no: 0,
    needed: 2,
    openedBy: 'Maya',
  },
  {
    id: 'dir-strategy-v4',
    kind: 'direction',
    artifact: 'strategy',
    title: 'Confirm strategy v4',
    sub: 'Small money and many neighbours — the stall pays for the hall, not a grant or a restaurant.',
    state: 'passed',
    decided: '14 May',
    yes: 2,
    no: 0,
    needed: 2,
    openedBy: 'Maya',
  },
  {
    id: 'dir-mission-v1',
    kind: 'direction',
    artifact: 'mission',
    title: 'Confirm mission v1',
    sub: 'A street food hub from people we know, not a supermarket — for neighbours, and the three growers we already buy from.',
    state: 'passed',
    decided: 'March',
    yes: 1,
    no: 0,
    needed: 1,
    openedBy: 'Maya',
  },
  {
    id: 'dir-vision-v1',
    kind: 'direction',
    artifact: 'vision',
    title: 'Confirm vision v1',
    sub: 'A neighbourhood that feeds itself two days a week: five growers, a hall paid without a whip-round, every grower paid the week they sell.',
    state: 'passed',
    decided: 'March',
    yes: 1,
    no: 0,
    needed: 1,
    openedBy: 'Maya',
  },
];

export const treasury = {
  crypto: [
    { symbol: 'BTC', name: 'Bitcoin', amount: '0.042' },
    { symbol: 'ETH', name: 'Ethereum', amount: '1.8' },
    { symbol: 'USDC', name: 'USD Coin', amount: '4,200' },
    { symbol: 'EURC', name: 'Euro Coin', amount: '1,150' },
  ],
  orgCurrencies: [
    {
      symbol: 'RIVER',
      name: 'River Commons currency',
      amount: '12,500 issued',
      note: 'earned at the stall, spendable with any grower',
    },
  ],
};

/* =========================================================
   Second sample org — Hypha Energy (hypha.energy)
   A second full world: the same five viewpoints, different
   people and work. Content grounded in the real site.
   ========================================================= */

export type TimelineEvent = {
  when: string;
  title: string;
  short: string;
  detail: string;
  kind: 'past' | 'now' | 'future';
};

export type PersonaView = {
  id: PersonaId;
  name: string;
  role: string;
  line: string;
};

/**
 * Any ticket on the board, opened read-only — someone else's, or a static one.
 * `parent` is set when it was opened from another ticket's page: the
 * breadcrumb, and where "back" goes.
 */
export type TicketView = WorkTicketRow & {
  projectId: ProjectId;
  projectTitle: string;
  parent?: TicketView;
};

export type EnergyProject = StaticProject & { id: EnergyProjectId };

export const energyOrg = {
  space: {
    name: 'Hypha Energy',
    short: 'HE',
    established: '2022 · 4+ years of R&D',
    founder: 'Alex',
    shapers: ['Alex', 'Edgar', 'Zekeriya'],
  },
  /** the same five viewpoints as River Commons — different people fill them */
  personas: [
    {
      id: 'you',
      name: 'You',
      role: 'Member',
      line: 'Joined from the Ameland pilot. Holds one ticket.',
    },
    {
      id: 'lea',
      name: 'Rogerio',
      role: 'Ticket DRI',
      line: 'Holds one ticket on Iberia pilots.',
    },
    {
      id: 'sam',
      name: 'Pedro',
      role: 'Project DRI',
      line: 'Holds Iberia pilots.',
    },
    {
      id: 'maya',
      name: 'Alex',
      role: 'Shaper',
      line: 'Direction, projects, money.',
    },
    {
      id: 'eli',
      name: 'Nina',
      role: 'Investor',
      line: 'Funded the sandbox. Looks in.',
    },
  ] as PersonaView[],
  direction: {
    mission: {
      version: 2,
      confirmedBy: 'Alex',
      confirmedOn: 'Jan 2024',
      text: 'Energy should create value where it is produced — ownership, income, and control stay local.',
      body: [
        'A community that produces its own energy should own the panels, keep the income and set the rules. We build the software and the legal scaffolding so that is the easy path, not the hard one.',
        'Everything else — the hardware, the connectors, the credits — is in service of that. If a decision moves value away from the community, it is the wrong decision.',
      ],
      proofs: [
        {
          when: '2024 →',
          what: 'Live communities in three countries producing and sharing locally.',
          go: 'project',
          id: 'iberia',
        },
        {
          when: '2026',
          what: 'Ameland: tokenised credits inside the EU sandbox — the credits belong to the members, not to us.',
          go: 'project',
          id: 'islands',
        },
        {
          when: 'Dec 2025',
          what: 'A 4,000 EURC conference booth was rejected — pilots come first.',
          go: 'proposal',
          id: 'e-conference',
        },
      ],
      history: [
        {
          version: 1,
          confirmedBy: 'Alex',
          confirmedOn: '2022',
          change: 'Cheaper, cleaner energy for communities.',
        },
        {
          version: 2,
          confirmedBy: 'Alex',
          confirmedOn: 'Jan 2024',
          change:
            'Ownership and control added after the first pilots showed savings alone did not keep communities together.',
        },
      ],
    },
    vision: {
      version: 1,
      confirmedBy: 'Alex',
      confirmedOn: '2022',
      text: '10,000 energy hubs by 2030 — the largest renewable ecosystem, where members save 20–80% and co-own the assets.',
      body: [
        'A hub is one community with its own production, sharing rules and settlement. Ten thousand of them is a grid that belongs to the people on it. The 20–80% is measured, not promised — every pilot publishes its numbers.',
      ],
      proofs: [
        {
          when: '2024',
          what: 'First pilot communities live in three countries.',
          go: 'project',
          id: 'iberia',
        },
        {
          when: '2025',
          what: 'Four white papers published free — the R&D distilled.',
        },
        {
          when: '2026',
          what: 'Ameland runs a full tokenised-credits cycle in the EU Blockchain Sandbox.',
          go: 'proposal',
          id: 'e-ameland',
        },
      ],
      history: [
        {
          version: 1,
          confirmedBy: 'Alex',
          confirmedOn: '2022',
          change: 'Written at founding, with Edgar and Zekeriya.',
        },
      ],
    },
    objectives: {
      version: 6,
      confirmedBy: 'Edgar',
      confirmedOn: 'Jan 2026',
      text: 'This year: more towns producing their own energy, the tools they need running, and a second island proving it works.',
      body: [
        'What we mean to have done this year. One sentence each, with the timing inside it. When one is met, it leaves the list in the next version — the proof stays here.',
      ],
      items: [
        {
          text: 'Six Iberian communities are ready for EECF round 2 by spring.',
          proofs: [
            {
              when: 'Nov 2025',
              what: 'Iberia pilots approved — Pedro holds it, ends 30 Sep.',
              go: 'proposal',
              id: 'e-approve-iberia',
            },
            {
              when: 'Feb 2026',
              what: 'Coopérnico paid 2,000 EURC as national facilitator for Portugal.',
              go: 'proposal',
              id: 'e-coopernico',
            },
            {
              when: 'open',
              what: '6,000 EURC for the round-2 applications — 1 of 3 Shapers so far.',
              go: 'proposal',
              id: 'e-eecf',
            },
          ],
        },
        {
          text: 'The Nordpool connector is live for the pilots by Q3.',
          read: 'In review — the connector is in Tech team; the EMS it feeds has 31 days up.',
          proofs: [
            {
              when: 'Tue',
              what: 'Connector in review in Tech team.',
              go: 'thread',
              id: 'e-tech',
            },
            {
              when: '3 Jun',
              what: 'Rowan paid 400 EURC for May on-call — 31 days up, two incidents closed.',
              go: 'proposal',
              id: 'e-rowan-oncall',
            },
          ],
        },
        {
          text: 'The onboarding playbook exists in three languages by Q4.',
          proofs: [
            {
              when: 'Mar 2026',
              what: 'Community onboarding playbook approved — Suzana holds it, ends 15 Dec.',
              go: 'proposal',
              id: 'e-approve-playbook',
            },
          ],
        },
        {
          text: 'A second island runs the Ameland model by December.',
          read: 'Ameland done. The second island is not picked yet.',
          proofs: [
            {
              when: 'Jan 2026',
              what: 'Island grids approved — Marcus holds it, ends 31 Dec.',
              go: 'proposal',
              id: 'e-ameland',
            },
            {
              when: '2026',
              what: 'Ameland completed a full tokenised-credits cycle in the EU sandbox.',
              go: 'project',
              id: 'islands',
            },
          ],
        },
      ],
      history: [
        {
          version: 4,
          confirmedBy: 'Alex',
          confirmedOn: 'Jan 2025',
          change: 'Ameland sandbox cycle; first Iberian municipality.',
        },
        {
          version: 5,
          confirmedBy: 'Edgar',
          confirmedOn: 'Jul 2025',
          change: 'Nordpool connector added; playbook given a language count.',
        },
        {
          version: 6,
          confirmedBy: 'Edgar',
          confirmedOn: 'Jan 2026',
          change:
            'Ameland cycle met and dropped; second island added. Iberia raised to six communities for EECF round 2.',
        },
      ],
    },
    strategy: {
      version: 3,
      confirmedBy: 'Alex',
      confirmedOn: 'Jan 2026',
      text: 'Prove it in real towns first. We take the hard parts; they get cheaper, cleaner energy. The knowledge is free.',
      body: [
        'How we get to ten thousand hubs — the bets, and what we say no to. Every project draft and every proposal the agent writes is checked against these lines.',
      ],
      lines: [
        {
          text: 'Pilots before promotion — every claim backed by a live community.',
          proofs: [
            {
              when: 'Dec 2025',
              what: 'Conference booth at 4,000 EURC rejected — two Shapers said the pilots come first.',
              go: 'proposal',
              id: 'e-conference',
            },
            {
              when: '2026',
              what: 'The Ameland report is public before any Ameland marketing.',
              go: 'thread',
              id: 'e-pilots',
            },
          ],
        },
        {
          text: 'We handle the complexity; communities just enjoy cheaper, cleaner energy.',
          proofs: [
            {
              when: 'last week',
              what: 'Battery optimisation v2 delivered and paid — 3,000 EURC.',
              go: 'proposal',
              id: 'e-pay-rowan',
            },
            {
              when: 'May',
              what: 'EMS on-call held all month; the community saw none of the two incidents.',
              go: 'proposal',
              id: 'e-rowan-oncall',
            },
          ],
        },
        {
          text: 'Publish the research free; sell the operating, not the knowledge.',
          proofs: [
            {
              when: '2025',
              what: 'Four white papers, free to download.',
            },
            {
              when: 'Mar 2026',
              what: 'The playbook — guides, legal templates, video — is a free, public project.',
              go: 'project',
              id: 'playbook',
            },
          ],
        },
      ],
      history: [
        {
          version: 1,
          confirmedBy: 'Alex',
          confirmedOn: '2022',
          change: 'Research first; pilots when the models hold.',
        },
        {
          version: 2,
          confirmedBy: 'Zekeriya',
          confirmedOn: '2024',
          change:
            '“We handle the complexity” — from the first pilot retrospectives.',
        },
        {
          version: 3,
          confirmedBy: 'Alex',
          confirmedOn: 'Jan 2026',
          change:
            'Promotion line dropped after the booth was rejected; “pilots before promotion” written in its place.',
        },
      ],
    },
  } as Direction,
  timeline: [
    {
      when: '2022',
      title: 'Founded',
      short: 'Founded',
      detail: 'Alex, Edgar and Zekeriya — four years of R&D begin.',
      kind: 'past',
    },
    {
      when: '2024',
      title: 'First pilot communities',
      short: 'First pilots',
      detail: 'Live communities producing and sharing in three countries.',
      kind: 'past',
    },
    {
      when: '2025',
      title: 'Research published',
      short: 'Research out',
      detail: 'Four white papers, free to download — the R&D distilled.',
      kind: 'past',
    },
    {
      when: '2026',
      title: 'EU Blockchain Sandbox',
      short: 'EU sandbox',
      detail: 'Tokenised energy credits piloted with Ameland.',
      kind: 'now',
    },
    {
      when: 'Q3 2027',
      title: 'Efficiency & hardware',
      short: 'Efficiency',
      detail:
        'Demand shifting, storage optimisation, group-buying for panels and batteries.',
      kind: 'future',
    },
    {
      when: 'Q4 2027',
      title: 'Carbon credits & financing',
      short: 'Carbon credits',
      detail: 'Sell CO₂ reductions; fund setups from the savings they create.',
      kind: 'future',
    },
    {
      when: '2030',
      title: '10,000 energy hubs',
      short: '10,000 hubs',
      detail: 'The collective goal — the largest renewable ecosystem.',
      kind: 'future',
    },
  ] as TimelineEvent[],
  health: {
    pct: 84,
    label: 'Healthy',
    text: 'Pilots are live in three countries, the research is published, and the EU sandbox with Ameland is underway. What keeps this short of the far right: the 2027 roadmap — efficiency, hardware, carbon credits, financing — is designed but not yet funded.',
  },
  treasury: {
    crypto: [
      { symbol: 'EURC', name: 'Euro Coin', amount: '45,000' },
      { symbol: 'USDC', name: 'USD Coin', amount: '12,400' },
      { symbol: 'ETH', name: 'Ethereum', amount: '4.2' },
    ],
    orgCurrencies: [
      {
        symbol: 'KWH',
        name: 'Tokenised energy credits',
        amount: '3.75M kWh',
        note: 'earned by producing, spent on bills — EU sandbox pilot',
      },
    ],
  },
  projects: {
    iberia: {
      id: 'iberia',
      title: 'Iberia pilots',
      dri: 'Pedro',
      review: '30 Sep 2026',
      approved: 'Nov 2025',
      brief:
        'Live energy communities in Portugal and Spain — onboard municipalities, land the EECF money, keep Coopérnico close.',
      from: 'Drafted from the pilots room — approved by the Shapers, Nov 2025',
      tickets: [
        {
          title: 'EECF grant application — round 2',
          who: 'Suzana',
          state: 'waiting',
          stateLabel: 'waiting on the proposal',
          due: 'Spring',
        },
        {
          title: 'Shortlist six communities for EECF round 2',
          who: 'Pedro',
          state: 'doing',
          due: '30 Jun',
          children: [
            {
              title: 'Call the Alentejo cooperatives',
              who: 'Pedro',
              state: 'done',
            },
            {
              title: 'Check Galicia eligibility with Coopérnico',
              who: 'Rogerio',
              state: 'doing',
              due: '20 Jun',
            },
          ],
        },
        {
          title: 'Coopérnico quarterly sync — write the notes',
          who: 'Rogerio',
          state: 'doing',
          due: '15 Jun',
        },
        {
          title: 'Coopérnico partnership signed',
          who: 'Pedro',
          state: 'done',
        },
      ],
      trail: [
        {
          when: 'Nov 2025',
          what: 'Approved by the Shapers — Pedro as DRI',
          receipt: 'Proposals',
        },
        {
          when: 'Feb 2026',
          what: 'Coopérnico facilitation paid — all three Shapers agreed',
          receipt: 'Proposals',
        },
        {
          when: 'Mar 2026',
          what: 'Municipalities ticket accepted by Rogerio',
          receipt: '“Pilots”',
        },
      ],
      health: {
        pct: 58,
        label: 'Moving, money-bound',
        text: 'Coopérnico is signed and the municipalities are close. What holds it back is upstream: the EECF round-2 application waits on a 6,000 EURC proposal that has one of three Shapers so far, and the review lands in Q3.',
      },
    },
    ems: {
      id: 'ems',
      title: 'Energy management systems',
      dri: 'Surya',
      review: '30 Sep 2026',
      approved: '2024',
      brief:
        'The AI that decides where energy flows between members — batteries, markets, and a fair split of the value.',
      from: 'Founding roadmap — approved by the Shapers, 2024',
      tickets: [
        {
          title: 'Market connector for Nordpool',
          who: 'Surya',
          state: 'doing',
          due: 'Q3',
          children: [
            {
              title: 'Auth against the Nordpool API',
              who: 'Surya',
              state: 'done',
            },
            {
              title: 'Day-ahead price feed parser',
              who: 'Kai',
              state: 'doing',
              due: 'Jul',
              children: [
                {
                  title: 'Handle the two DST switch days',
                  who: 'Tomas',
                  state: 'doing',
                  due: '30 Jun',
                  children: [
                    {
                      title: 'Pull the October 2025 hourly file as a fixture',
                      who: 'Kai',
                      state: 'done',
                    },
                    {
                      title: 'Write the 23h / 25h day test',
                      who: 'Tomas',
                      state: 'doing',
                      due: '27 Jun',
                    },
                  ],
                },
              ],
            },
            {
              title: 'Load test with three communities’ data',
              who: 'open',
              state: 'open',
              stateLabel: 'open — needs a DRI',
            },
          ],
        },
        {
          title: 'Keep the Ameland EMS running — on-call',
          who: 'Rowan',
          state: 'doing',
          stateLabel: 'ongoing',
        },
        {
          title: 'Battery optimisation algorithm v2',
          who: 'Rowan',
          state: 'done',
        },
        {
          title: 'Fair-split model reviewed by the Ameland coop',
          who: 'Rowan',
          state: 'waiting',
          stateLabel: 'waiting on the coop',
          due: 'Aug',
        },
      ],
      trail: [
        {
          when: '2024',
          what: 'Approved by the Shapers — Surya as DRI',
          receipt: 'Proposals',
        },
        {
          when: 'May 2026',
          what: 'Surya split the Nordpool connector — Kai took the price feed',
          receipt: '“Tech team”',
        },
        {
          when: 'Jun 2026',
          what: 'Kai split the price feed — Tomas took the DST days, and split that again for the test fixture',
          receipt: '“Tech team”',
        },
        {
          when: 'last week',
          what: 'Battery optimisation v2 shipped — confirmed by Rowan',
          receipt: '“Tech team”',
        },
      ],
      health: {
        pct: 74,
        label: 'Shipping',
        text: 'Battery v2 shipped last week and the Nordpool connector is split three ways with two pieces moving. Two soft spots: the load test has no DRI, and the fair-split review has waited on the Ameland coop for three weeks. Two payments so far, both through proposals.',
      },
    },
    islands: {
      id: 'islands',
      title: 'Island grids',
      dri: 'Marcus',
      review: '31 Dec 2026',
      approved: 'Jan 2026',
      brief:
        'Resilient energy sharing for islands — Ameland first, with tokenised credits inside the EU Blockchain Sandbox.',
      from: 'Drafted from the pilots room — approved by the Shapers, Jan 2026',
      tickets: [
        {
          title: 'Ameland tokenised credits pilot',
          who: 'Marcus',
          state: 'done',
        },
        {
          title: 'Grid-sharing rules signed off by the Ameland coop',
          who: 'Marcus',
          state: 'done',
        },
        {
          title: 'Second island — shortlist three candidates',
          who: 'open',
          state: 'open',
          stateLabel: 'open — needs a DRI',
          due: 'Sep',
        },
      ],
      trail: [
        {
          when: 'Jan 2026',
          what: 'Approved by the Shapers — Marcus as DRI',
          receipt: 'Proposals',
        },
        {
          when: '1h ago',
          what: 'Ameland pilot done — the sandbox report is the receipt',
          receipt: '“Pilots”',
        },
      ],
      health: {
        pct: 90,
        label: 'Healthy',
        text: 'Ameland ran a full sandbox cycle and the coop signed the grid-sharing rules — both done with receipts. The summary for new communities is held and due 15 Jul. The only open piece is the second island, which is not due until September.',
      },
    },
    carbon: {
      id: 'carbon',
      title: 'Carbon credits module',
      dri: null,
      review: '31 Mar 2028',
      approved: null,
      brief:
        'Measure the CO₂ each community avoids, sell the reductions, and fund new setups from the savings they create.',
      from: 'Drafted from the 2027 roadmap discussion in “Tech team”',
      tickets: [],
      trail: [
        {
          when: '2 days ago',
          what: 'Drafted from the roadmap discussion — needs a DRI',
          receipt: '“Tech team”',
        },
      ],
    },
    playbook: {
      id: 'playbook',
      title: 'Community onboarding playbook',
      dri: 'Suzana',
      review: '15 Dec 2026',
      approved: 'Mar 2026',
      brief:
        'Everything a new community needs to go from first call to first kWh shared — guides, legal templates, a video, in three languages.',
      from: 'Drafted from the pilots room — approved by the Shapers, Mar 2026',
      tickets: [
        {
          title: 'Video walkthrough of the member app',
          who: 'Rowan',
          state: 'done',
        },
        {
          title: 'Legal templates per country',
          who: 'Inês',
          state: 'doing',
          due: 'Q3',
          children: [
            {
              title: 'Portugal — CER statute template',
              who: 'Inês',
              state: 'done',
            },
            {
              title: 'Spain — comunidad energética template',
              who: 'Diego',
              state: 'doing',
              due: 'Jul',
              children: [
                {
                  title: 'Check the Andalusia regional variant',
                  who: 'Diego',
                  state: 'doing',
                  due: 'Jul',
                  children: [
                    {
                      title: 'Get the Junta’s 2026 decree text',
                      who: 'Marta',
                      state: 'doing',
                      due: '25 Jun',
                      children: [
                        {
                          title:
                            'Translate §4 (self-consumption) for the lawyers',
                          who: 'Kai',
                          state: 'doing',
                          due: '28 Jun',
                          children: [
                            {
                              title: 'Glossary — twelve Spanish grid terms',
                              who: 'Marta',
                              state: 'done',
                            },
                          ],
                        },
                        {
                          title: 'Ask Coopérnico who they used in Seville',
                          who: 'Marta',
                          state: 'done',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              title: 'Netherlands — energiecoöperatie template',
              who: 'open',
              state: 'open',
              stateLabel: 'open — needs a DRI',
            },
          ],
        },
        {
          title: 'Translate the member FAQ into Portuguese',
          who: 'open',
          state: 'open',
          stateLabel: 'open — needs a DRI',
        },
      ],
      trail: [
        {
          when: 'Mar 2026',
          what: 'Approved by the Shapers — Suzana as DRI',
          receipt: 'Proposals',
        },
        {
          when: 'Apr 2026',
          what: 'Legal templates accepted by Inês',
          receipt: '“Pilots”',
        },
        {
          when: 'May 2026',
          what: 'Inês split the templates by country — Diego took Spain',
          receipt: '“Pilots”',
        },
        {
          when: 'Jun 2026',
          what: 'Spain → Andalusia → the decree → §4 translated → a glossary: Diego, Marta, Kai, Marta. Six levels under the project, each with a name',
          receipt: '“Pilots”',
        },
        {
          when: 'last month',
          what: 'App walkthrough video done — confirmed by Rowan',
          receipt: '“Tech team”',
        },
      ],
      health: {
        pct: 44,
        label: 'Wobbly',
        text: 'The video is done and Portugal’s template is in. But two of the three countries and the Portuguese FAQ have no one holding them, Spain is one person deep on a July date, and the review is Q4. The playbook promises three languages and has one.',
      },
    },
    hardware: {
      id: 'hardware',
      title: 'Hardware group-buy',
      dri: null,
      review: '31 Mar 2028',
      approved: null,
      brief:
        'Pool member demand for panels and batteries, negotiate one price, and deliver the installs through local partners.',
      from: 'Drafted from the 2027 roadmap discussion in “Tech team”',
      tickets: [],
      trail: [
        {
          when: 'last week',
          what: 'Drafted from the roadmap discussion — needs a DRI',
          receipt: '“Tech team”',
        },
      ],
    },
  } as Record<EnergyProjectId, EnergyProject>,
  /** the two tickets whose state moves in the demo */
  tickets: {
    'e-summary': {
      id: 'e-summary' as const,
      projectId: 'islands' as const,
      title: 'Write the Ameland pilot summary for new communities',
      dri: 'You',
      due: '15 Jul',
      why: 'You were on the Ameland pilot — you saw it work.',
      draft:
        'Two pages for a community that has never heard of us: what Ameland set out to do, what the credits did to bills, what broke, what we would do again.',
    },
    'e-muni': {
      id: 'e-muni' as const,
      projectId: 'iberia' as const,
      title: 'Onboard two Portuguese municipalities',
      dri: 'Rogerio',
      due: '30 Jun',
      why: 'You know both councils from the Coopérnico work.',
      draft:
        'Two councils, one path: a first call, the Coopérnico intro, the sandbox summary, a signed letter of intent. Track each step here.',
      /** Rogerio split his ticket — he holds the whole, others hold pieces */
      children: [
        {
          title: 'Council call — Évora',
          who: 'Rogerio',
          state: 'done',
        },
        {
          title: 'Letter of intent — Beja',
          who: 'Inês',
          state: 'done',
        },
      ] as WorkTicketRow[],
    },
  },
  proposals: [
    {
      id: 'e-eecf',
      kind: 'money',
      title: 'Fund EECF round-2 applications — 6,000 EURC',
      sub: 'Application support for six emerging communities',
      amount: 6000,
      state: 'open',
      yes: 1,
      no: 0,
      needed: 3,
      openedBy: 'Pedro',
    },
    {
      id: 'e-marcus-travel',
      kind: 'money',
      title: 'Reimburse Marcus 640 EURC — Ameland travel',
      sub: 'Two ferry trips and a night on the island for the sandbox close-out',
      amount: 640,
      state: 'open',
      yes: 0,
      no: 0,
      needed: 3,
      openedBy: 'Marcus',
    },
    {
      id: 'e-pedro-stipend',
      kind: 'money',
      title: 'Pay Pedro 1,200 EURC — held Iberia pilots through May',
      sub: 'Agreed with Alex in “Pilots” when Pedro took Iberia · the ledger shows two tickets offered, one accepted, sync notes on time',
      amount: 1200,
      state: 'passed',
      decided: '3 Jun',
      yes: 3,
      no: 0,
      needed: 3,
      openedBy: 'Alex',
    },
    {
      id: 'e-rowan-oncall',
      kind: 'money',
      title: 'Pay Rowan 400 EURC — Ameland EMS on-call, May',
      sub: 'Agreed with Surya in “Tech team” — 400 EURC a month on call · 31 days up, two incidents closed in the ledger',
      amount: 400,
      state: 'passed',
      decided: '3 Jun',
      yes: 3,
      no: 0,
      needed: 3,
      openedBy: 'Surya',
    },
    {
      id: 'e-pay-rowan',
      kind: 'money',
      title: 'Pay Rowan 3,000 EURC — battery optimisation v2',
      sub: 'Agreed with Surya in “Tech team” before he started · the ticket is done, receipt attached',
      amount: 3000,
      state: 'passed',
      decided: 'last week',
      yes: 3,
      no: 0,
      needed: 3,
      openedBy: 'Surya',
    },
    {
      id: 'e-approve-playbook',
      kind: 'project',
      title: 'Approve project: Community onboarding playbook',
      sub: 'Suzana as DRI',
      description:
        'Everything a new community needs to go from first call to first kWh shared — guides, legal templates, a video, in three languages.',
      ends: '15 Dec 2026',
      state: 'passed',
      decided: 'Mar 2026',
      yes: 3,
      no: 0,
      needed: 3,
      openedBy: 'Alex',
    },
    {
      id: 'e-coopernico',
      kind: 'money',
      title: 'Pay Coopérnico facilitation — 2,000 EURC',
      sub: 'EECF national facilitator for Portugal',
      amount: 2000,
      state: 'passed',
      decided: 'Feb 2026',
      yes: 3,
      no: 0,
      needed: 3,
      openedBy: 'Suzana',
    },
    {
      id: 'e-ameland',
      kind: 'project',
      title: 'Approve project: Island grids',
      sub: 'Marcus as DRI',
      description:
        'Resilient energy sharing for islands — Ameland first, with tokenised credits inside the EU Blockchain Sandbox.',
      ends: '31 Dec 2026',
      state: 'passed',
      decided: 'Jan 2026',
      yes: 3,
      no: 0,
      needed: 3,
      openedBy: 'Marcus',
    },
    {
      id: 'e-conference',
      kind: 'money',
      title: 'Sponsor a conference booth — 4,000 EURC',
      sub: 'European energy fair in Lisbon · raised by Pedro · two Shapers said the pilots come first',
      amount: 4000,
      state: 'rejected',
      decided: 'Dec 2025',
      yes: 1,
      no: 2,
      needed: 3,
      openedBy: 'Pedro',
    },
    {
      id: 'e-approve-iberia',
      kind: 'project',
      title: 'Approve project: Iberia pilots',
      sub: 'Pedro as DRI',
      description:
        'Live energy communities in Portugal and Spain — onboard municipalities, land the EECF money, keep Coopérnico close.',
      ends: '30 Sep 2026',
      state: 'passed',
      decided: 'Nov 2025',
      yes: 3,
      no: 0,
      needed: 3,
      openedBy: 'Alex',
    },
    {
      id: 'e-dir-objectives-v6',
      kind: 'direction',
      artifact: 'objectives',
      title: 'Confirm objectives v6',
      sub: 'This year: more towns producing their own energy, the tools they need running, and a second island proving it works.',
      state: 'passed',
      decided: 'Jan 2026',
      yes: 3,
      no: 0,
      needed: 3,
      openedBy: 'Edgar',
    },
    {
      id: 'e-dir-strategy-v3',
      kind: 'direction',
      artifact: 'strategy',
      title: 'Confirm strategy v3',
      sub: 'Prove it in real towns first. We take the hard parts; they get cheaper, cleaner energy. The knowledge is free.',
      state: 'passed',
      decided: 'Jan 2026',
      yes: 3,
      no: 0,
      needed: 3,
      openedBy: 'Alex',
    },
    {
      id: 'e-dir-mission-v2',
      kind: 'direction',
      artifact: 'mission',
      title: 'Confirm mission v2',
      sub: 'Energy should create value where it is produced — ownership, income, and control stay local.',
      state: 'passed',
      decided: 'Jan 2024',
      yes: 3,
      no: 0,
      needed: 3,
      openedBy: 'Alex',
    },
    {
      id: 'e-dir-vision-v1',
      kind: 'direction',
      artifact: 'vision',
      title: 'Confirm vision v1',
      sub: '10,000 energy hubs by 2030 — members save 20–80% and co-own the assets.',
      state: 'passed',
      decided: '2022',
      yes: 3,
      no: 0,
      needed: 3,
      openedBy: 'Alex',
    },
  ] as Proposal[],
  threads: [
    {
      id: 'e-pilots',
      kind: 'room' as const,
      title: 'Pilots',
      sub: '9 people',
      preview: 'Ameland report is live.',
      time: '1h',
    },
    {
      id: 'e-tech',
      kind: 'room' as const,
      title: 'Tech team',
      sub: '6 people',
      preview: 'Nordpool connector in review.',
      time: 'Tue',
    },
    {
      id: 'e-marcus-dm',
      kind: 'dm' as const,
      title: 'Marcus',
      sub: 'Direct',
      preview: 'Ameland report is live.',
      time: 'Yesterday',
    },
  ],
};

export const threads = [
  {
    id: 'agent',
    kind: 'agent' as const,
    title: 'Personal Assistant',
    sub: 'your personal AI',
    preview: 'Ask about the org, create tickets, move your own work.',
    time: 'now',
  },
  {
    id: 'shapers',
    kind: 'shapers' as const,
    title: 'Shapers',
    sub: 'Maya, Sam · private',
    preview: 'Strategy v5 drafted from Tuesday’s call.',
    time: '1h',
  },
  {
    id: 'saturday',
    kind: 'group' as const,
    title: 'Saturday stall',
    sub: '5 people',
    preview: 'Who signs the hall licence?',
    time: '2h',
  },
  {
    id: 'growers',
    kind: 'group' as const,
    title: 'Growers',
    sub: '4 people',
    preview: 'Three crates on Saturday.',
    time: 'Mon',
  },
  {
    id: 'sam-dm',
    kind: 'dm' as const,
    title: 'Sam',
    sub: 'Direct',
    preview: 'Ice is in the van.',
    time: 'Yesterday',
  },
];

export const seedMessages: Record<string, Msg[]> = {
  'e-pilots': [
    {
      id: 'ep0a',
      from: 'Rogerio',
      text: 'Pedro — the two municipalities, we said 1,500 for both?',
    },
    {
      id: 'ep0b',
      from: 'Pedro',
      text: '1,500 EURC when both have signed. Yes.',
    },
    {
      id: 'ep0c',
      from: 'agent',
      system: true,
      text: 'Noted — 1,500 EURC for the municipalities, agreed between Rogerio and Pedro. I will remember this line when the ticket closes.',
    },
    {
      id: 'ep1',
      from: 'Marcus',
      text: 'Ameland report is live — tokenised credits worked through the full sandbox cycle.',
    },
    {
      id: 'ep2',
      from: 'agent',
      system: true,
      text: 'Marked the Ameland pilot ticket done — receipt: the sandbox report. Marcus confirmed.',
    },
    {
      id: 'ep3',
      from: 'Pedro',
      text: 'EECF second call opens in spring — I want six communities ready to apply.',
    },
  ],
  'e-tech': [
    {
      id: 'et1',
      from: 'Surya',
      text: 'Nordpool connector is in review. Battery optimisation v2 shipped last week.',
    },
    {
      id: 'et2',
      from: 'Rowan',
      text: 'v2 is distributing value fairly on all three test communities.',
    },
  ],
  'e-marcus-dm': [
    {
      id: 'emd1',
      from: 'Marcus',
      text: 'Ameland report is live. I put the sandbox cycle notes in the pilots room.',
    },
    { id: 'emd2', from: 'you', text: 'Got it — thanks.' },
  ],
  agent: [
    {
      id: 'a1',
      from: 'agent',
      text: 'I read the threads, the calls, and the direction the Shapers confirmed — mission, vision, objectives, strategy. Ask me anything about this org. Tell me what work is needed and I will draft the ticket. Say your ticket is done and I will move it, receipt attached. Nothing I draft is real until the right person confirms it.',
    },
  ],
  'e-agent': [
    {
      id: 'ea1',
      from: 'agent',
      text: 'Same assistant, different org — here I read the Pilots and Tech rooms, the four white papers, and the direction the Shapers confirmed. Ask me about Ameland, the EECF money, or who holds what. Say a ticket is done and I move it, receipt attached. I decide nothing.',
    },
  ],
  shapers: [
    {
      id: 'sh1',
      from: 'agent',
      system: true,
      text: 'Tuesday’s call ingested — 41 minutes, transcript in memory.',
    },
    {
      id: 'sh2',
      from: 'agent',
      text: 'On Tuesday you decided against the drinks-brand sponsorship — the vote on 2 May already went the same way. That is a matter of strategy, not mission or objectives, so I drafted strategy v5 with one line added. Everything I do reads from the confirmed direction, so confirm it or correct me.',
      card: 'strategy-draft',
    },
  ],
  saturday: [
    {
      id: 's1',
      from: 'Sam',
      text: 'Tables at 8. Lea, can you take the cash box?',
    },
    { id: 's2', from: 'Lea', text: 'Yes. There at 7:45.' },
    {
      id: 's2a',
      from: 'Lea',
      text: 'Sam — for finding the two covers, we said 150?',
    },
    {
      id: 's2b',
      from: 'Sam',
      text: '150 USDC when both are found. Deal.',
    },
    {
      id: 's2c',
      from: 'agent',
      system: true,
      text: 'Noted — 150 USDC for the covers, agreed between Lea and Sam. I will remember this line when the ticket closes; either of you can ask me to draft the proposal then.',
    },
    {
      id: 's3',
      from: 'Jun',
      text: 'Who signs the weekday hall licence? The council asked again.',
    },
    { id: 's4', from: 'Sam', text: 'Not me — that is not the stall.' },
    {
      id: 's5',
      from: 'agent',
      system: true,
      text: 'Heard. Drafted a project — “Weekday hall, needs a DRI” — and put it in front of the Shapers. Nothing landed on Sam.',
    },
  ],
  growers: [
    { id: 'g1', from: 'Jun', text: 'Three crates on Saturday. Same price.' },
    { id: 'g2', from: 'Maya', text: 'Noted — we pay you after close.' },
  ],
  'sam-dm': [
    {
      id: 'd1',
      from: 'Sam',
      text: 'Ice is in the van. I will put it on the stall expenses.',
    },
    { id: 'd2', from: 'you', text: 'Got it.' },
  ],
};

/** Open work shown to newcomers during onboarding and on the public page. */
export const jobs = [
  {
    id: 'covers',
    kind: 'ticket' as const,
    title: 'Find two neighbours who can cover a Saturday',
    project: 'Saturday stall',
    why: 'You said you can host. Street-level, one afternoon.',
  },
  {
    id: 'weekday',
    kind: 'project' as const,
    title: 'Hold Weekday hall',
    project: 'Weekday hall',
    review: '1 Aug 2026',
    why: 'Nobody holds this. Someone who can sign a simple licence.',
  },
  {
    id: 'setup',
    kind: 'ticket' as const,
    title: 'Write the Saturday setup so someone else could run it',
    project: 'Saturday stall',
    why: 'Quiet writing. One page: open, cash box, grower list.',
  },
];

export const founding = {
  questions: [
    'What is this organization for? Say it in your words.',
    'Who is already doing work — and who do you trust to decide?',
    'What has to happen in the next 90 days?',
    'Is there money? Who can move it, and does anything need a second signature?',
  ],
  cards: [
    { label: 'Mission', value: 'A street food hub from people we know.' },
    {
      label: 'Vision',
      value: 'A neighbourhood that feeds itself two days a week.',
    },
    {
      label: 'Objectives — 90 days',
      value: 'Saturday stall every week · a weekday hall before August',
    },
    { label: 'Strategy', value: 'Small money, many hands. No brand money.' },
    { label: 'Shapers', value: 'Maya, Sam' },
    {
      label: 'Project — Saturday stall',
      value: 'Sam · review 1 Jun 2026',
    },
    {
      label: 'Project — Weekday hall',
      value: 'Open · review 1 Aug 2026',
    },
    { label: 'Door', value: 'Anyone can join' },
  ],
};

/** Old Hypha → this prototype, for the About screen. */
export const uiMapping = [
  {
    old: 'Signals board (Coherence)',
    now: 'Projects',
    why: 'A signal was talk about work. Now talk becomes a drafted project or ticket with a named confirm — the board shows the work itself.',
  },
  {
    old: 'Proposal creation forms',
    now: 'Chat with the agent',
    why: 'You say what should happen; the agent drafts the proposal with the evidence attached. Nobody fills a form.',
  },
  {
    old: 'Proposals tab + voting aside',
    now: 'Decisions',
    why: 'Kept, but narrowed: money, project approvals, and direction (mission, vision, objectives, strategy). The Shapers decide them. Approving stays a deliberate, visible act.',
  },
  {
    old: 'Space Memory tab',
    now: 'Overview + receipts in chat',
    why: 'The confirmed mission, vision, objectives and strategy are the memory people see; raw files surface as receipts when a claim needs proof.',
  },
  {
    old: 'Members tab',
    now: 'Overview',
    why: 'Who is here, who shapes, who holds what — one glance, not a list of profiles.',
  },
  {
    old: 'Notifications feed',
    now: 'My Work',
    why: 'One card per thing that actually needs you. Empty means empty.',
  },
];

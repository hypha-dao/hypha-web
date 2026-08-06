/**
 * The wire contract between the API routes and the browser. Import-safe from
 * both sides — no server-only modules, no database types.
 *
 * Money crosses the wire as integer cents and RSUT as a plain number; the
 * ledger stores exact numerics and only rounds at this boundary.
 */

export type ProjectGroup = 'initiative' | 'program' | 'enabling';

export const GROUP_LABELS: Record<ProjectGroup, string> = {
  initiative: 'Live initiatives',
  program: 'Demonstrator programs',
  enabling: 'Enabling conditions',
};

export const GROUP_ORDER: ProjectGroup[] = [
  'initiative',
  'program',
  'enabling',
];

export type CampaignProjectDto = {
  id: number;
  slug: string;
  title: string;
  program: string;
  group: ProjectGroup;
  summary: string;
  team: string;
  videoUrl: string | null;
  image: string | null;
  active: boolean;
  sortOrder: number;
  payoutAddress: string | null;
};

export type CycleDto = {
  id: number;
  number: number;
  name: string;
  status: 'open' | 'closed';
  startsAt: string;
  endsAt: string;
  durationDays: number;
  matchMultiplier: number;
  closedAt: string | null;
};

export type TallyRowDto = {
  projectId: number;
  votes: number;
  yourVotes: number;
  share: number;
  projectedAud: number;
};

export type CampaignStateDto = {
  cycle: CycleDto | null;
  projects: CampaignProjectDto[];
  tally: TallyRowDto[];
  totals: {
    communityAud: number;
    matchAud: number;
    potAud: number;
    contributors: number;
    votesCast: number;
  };
  /** Server-owned copy so the marketing copy can never drift from the grant. */
  economics: {
    joinBonusRsut: number;
    rsutPerAud: number;
    minContributionAud: number;
  };
};

export type ViewerDto = {
  personId: number;
  email: string | null;
  name: string | null;
  walletAddress: string | null;
  isAdmin: boolean;
  /** Cumulative RSUT from every grant — the joining bonus plus contributions. */
  votingPower: number;
  /** True only on the request that created the joining bonus. */
  joinedNow: boolean;
  joinBonusRsut: number;
  allocations: Record<number, number>;
  allocated: number;
  remaining: number;
  mint: {
    status: 'pending' | 'sent' | 'confirmed' | 'failed' | 'skipped' | 'none';
    txHash: string | null;
  };
};

export type ContributionDto = {
  id: number;
  who: string;
  email: string | null;
  amountAud: number;
  rsut: number;
  at: string;
  status: 'pending' | 'settled' | 'refunded' | 'cancelled';
  mintStatus: 'pending' | 'sent' | 'confirmed' | 'failed' | 'skipped';
  mintTxHash: string | null;
  kind: 'join' | 'contribution' | 'manual';
};

export type PayoutRowDto = {
  projectId: number;
  title: string;
  votes: number;
  share: number;
  amountAud: number;
  paidAt: string | null;
  payoutAddress: string | null;
};

export type CheckoutSessionDto = {
  provider: 'mock' | 'paddle' | 'stripe';
  reference: string;
  /** Where to send the browser, for redirect-style checkouts. */
  url: string | null;
  /** Token for overlay-style checkouts (Paddle.js). */
  clientToken: string | null;
  priceId: string | null;
  amountAud: number;
};

export type ApiError = { error: string; details?: unknown };

export function formatAud(amount: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(amount: number) {
  return new Intl.NumberFormat('en-AU').format(Math.round(amount));
}

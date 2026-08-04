/**
 * Mockup content only — no backend. Copy is merged from Kiran's email and the
 * live regen.sydney site so the page is judged against real content.
 *
 * Caveat carried over from the plan: the three live initiatives are already
 * funded and the programs are organising principles, so the final fundable set
 * is still open. Projects are admin-managed, so this seed is disposable.
 */

export type ProjectGroup = 'initiative' | 'program' | 'enabling';

export type CampaignProject = {
  id: string;
  title: string;
  program: string;
  group: ProjectGroup;
  summary: string;
  team: string;
  videoUrl: string;
  image: string;
  /** Votes already cast by other members, so the tally looks alive in the mockup. */
  baseVotes: number;
  active: boolean;
};

export const GROUP_LABELS: Record<ProjectGroup, string> = {
  initiative: 'Live initiatives',
  program: 'Demonstrator programs',
  enabling: 'Enabling conditions',
};

export const IMAGE_BASE = '/media';

export const SEED_PROJECTS: CampaignProject[] = [
  {
    id: 'ku-ring-gai',
    title: 'Ku-ring-gai community resilience pilot',
    program: 'Civic Neighbourhoods',
    group: 'initiative',
    summary:
      'A third neighbourhood demonstrator, building collective agency and ecological resilience with residents, local businesses and Ku-ring-gai Council.',
    team: 'Regen Sydney with Ku-ring-gai Council',
    videoUrl: 'https://vimeo.com/regensydney/ku-ring-gai',
    image: `${IMAGE_BASE}/community.webp`,
    baseVotes: 1840,
    active: true,
  },
  {
    id: 'living-waters-lab',
    title: 'Sydney Living Waters Lab at Sub-Base Platypus',
    program: 'Living Waters',
    group: 'initiative',
    summary:
      'A harbour-side lab convening catchment stewards, scientists and councils around waterway health, co-design and collective governance.',
    team: 'Regen Sydney, Blue Green Australia, Cooks River Alliance',
    videoUrl: 'https://vimeo.com/regensydney/living-waters-lab',
    image: `${IMAGE_BASE}/floating-foreshores.webp`,
    baseVotes: 2260,
    active: true,
  },
  {
    id: 'regen-cafes',
    title: 'Regen Cafes',
    program: 'Network Development',
    group: 'initiative',
    summary:
      'Monthly informal catch-ups where people swap stories, find collaborators and help map the city’s regenerative ecosystem of people and projects.',
    team: 'Regen Sydney network stewards',
    videoUrl: 'https://vimeo.com/regensydney/regen-cafes',
    image: `${IMAGE_BASE}/cafes.webp`,
    baseVotes: 1120,
    active: true,
  },
  {
    id: 'civic-neighbourhoods',
    title: 'Civic Neighbourhoods',
    program: 'Demonstrator program',
    group: 'program',
    summary:
      'Fosters civic engagement amongst residents, anchor institutions, businesses and councils. Builds participatory governance, maps transition pathways and forms Cornerstone Indicators. Includes the 12-month Regen Waverley program and a second demonstrator in the Inner West.',
    team: 'Waverley Council, Inner West Council, Regen Sydney',
    videoUrl: 'https://vimeo.com/regensydney/civic-neighbourhoods',
    image: `${IMAGE_BASE}/waverley.webp`,
    baseVotes: 2680,
    active: true,
  },
  {
    id: 'living-waters',
    title: 'Living Waters',
    program: 'Demonstrator program',
    group: 'program',
    summary:
      'A whole-of-catchment approach to waterway health, bringing a bioregional lens to co-design. Includes the Floating Foreshores project prototyping mycelium-based marine infrastructure and an emerging Harbour Indicators dashboard.',
    team: 'Cooks River Alliance, Blue Green Australia',
    videoUrl: 'https://vimeo.com/regensydney/living-waters',
    image: `${IMAGE_BASE}/harbour.webp`,
    baseVotes: 2040,
    active: true,
  },
  {
    id: 'food-futures',
    title: 'Food Futures',
    program: 'Demonstrator program',
    group: 'program',
    summary:
      'Convenes producers, urban farmers, academics and government through a Regen Food Chats network. Targets more than 5% of Sydneysiders participating in a regenerative food system by 2030.',
    team: 'Regen Food Chats network',
    videoUrl: 'https://vimeo.com/regensydney/food-futures',
    image: `${IMAGE_BASE}/food.webp`,
    baseVotes: 1560,
    active: true,
  },
  {
    id: 'measuring-what-matters',
    title: 'Measuring What Matters',
    program: 'Enabling condition',
    group: 'enabling',
    summary:
      'Co-creates a dashboard of social and ecological measures showing where Sydney is thriving and where it is falling short, shifting policymaking away from GDP towards holistic frameworks.',
    team: 'Regen Sydney research collaborative',
    videoUrl: 'https://vimeo.com/regensydney/measuring-what-matters',
    image: `${IMAGE_BASE}/doughnut.webp`,
    baseVotes: 1330,
    active: true,
  },
  {
    id: 'living-democracy',
    title: 'Living Democracy',
    program: 'Enabling condition',
    group: 'enabling',
    summary:
      'Builds trust in decision-making through deliberative democracy — citizens’ assemblies and juries — and prototypes bioregional, watershed-based forums for place-based participatory governance.',
    team: 'Regen Sydney with deliberative practitioners',
    videoUrl: 'https://vimeo.com/regensydney/living-democracy',
    image: `${IMAGE_BASE}/democracy.webp`,
    baseVotes: 980,
    active: true,
  },
  {
    id: 'weaving-cultures',
    title: 'Weaving Cultures',
    program: 'Enabling condition',
    group: 'enabling',
    summary:
      'Uses storytelling to mobilise a broad-based movement across polarised parts of society, attuning cross-sector efforts to the needs of people and place across the Sydney bioregion.',
    team: 'Digital Storytellers, Regen Sydney',
    videoUrl: 'https://vimeo.com/regensydney/weaving-cultures',
    image: `${IMAGE_BASE}/cultures.webp`,
    baseVotes: 860,
    active: true,
  },
  {
    id: 'commoning-capital',
    title: 'Commoning Capital',
    program: 'Enabling condition',
    group: 'enabling',
    summary:
      'Enables collective sensemaking of the landscape of capital and ownership, letting the system see itself, and develops systemic investment models including bioregional and decentralised funds.',
    team: 'Regen Sydney, Hypha',
    videoUrl: 'https://vimeo.com/regensydney/commoning-capital',
    image: `${IMAGE_BASE}/capital.webp`,
    baseVotes: 1240,
    active: true,
  },
];

export type MockContribution = {
  id: string;
  who: string;
  email: string;
  amountAud: number;
  rsut: number;
  /** ISO date, fixed so server and client render the same string. */
  at: string;
  status: 'settled' | 'pending';
};

export const SEED_CONTRIBUTIONS: MockContribution[] = [
  {
    id: 'txn_9f21',
    who: 'Priya N.',
    email: 'priya@example.org',
    amountAud: 250,
    rsut: 250,
    at: '2026-07-29',
    status: 'settled',
  },
  {
    id: 'txn_9e04',
    who: 'Tom H.',
    email: 'tom.h@example.com',
    amountAud: 50,
    rsut: 50,
    at: '2026-07-29',
    status: 'settled',
  },
  {
    id: 'txn_9d77',
    who: 'Marcela R.',
    email: 'marcela@example.net',
    amountAud: 1000,
    rsut: 1000,
    at: '2026-07-28',
    status: 'settled',
  },
  {
    id: 'txn_9c12',
    who: 'Ben A.',
    email: 'ben@example.com',
    amountAud: 100,
    rsut: 100,
    at: '2026-07-27',
    status: 'settled',
  },
  {
    id: 'txn_9b53',
    who: 'Sione F.',
    email: 'sione@example.org',
    amountAud: 500,
    rsut: 500,
    at: '2026-07-26',
    status: 'pending',
  },
];

/** Joining bonus minted on first login, in RSUT. 1 RSUT = A$1. */
export const JOIN_BONUS_RSUT = 50;

/** Philanthropic match applied to community contributions, for display only. */
export const MATCH_MULTIPLIER = 1;

export const SEED_CYCLE = {
  number: 3,
  name: 'Spring 2026 round',
  durationDays: 21,
  /** Fixed so the mockup never depends on the current clock for SSR. */
  endsAt: '2026-08-21T09:00:00.000Z',
  communityPotAud: 9225,
  contributors: 142,
};

export const ADMIN_EMAILS = ['kiran@regen.sydney', 'alex@hypha.earth'] as const;

/**
 * Seeds the ballot with Kiran's project list and opens the first round.
 *
 * Safe to re-run: projects are matched on slug and updated rather than
 * duplicated, and a round is only opened if none is open. It writes only to
 * the campaign's own database, named by CAMPAIGN_DB_URL.
 *
 *   pnpm --filter regen-sydney seed
 */

import { eq } from 'drizzle-orm';

import { campaignCycles, campaignProjects, db } from '../db';

type SeedProject = {
  slug: string;
  title: string;
  program: string;
  group: 'initiative' | 'program' | 'enabling';
  summary: string;
  team: string;
  imageUrl: string;
};

const PROJECTS: SeedProject[] = [
  {
    slug: 'ku-ring-gai',
    title: 'Ku-ring-gai community resilience pilot',
    program: 'Civic Neighbourhoods',
    group: 'initiative',
    summary:
      'A third neighbourhood demonstrator, building collective agency and ecological resilience with residents, local businesses and Ku-ring-gai Council.',
    team: 'Regen Sydney with Ku-ring-gai Council',
    imageUrl: '/media/community.webp',
  },
  {
    slug: 'living-waters-lab',
    title: 'Sydney Living Waters Lab at Sub-Base Platypus',
    program: 'Living Waters',
    group: 'initiative',
    summary:
      'A harbour-side lab convening catchment stewards, scientists and councils around waterway health, co-design and collective governance.',
    team: 'Regen Sydney, Blue Green Australia, Cooks River Alliance',
    imageUrl: '/media/floating-foreshores.webp',
  },
  {
    slug: 'regen-cafes',
    title: 'Regen Cafes',
    program: 'Network Development',
    group: 'initiative',
    summary:
      'Monthly informal catch-ups where people swap stories, find collaborators and help map the city’s regenerative ecosystem of people and projects.',
    team: 'Regen Sydney network stewards',
    imageUrl: '/media/cafes.webp',
  },
  {
    slug: 'civic-neighbourhoods',
    title: 'Civic Neighbourhoods',
    program: 'Demonstrator program',
    group: 'program',
    summary:
      'Fosters civic engagement amongst residents, anchor institutions, businesses and councils. Builds participatory governance, maps transition pathways and forms Cornerstone Indicators. Includes the 12-month Regen Waverley program and a second demonstrator in the Inner West.',
    team: 'Waverley Council, Inner West Council, Regen Sydney',
    imageUrl: '/media/waverley.webp',
  },
  {
    slug: 'living-waters',
    title: 'Living Waters',
    program: 'Demonstrator program',
    group: 'program',
    summary:
      'A whole-of-catchment approach to waterway health, bringing a bioregional lens to co-design. Includes the Floating Foreshores project prototyping mycelium-based marine infrastructure and an emerging Harbour Indicators dashboard.',
    team: 'Cooks River Alliance, Blue Green Australia',
    imageUrl: '/media/harbour.webp',
  },
  {
    slug: 'food-futures',
    title: 'Food Futures',
    program: 'Demonstrator program',
    group: 'program',
    summary:
      'Convenes producers, urban farmers, academics and government through a Regen Food Chats network. Targets more than 5% of Sydneysiders participating in a regenerative food system by 2030.',
    team: 'Regen Food Chats network',
    imageUrl: '/media/food.webp',
  },
  {
    slug: 'measuring-what-matters',
    title: 'Measuring What Matters',
    program: 'Enabling condition',
    group: 'enabling',
    summary:
      'Co-creates a dashboard of social and ecological measures showing where Sydney is thriving and where it is falling short, shifting policymaking away from GDP towards holistic frameworks.',
    team: 'Regen Sydney research collaborative',
    imageUrl: '/media/doughnut.webp',
  },
  {
    slug: 'living-democracy',
    title: 'Living Democracy',
    program: 'Enabling condition',
    group: 'enabling',
    summary:
      'Builds trust in decision-making through deliberative democracy — citizens’ assemblies and juries — and prototypes bioregional, watershed-based forums for place-based participatory governance.',
    team: 'Regen Sydney with deliberative practitioners',
    imageUrl: '/media/democracy.webp',
  },
  {
    slug: 'weaving-cultures',
    title: 'Weaving Cultures',
    program: 'Enabling condition',
    group: 'enabling',
    summary:
      'Uses storytelling to mobilise a broad-based movement across polarised parts of society, attuning cross-sector efforts to the needs of people and place across the Sydney bioregion.',
    team: 'Digital Storytellers, Regen Sydney',
    imageUrl: '/media/cultures.webp',
  },
  {
    slug: 'commoning-capital',
    title: 'Commoning Capital',
    program: 'Enabling condition',
    group: 'enabling',
    summary:
      'Enables collective sensemaking of the landscape of capital and ownership, letting the system see itself, and develops systemic investment models including bioregional and decentralised funds.',
    team: 'Regen Sydney, Hypha',
    imageUrl: '/media/capital.webp',
  },
];

async function main() {
  console.log(`Seeding ${PROJECTS.length} projects…`);

  for (const [index, project] of PROJECTS.entries()) {
    const existing = await db.query.campaignProjects.findFirst({
      where: eq(campaignProjects.slug, project.slug),
    });

    if (existing) {
      await db
        .update(campaignProjects)
        .set({ ...project, sortOrder: index + 1, updatedAt: new Date() })
        .where(eq(campaignProjects.id, existing.id));
      console.log(`  updated ${project.slug}`);
    } else {
      await db
        .insert(campaignProjects)
        .values({ ...project, sortOrder: index + 1 });
      console.log(`  created ${project.slug}`);
    }
  }

  const open = await db.query.campaignCycles.findFirst({
    where: eq(campaignCycles.status, 'open'),
  });

  if (open) {
    console.log(`Round ${open.number} is already open — leaving it alone.`);
  } else {
    const durationDays = 21;
    const [cycle] = await db
      .insert(campaignCycles)
      .values({
        number: 1,
        name: 'Opening round',
        status: 'open',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
        durationDays,
        matchMultiplier: '1',
      })
      .returning();
    console.log(`Opened round ${cycle?.number} for ${durationDays} days.`);
  }

  console.log('Done.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

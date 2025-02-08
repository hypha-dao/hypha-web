import { drizzle } from 'drizzle-orm/node-postgres';
import { faker } from '@faker-js/faker';

import { seed, reset } from 'drizzle-seed';

import {
  people,
  memberships,
  spaces,
  documents,
  documentDiscussions,
  documentStateTransitions,
  schema,
} from './schema';
import { resetIndexes } from './utils/reset-index';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
const AVATAR_URLS = Array.from({ length: 10 }, () => faker.image.avatar());
const SPACE_LOGO_URLS = Array.from({ length: 10 }, () =>
  faker.image.url({
    width: 120,
    height: 120,
  }),
);
const SPACE_LEAD_IMAGE_URLS = Array.from({ length: 10 }, () =>
  faker.image.url({
    width: 762,
    height: 150,
  }),
);

async function main() {
  const db = drizzle(process.env.BRANCH_DB_URL! || process.env.DEFAULT_DB_URL!);

  // Reset all tables
  await reset(db, {
    people,
    memberships,
    spaces,
    documents,
    documentDiscussions,
    documentStateTransitions,
  });

  // Seed data
  await seed(db, {
    people,
    memberships,
    spaces,
    documents,
    documentDiscussions,
    documentStateTransitions,
  }).refine((f) => {
    return {
      people: {
        // count: 1000,
        with: {
          memberships: 2,
          // documents: 10,
          documents: 2,
        },
        columns: {
          avatarUrl: f.valuesFromArray({
            values: AVATAR_URLS,
          }),
          name: f.firstName(),
          surname: f.lastName(),
          description: f.loremIpsum(),
          location: f.city(),
        },
      },
      documents: {
        columns: {
          title: f.loremIpsum(),
          description: f.loremIpsum({ sentencesCount: 10 }),
        },
      },
      documentDiscussions: {
        count: 5, // Create 5 discussions per document
        columns: {
          content: f.loremIpsum({ sentencesCount: 3 }),
          // parentId will be null for top-level comments
        },
      },
      documentStateTransitions: {
        count: 1, // One transition to put it into discussion state
        columns: {
          fromState: f.default({ defaultValue: 'discussion' }),
          toState: f.default({ defaultValue: 'proposal' }),
          reason: f.loremIpsum({ sentencesCount: 1 }),
        },
      },
      spaces: {
        // count: 1000,
        with: {
          memberships: 2,
        },
        columns: {
          title: f.companyName(),
          description: f.loremIpsum(),
          logoUrl: f.valuesFromArray({
            values: SPACE_LOGO_URLS,
          }),
          leadImage: f.valuesFromArray({
            values: SPACE_LEAD_IMAGE_URLS,
          }),
        },
      },
    };
  });
  await resetIndexes(db as unknown as NodePgDatabase<typeof schema>);
}

main();

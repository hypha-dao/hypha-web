import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { faker } from '@faker-js/faker';
import { seed, reset } from 'drizzle-seed';

import { resetIndexes } from './utils/reset-index';
import { documents, memberships, people, schema, spaces } from './schema';
import { CATEGORIES } from './schema/categories';

const AVATAR_URLS = Array.from({ length: 10 }, () => faker.image.avatar());
const SPACE_LOGO_URLS = Array.from({ length: 10 }, () =>
  faker.image.urlPicsumPhotos({
    width: 120,
    height: 120,
  }),
);
const SPACE_LEAD_IMAGE_URLS = Array.from({ length: 10 }, () =>
  faker.image.urlPicsumPhotos({
    width: 762,
    height: 150,
  }),
);

const SAMPLE_LINKS = Array.from({ length: 10 }, () => faker.internet.url());
const SAMPLE_CATEGORIES = [...CATEGORIES];

async function main() {
  const db = drizzle(process.env.BRANCH_DB_URL! || process.env.DEFAULT_DB_URL!);
  await reset(db, { people, memberships, spaces, documents });
  await seed(db, { people, memberships, spaces, documents }).refine((f) => {
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
          state: f.valuesFromArray({
            values: ['discussion', 'proposal', 'agreement'],
          }),
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
          links: f.valuesFromArray({
            values: SAMPLE_LINKS,
            arraySize: 2,
          }),
          categories: f.valuesFromArray({
            values: SAMPLE_CATEGORIES,
            arraySize: 2,
          }),
        },
      },
    };
  });
  await resetIndexes(db as unknown as NodePgDatabase<typeof schema>);
}

main();

import { crudPolicy, authenticatedRole, authUid } from 'drizzle-orm/neon';
import { InferInsertModel, InferSelectModel, sql } from 'drizzle-orm';
import { pgTable, serial, text } from 'drizzle-orm/pg-core';
import { commonDateFields } from './shared';

export const people = pgTable(
  'people',
  {
    id: serial('id').primaryKey(),
    sub: text('sub')
      .unique()
      .default(sql`(auth.user_id())`),
    slug: text('slug').unique(),
    avatarUrl: text('avatar_url'),
    leadImageUrl: text('lead_image_url'),
    description: text('description'),
    email: text('email').unique(),
    location: text('location'),
    name: text('name'),
    surname: text('surname'),
    nickname: text('nickname'),
    address: text('web3_address'),
    ...commonDateFields,
  },
  (table) => [
    // Apply RLS policy
    crudPolicy({
      role: authenticatedRole,
      read: true,
      modify: authUid(table.sub),
    }),
  ],
);

export type Person = InferSelectModel<typeof people>;
export type NewPerson = InferInsertModel<typeof people>;

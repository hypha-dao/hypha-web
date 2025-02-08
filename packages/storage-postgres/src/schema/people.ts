import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { commonDateFields } from './shared';

export const people = pgTable('people', {
  ...commonDateFields,
  slug: text('slug').unique(),
  avatarUrl: text('avatar_url'),
  description: text('description'),
  email: text('email').unique(),
  location: text('location'),
  name: text('name'),
  surname: text('surname'),
  nickname: text('nickname'),
});

export type Person = InferSelectModel<typeof people>;
export type NewPerson = InferInsertModel<typeof people>;

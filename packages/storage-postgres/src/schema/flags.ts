import { pgEnum } from 'drizzle-orm/pg-core';

export const SPACE_FLAGS = ['sandbox', 'demo'] as const;
export const spaceFlags = pgEnum('space_flags', SPACE_FLAGS);

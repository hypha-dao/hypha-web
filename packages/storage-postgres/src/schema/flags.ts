import { pgEnum } from 'drizzle-orm/pg-core';
import { SPACE_FLAGS } from '../../../core/src/categories';

export const spaceFlags = pgEnum('flags', SPACE_FLAGS);

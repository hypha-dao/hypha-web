import { pgEnum } from 'drizzle-orm/pg-core';
import { CATEGORIES } from '../../../core/src/categories';

export const categories = pgEnum('categories', CATEGORIES);

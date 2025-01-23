// src/db.ts
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config({ path: '../.env' }); // or .env.local

const sql = neon(process.env.POSTGRES_URL!);
export const db = drizzle({ client: sql });

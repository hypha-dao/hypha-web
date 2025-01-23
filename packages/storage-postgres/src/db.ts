import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config({ path: '../.env' }); // Use test environment file

// Use the non-pooling URL for Neon serverless
const sql = neon(process.env.POSTGRES_URL!);
export const db = drizzle(sql);

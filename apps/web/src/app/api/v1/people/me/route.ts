import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { people } from '@hypha-platform/storage-postgres';
import { drizzle } from 'drizzle-orm/neon-http';

export async function GET(request: NextRequest) {
  const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';

  const db = drizzle(
    neon(process.env.DEFAULT_DB_AUTHENTICATED_URL!, {
      authToken: authToken, // Pass the generated JWT here
    }),
  );

  const [user] = await db.select().from(people).limit(1);

  return NextResponse.json({ ...user });
}

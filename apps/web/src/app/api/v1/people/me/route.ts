import { findSelf, getDb } from '@hypha-platform/core/server';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const headersList = await headers();
  const authToken = headersList.get('Authorization')?.split(' ')[1] || '';
  try {
    if (!authToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        {
          status: 401,
        },
      );
    }

    const user = await findSelf({ db: getDb({ authToken }) });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json({ ...user });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      {
        status: 500,
      },
    );
  }
}

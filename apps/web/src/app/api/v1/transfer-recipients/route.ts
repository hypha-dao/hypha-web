import { NextResponse } from 'next/server';
import { findAllSpaces, listPayablePeople } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

const PAYABLE_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

/**
 * Recipients for a direct transfer. Read from the database only — the public
 * spaces list also asks the chain for every space, and that failure was
 * hiding the people list.
 */
export async function GET() {
  const [peopleResult, spacesResult] = await Promise.allSettled([
    listPayablePeople({ db }),
    findAllSpaces({ db }, { parentOnly: false, omitArchived: true }),
  ]);

  if (peopleResult.status === 'rejected') {
    console.error(
      'Failed to load transfer recipient people:',
      peopleResult.reason,
    );
  }
  if (spacesResult.status === 'rejected') {
    console.error(
      'Failed to load transfer recipient spaces:',
      spacesResult.reason,
    );
  }

  const people = peopleResult.status === 'fulfilled' ? peopleResult.value : [];
  const spaces =
    spacesResult.status === 'fulfilled'
      ? spacesResult.value.flatMap((space) => {
          const address = space.address?.trim() ?? '';
          if (!space.id || !space.slug || !PAYABLE_ADDRESS.test(address)) {
            return [];
          }
          return [
            {
              id: space.id,
              title: space.title ?? '',
              slug: space.slug,
              address,
              logoUrl: space.logoUrl ?? null,
              web3SpaceId: space.web3SpaceId ?? null,
              parentId: space.parentId ?? null,
              flags: space.flags ?? [],
            },
          ];
        })
      : [];

  if (peopleResult.status === 'rejected' && people.length === 0) {
    return NextResponse.json(
      { error: 'Failed to load recipients' },
      { status: 500 },
    );
  }

  return NextResponse.json({ people, spaces });
}

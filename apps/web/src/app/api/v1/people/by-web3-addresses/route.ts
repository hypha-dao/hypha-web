import { NextRequest, NextResponse } from 'next/server';

import { findPeopleByWeb3Addresses } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const MAX_ADDRESSES = 64;

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('addresses') ?? '';
  const addresses = [
    ...new Set(
      raw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];

  if (addresses.length === 0) {
    return NextResponse.json({});
  }
  if (addresses.length > MAX_ADDRESSES) {
    return NextResponse.json({ error: 'Too many addresses' }, { status: 400 });
  }
  if (addresses.some((address) => !ADDRESS_RE.test(address))) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
  }

  try {
    const people = await findPeopleByWeb3Addresses({ addresses }, { db });
    // Duplicate web3_address: lowest id wins. Map insertion order is not a
    // query-order guarantee, so last-row-wins would be nondeterministic.
    const byAddress = new Map<string, (typeof people)[number]>();
    for (const person of [...people].sort((a, b) => a.id - b.id)) {
      const address = person.address?.toLowerCase();
      if (!address || byAddress.has(address)) continue;
      byAddress.set(address, person);
    }

    const result: Record<string, (typeof people)[number] | null> = {};
    for (const address of addresses) {
      result[address.toLowerCase()] =
        byAddress.get(address.toLowerCase()) ?? null;
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch people by web3 addresses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch people' },
      { status: 500 },
    );
  }
}

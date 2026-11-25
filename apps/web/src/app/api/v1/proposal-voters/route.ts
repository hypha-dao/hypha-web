import { NextRequest, NextResponse } from 'next/server';

import { getProposalVoters, publicClient } from '@hypha-platform/core/client';
import { findPeopleByWeb3Addresses } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { resolveMappedHostScope } from '../../../../lib/white-label/mapped-host-scope';

/** Most proposals one request may ask for. The client splits larger sets. */
const MAX_SLUGS = 25;

type Voter = {
  id: number;
  name: string;
  avatarUrl: string | null | undefined;
  vote: 'yes' | 'no';
  address: string | null | undefined;
};

/**
 * Voters of several proposals in one request: the batched form of
 * `GET /api/v1/documents/[documentSlug]/voters`, with the same access rules.
 *
 * `?slugs=a,b,c` (distinct, at most 25). Answers `{ voters, failed }`:
 * `voters[slug]` for each proposal read, `failed` for slugs whose chain read
 * failed (retry later). A slug that is unknown, has no proposal, or is not in
 * the mapped host's Space is simply absent from both.
 */
export async function GET(request: NextRequest) {
  const slugs = [
    ...new Set(
      (request.nextUrl.searchParams.get('slugs') ?? '')
        .split(',')
        .map((slug) => slug.trim())
        .filter(Boolean),
    ),
  ];

  if (slugs.length === 0 || slugs.length > MAX_SLUGS) {
    return NextResponse.json(
      { error: `Provide between 1 and ${MAX_SLUGS} document slugs` },
      { status: 400 },
    );
  }

  try {
    const scope = await resolveMappedHostScope(request, { db });
    if (scope.kind === 'unknown-space') {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      );
    }

    const rows = await db.query.documents.findMany({
      columns: { slug: true, spaceId: true, web3ProposalId: true },
      where: (documents, { inArray }) => inArray(documents.slug, slugs),
    });

    // Mapped host: only proposals of the host's own Space.
    const proposals = slugs.flatMap((slug) => {
      const row = rows.find((candidate) => candidate.slug === slug);
      if (!row?.web3ProposalId) return [];
      if (scope.kind === 'mapped' && row.spaceId !== scope.spaceId) return [];
      return [{ slug, web3ProposalId: row.web3ProposalId }];
    });

    if (proposals.length === 0) {
      return NextResponse.json({ voters: {}, failed: [] });
    }

    const reads = await publicClient.multicall({
      contracts: proposals.map(({ web3ProposalId }) =>
        getProposalVoters({ proposalId: BigInt(web3ProposalId) }),
      ),
      allowFailure: true,
    });

    const failed: string[] = [];
    const chainVoters = new Map<
      string,
      { yes: Set<string>; no: Set<string> }
    >();
    proposals.forEach(({ slug }, index) => {
      const read = reads[index];
      if (!read || read.status !== 'success') {
        failed.push(slug);
        return;
      }
      const [yes, no] = read.result as readonly [
        readonly string[],
        readonly string[],
      ];
      chainVoters.set(slug, {
        yes: new Set(yes.map((address) => address.toLowerCase())),
        no: new Set(no.map((address) => address.toLowerCase())),
      });
    });

    const addresses = [
      ...new Set(
        [...chainVoters.values()].flatMap(({ yes, no }) => [...yes, ...no]),
      ),
    ];
    const people = await findPeopleByWeb3Addresses(
      { addresses: addresses as `0x${string}`[] },
      { db },
    );
    const personByAddress = new Map(
      people.map((person) => [person.address?.toLowerCase() ?? '', person]),
    );

    // No prototype: any slug (`__proto__`, `constructor`) is an ordinary key.
    const voters: Record<string, Voter[]> = Object.create(null);
    for (const [slug, { yes, no }] of chainVoters) {
      voters[slug] = [...yes, ...no].flatMap((address) => {
        const person = personByAddress.get(address);
        if (!person) return [];
        return [
          {
            id: person.id,
            name: `${person.name} ${person.surname}`,
            avatarUrl: person.avatarUrl,
            vote: yes.has(address) ? ('yes' as const) : ('no' as const),
            address: person.address,
          },
        ];
      });
    }

    return NextResponse.json({ voters, failed });
  } catch (error) {
    console.error('Failed to fetch voters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch voters' },
      { status: 500 },
    );
  }
}

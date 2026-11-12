import { NextRequest, NextResponse } from 'next/server';

import { getProposalVoters, publicClient } from '@hypha-platform/core/client';
import {
  findDocumentBySlug,
  findPeopleByWeb3Addresses,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import {
  findDocumentSpace,
  resolveMappedHostScope,
} from '../../../../../../lib/white-label/mapped-host-scope';

type Params = { documentSlug: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { documentSlug } = await params;

  if (!documentSlug || typeof documentSlug !== 'string') {
    return NextResponse.json(
      { error: 'Invalid document slug' },
      { status: 400 },
    );
  }

  try {
    // Mapped host (Space header set by middleware): voters of a proposal of
    // the host's own Space only. The row that passes the Space check is the one
    // read below. No header means the main app, unchanged.
    const scope = await resolveMappedHostScope(request, { db });
    let web3ProposalId: number | null | undefined;
    if (scope.kind === 'main') {
      const document = await findDocumentBySlug({ slug: documentSlug }, { db });
      web3ProposalId = document?.web3ProposalId;
    } else {
      const row =
        scope.kind === 'mapped'
          ? await findDocumentSpace({ slug: documentSlug }, { db })
          : null;
      if (!row || scope.kind !== 'mapped' || row.spaceId !== scope.spaceId) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 },
        );
      }
      web3ProposalId = row.web3ProposalId;
    }

    if (!web3ProposalId) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      );
    }

    const [yesVoters, noVoters] = await publicClient.readContract(
      getProposalVoters({
        proposalId: BigInt(web3ProposalId),
      }),
    );

    const people = await findPeopleByWeb3Addresses(
      {
        addresses: [...yesVoters, ...noVoters],
      },
      { db },
    );

    const peopleWithVotes = people.map((person) => ({
      id: person.id,
      name: `${person.name} ${person.surname}`,
      avatarUrl: person.avatarUrl,
      vote: yesVoters.includes(person.address as `0x${string}`) ? 'yes' : 'no',
      address: person.address,
    }));

    return NextResponse.json({ voters: peopleWithVotes });
  } catch (error) {
    console.error('Failed to fetch voters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch voters' },
      { status: 500 },
    );
  }
}

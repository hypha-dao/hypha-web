import { NextRequest, NextResponse } from 'next/server';

import { getProposalVoters, publicClient } from '@hypha-platform/core/client';
import {
  findDocumentBySlug,
  findPeopleByWeb3Addresses,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import {
  findDocumentSpaceId,
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
    // the host's own Space only. No header means the main app, unchanged.
    const scope = await resolveMappedHostScope(request);
    if (scope.kind !== 'main') {
      const documentSpaceId =
        scope.kind === 'mapped'
          ? await findDocumentSpaceId({ slug: documentSlug })
          : null;
      if (scope.kind !== 'mapped' || documentSpaceId !== scope.spaceId) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 },
        );
      }
    }

    const document = await findDocumentBySlug({ slug: documentSlug }, { db });

    if (!document || !document.web3ProposalId) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      );
    }

    const [yesVoters, noVoters] = await publicClient.readContract(
      getProposalVoters({
        proposalId: BigInt(document.web3ProposalId),
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

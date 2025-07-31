import { NextRequest, NextResponse } from 'next/server';

import { getProposalVoters, publicClient } from '@hypha-platform/core/client';
import {
  findDocumentBySlug,
  findPeopleByWeb3Addresses,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

type Params = { documentSlug: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { documentSlug } = await params;

  const document = await findDocumentBySlug({ slug: documentSlug }, { db });

  if (!document || !document.web3ProposalId) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
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

  const peopleWithVotes = people.map((person) => {
    return {
      name: `${person.name} ${person.surname}`,
      avatarUrl: person.avatarUrl,
      vote: yesVoters.includes(person.address ?? '0x') ? 'yes' : 'no',
    };
  });

  return NextResponse.json({ voters: peopleWithVotes });
}

import { NextRequest, NextResponse } from 'next/server';
import { appendFileSync } from 'node:fs';

import { getProposalVoters, publicClient } from '@hypha-platform/core/client';
import {
  findDocumentBySlug,
  findPeopleByWeb3Addresses,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

type Params = { documentSlug: string };

const appendDebugLog = (
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>,
) => {
  appendFileSync(
    '/opt/cursor/logs/debug.log',
    JSON.stringify({
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }) + '\n',
  );
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { documentSlug } = await params;
  // #region agent log
  appendDebugLog(
    'B',
    'documents/[documentSlug]/voters/route.ts:33',
    'GET entry',
    {
      documentSlug,
    },
  );
  // #endregion

  if (!documentSlug || typeof documentSlug !== 'string') {
    return NextResponse.json(
      { error: 'Invalid document slug' },
      { status: 400 },
    );
  }

  try {
    const document = await findDocumentBySlug({ slug: documentSlug }, { db });

    if (!document || !document.web3ProposalId) {
      // #region agent log
      appendDebugLog(
        'B',
        'documents/[documentSlug]/voters/route.ts:50',
        'missing proposal identifier',
        {
          hasDocument: Boolean(document),
          web3ProposalId: document?.web3ProposalId ?? null,
        },
      );
      // #endregion
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      );
    }

    // #region agent log
    appendDebugLog(
      'C',
      'documents/[documentSlug]/voters/route.ts:64',
      'before BigInt conversion',
      {
        web3ProposalId: document.web3ProposalId,
        proposalIdType: typeof document.web3ProposalId,
      },
    );
    // #endregion

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
      name: `${person.name} ${person.surname}`,
      avatarUrl: person.avatarUrl,
      vote: yesVoters.includes(person.address as `0x${string}`) ? 'yes' : 'no',
      address: person.address,
    }));

    // #region agent log
    appendDebugLog(
      'B',
      'documents/[documentSlug]/voters/route.ts:92',
      'GET success',
      {
        yesVotersCount: yesVoters.length,
        noVotersCount: noVoters.length,
        peopleCount: people.length,
      },
    );
    // #endregion

    return NextResponse.json({ voters: peopleWithVotes });
  } catch (error) {
    console.error('Failed to fetch voters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch voters' },
      { status: 500 },
    );
  }
}

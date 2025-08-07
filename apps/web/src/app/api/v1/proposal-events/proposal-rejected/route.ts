import { ethers } from 'ethers';
import { NextResponse } from 'next/server';
import { daoProposalsImplementationConfig } from '@hypha-platform/core/generated';
import { headers } from 'next/headers';

if (!process.env.ALCHEMY_API_KEY) {
  throw new Error('ALCHEMY_API_KEY environment variable is not set');
}

const WS_URL = `wss://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

export async function GET(request: Request) {
  const headersList = await headers();
  const authToken = headersList.get('Authorization')?.split(' ')[1] || '';
  const { searchParams } = new URL(request.url);
  const proposalId = searchParams.get('proposalId');

  if (!proposalId) {
    return NextResponse.json({ error: 'Missing proposalId' }, { status: 400 });
  }

  try {
    if (!authToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        {
          status: 401,
        },
      );
    }
    const provider = new ethers.WebSocketProvider(WS_URL);
    const contract = new ethers.Contract(
      daoProposalsImplementationConfig.address[8453],
      daoProposalsImplementationConfig.abi,
      provider,
    );

    const headers = {
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache',
      'Content-Type': 'text/event-stream',
    };

    const stream = new ReadableStream({
      async start(controller) {
        contract.on(
          'ProposalRejected',
          (eventProposalId: bigint, yesVotes: bigint, noVotes: bigint) => {
            if (eventProposalId !== BigInt(proposalId)) return;

            const data = JSON.stringify({
              event: 'ProposalRejected',
              proposalId: String(eventProposalId),
              yesVotes: String(yesVotes),
              noVotes: String(noVotes),
            });
            controller.enqueue(`data: ${data}\n\n`);
          },
        );

        const keepAlive = setInterval(() => {
          controller.enqueue(':\n\n');
        }, 15000);

        request.signal.addEventListener('abort', () => {
          clearInterval(keepAlive);
          provider.destroy?.();
          controller.close();
        });
      },
      cancel() {
        provider.destroy?.();
      },
    });

    return new NextResponse(stream, { headers });
  } catch (error) {
    console.error('WebSocket error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

import { ethers } from 'ethers';
import { NextResponse } from 'next/server';
import { daoProposalsImplementationConfig } from '@hypha-platform/core/generated';

const WS_URL = `wss://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const proposalId = searchParams.get('proposalId');

  if (!proposalId) {
    return NextResponse.json({ error: 'Missing proposalId' }, { status: 400 });
  }

  try {
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
        const filter = contract.filters.ProposalExecuted;
        if (!filter) {
          throw new Error(
            'ProposalExecuted filter is not defined in the contract ABI',
          );
        }

        const topics = await filter().getTopicFilter();

        provider.on({ topics }, (log: ethers.Log) => {
          try {
            const parsed = contract.interface.parseLog(log);
            const eventProposalId = parsed?.args[0] as bigint;

            if (eventProposalId !== BigInt(proposalId)) return;

            const txHash = log.transactionHash;

            const data = JSON.stringify({
              event: 'ProposalExecuted',
              proposalId: String(eventProposalId),
              txHash,
            });
            controller.enqueue(`data: ${data}\n\n`);
          } catch (error) {
            console.error('Error parsing log:', error);
          }
        });

        const keepAlive = setInterval(() => {
          controller.enqueue(':\n\n');
        }, 15000);

        request.signal.addEventListener('abort', () => {
          clearInterval(keepAlive);
          provider.removeAllListeners({ topics });
          if (provider.destroy) {
            provider.destroy();
          }
          controller.close();
        });
      },
      cancel() {
        if (provider.destroy) {
          provider.destroy();
        }
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

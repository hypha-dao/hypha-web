import { Address, WalletClient, createPublicClient, http, Chain } from 'viem';
import { SpaceRepository } from './repository';
import { Space } from './types';
import { mainnet } from 'viem/chains';

import { getSpace, spaceFactoryAbi } from '@hypha-platform/storage-evm';

export class SpaceEvmRepository implements SpaceRepository {
  private client: ReturnType<typeof createPublicClient>;
  private chain: Chain;

  constructor(
    rpcUrl: string,
    private contractAddress: Address,
    chain: Chain = mainnet,
  ) {
    this.chain = chain;
    this.client = createPublicClient({
      chain: this.chain,
      transport: http(rpcUrl),
    });
  }

  async findAll(): Promise<Space[]> {
    const slugs = (await this.client.readContract({
      address: this.contractAddress,
      abi: spaceFactoryAbi,
      functionName: 'getAllSlugs',
    })) as string[];

    const spaces = await Promise.all(
      slugs.map(async (slug) => {
        const space = await this.findBySlug(slug);
        return space as Space;
      }),
    );

    return spaces.filter((space): space is Space => space !== null);
  }

  async findById(): Promise<Space | null> {
    throw new Error('Method not supported in EVM repository');
  }

  async findBySlug(slug: string): Promise<Space | null> {
    const result = await getSpace({ slug });

    return {
      ...result,
      createdAt: new Date(Number(result.createdAt) * 1000),
    };
  }

  async create(params: {
    title: string;
    description: string;
    slug: string;
    walletClient: WalletClient;
  }): Promise<Space> {
    // 1. Simulate the contract write to check for potential errors
    const { request } = await this.client.simulateContract({
      address: this.contractAddress,
      abi: spaceFactoryAbi,
      functionName: 'createSpace',
      args: [params.title, params.description, params.slug],
      account: params.walletClient.account,
    });

    // 2. Execute the contract write
    const hash = await params.walletClient.writeContract(request);

    // 3. Wait for the transaction to be mined
    const receipt = await this.client.waitForTransactionReceipt({ hash });

    // 4. Fetch and return the newly created space
    const space = await this.findBySlug(params.slug);
    if (!space) {
      throw new Error('Failed to create space');
    }

    return space;
  }
}

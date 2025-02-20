import { ethers } from 'ethers';
import { SpaceFactory } from '@hypha-platform/storage-evm/typechain-types';
import { abi } from '@hypha-platform/storage-evm/artifacts/contracts/SpaceFactory.sol/SpaceFactory.json';
import { SpaceRepository } from './repository';
import { Space } from './types';

export class SpaceEvmRepository implements SpaceRepository {
  private contract: SpaceFactory;

  constructor(
    private provider: ethers.Provider,
    private contractAddress: string,
  ) {
    this.contract = new ethers.Contract(
      contractAddress,
      abi,
      provider,
    ) as unknown as SpaceFactory;
  }

  async findAll(): Promise<Space[]> {
    const slugs = await this.contract.getAllSlugs();
    const spaces = await Promise.all(
      slugs.map(async (slug) => {
        const space = await this.contract.getSpace(slug);
        return {
          title: space.title,
          description: space.description,
          slug: space.slug,
          owner: space.owner,
          createdAt: new Date(Number(space.createdAt) * 1000),
        };
      }),
    );
    return spaces;
  }

  async findById(): Promise<Space | null> {
    throw new Error('Method not supported in EVM repository');
  }

  async findBySlug(slug: string): Promise<Space | null> {
    try {
      const space = await this.contract.getSpace(slug);
      return {
        title: space.title,
        description: space.description,
        slug: space.slug,
        owner: space.owner,
        createdAt: new Date(Number(space.createdAt) * 1000),
      };
    } catch (error) {
      return null;
    }
  }

  async create(params: {
    title: string;
    description: string;
    slug: string;
    signer: ethers.Signer;
  }): Promise<Space> {
    const { title, description, slug, signer } = params;

    const connectedContract = this.contract.connect(signer);
    const tx = await connectedContract.createSpace(title, description, slug);
    const receipt = await tx.wait();

    const event = receipt.logs[0];
    const parsedEvent = this.contract.interface.parseLog(event);

    return {
      slug: parsedEvent.args.slug,
      title: parsedEvent.args.title,
      owner: parsedEvent.args.owner,
      createdAt: new Date(Number(parsedEvent.args.timestamp) * 1000),
      description: description,
    };
  }
}

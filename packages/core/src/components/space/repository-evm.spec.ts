import { describe, it, expect } from 'vitest';
import { createWalletClient, http, WalletClient } from 'viem';
import { hardhat } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { SpaceEvmRepository } from './repository-evm';
import { spaceFactoryAddress } from '@hypha-platform/storage-evm';

import { faker } from '@faker-js/faker';

describe('SpaceEvmRepository', () => {
  let spaceRepo: SpaceEvmRepository;
  let walletClient: WalletClient;

  const HARDHAT_RPC = 'http://127.0.0.1:8545'; // Changed from localhost to 127.0.0.1

  // Hardhat's first private key
  const PRIVATE_KEY =
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

  beforeAll(async () => {
    const account = privateKeyToAccount(PRIVATE_KEY);
    walletClient = createWalletClient({
      account,
      chain: hardhat,
      transport: http(HARDHAT_RPC),
    });
  });

  beforeEach(() => {
    spaceRepo = new SpaceEvmRepository(
      HARDHAT_RPC,
      spaceFactoryAddress[hardhat.id],
      hardhat,
    );
  });

  describe('SpaceEvmRepository', () => {
    it('create space', async () => {
      const spaceProps = {
        title: faker.lorem.words(3),
        description: faker.lorem.words(10),
        slug: faker.lorem.slug(3),
      };
      const space = await spaceRepo.create({
        ...spaceProps,
        walletClient,
      });

      expect(space).toMatchObject({
        ...spaceProps,
        owner: walletClient.account.address,
        createdAt: expect.any(Date),
      });
    });
  });
});

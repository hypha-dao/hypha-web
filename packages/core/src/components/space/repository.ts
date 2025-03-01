import { Repository } from '../../container/types';
import { Space } from './types';
import { ethers } from 'ethers';
import { WalletClient } from 'viem';

export interface SpaceRepository extends Repository {
  findById(id: number): Promise<Space | null>;
  findBySlug(slug: string): Promise<Space | null>;
  findAll(): Promise<Space[]>;
  findAllByMemberId(memberId: number): Promise<Space[]>;
  create?(params: {
    title: string;
    description: string;
    slug: string;
    walletClient: WalletClient;
  }): Promise<Space>;
}

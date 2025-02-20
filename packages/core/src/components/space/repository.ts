import { Repository } from '../../container/types';
import { Space } from './types';
import { ethers } from 'ethers';

export interface SpaceRepository extends Repository {
  findById(id: number): Promise<Space | null>;
  findBySlug(slug: string): Promise<Space | null>;
  findAll(): Promise<Space[]>;
  create?(params: {
    title: string;
    description: string;
    slug: string;
    signer: ethers.Signer;
  }): Promise<Space>;
}

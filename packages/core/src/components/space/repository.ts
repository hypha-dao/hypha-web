import {
  type CreateSpaceInput,
  type Space,
  type UpdateSpaceInput,
} from './types';

export interface SpaceRepository {
  create(data: CreateSpaceInput): Promise<Space>;
  updateBySlug(data: { slug: string } & UpdateSpaceInput): Promise<Space>;
  findById(id: number): Promise<Space | null>;
  findBySlug(slug: string): Promise<Space | null>;
  findAll(): Promise<Space[]>;
  findAllByMemberId(memberId: number): Promise<Space[]>;
}

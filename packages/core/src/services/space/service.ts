import { Space, SpaceRepository } from '@hypha-platform/model';
import { Container } from '../../container/types';
import { Tokens } from '../../container/tokens';
import { CreateSpaceInput, UpdateSpaceInput, SpaceListOptions } from './types';
import {
  SpaceNotFoundError,
  DuplicateSlugError,
  InvalidSpaceDataError,
} from './errors';

export class SpaceService {
  private repository: SpaceRepository;

  constructor(private container: Container) {
    this.repository = container.get(Tokens.SpaceRepository);
  }

  async create(input: CreateSpaceInput): Promise<Space> {
    // Validate input
    if (!input.title) {
      throw new InvalidSpaceDataError('Title is required');
    }

    // Generate slug if not provided
    const slug = input.slug || this.generateSlug(input.title);

    // Check for duplicate slug
    const existing = await this.repository.findBySlug(slug);
    if (existing) {
      throw new DuplicateSlugError(slug);
    }

    // If parentId is provided, verify parent exists
    if (input.parentId) {
      const parent = await this.repository.findById(input.parentId);
      if (!parent) {
        throw new SpaceNotFoundError(input.parentId);
      }
    }

    return this.repository.create({
      ...input,
      slug,
    });
  }

  async update(id: string, input: UpdateSpaceInput): Promise<Space> {
    const space = await this.repository.findById(id);
    if (!space) {
      throw new SpaceNotFoundError(id);
    }

    // If slug is being updated, check for duplicates
    if (input.slug && input.slug !== space.slug) {
      const existing = await this.repository.findBySlug(input.slug);
      if (existing) {
        throw new DuplicateSlugError(input.slug);
      }
    }

    // If parentId is being updated, verify parent exists
    if (input.parentId && input.parentId !== space.parentId) {
      const parent = await this.repository.findById(input.parentId);
      if (!parent) {
        throw new SpaceNotFoundError(input.parentId);
      }
    }

    return this.repository.update(id, input);
  }

  async delete(id: string): Promise<void> {
    const space = await this.repository.findById(id);
    if (!space) {
      throw new SpaceNotFoundError(id);
    }

    // Check if space has children
    const children = await this.repository.findChildren(id);
    if (children.length > 0) {
      throw new Error('Cannot delete space with children');
    }

    await this.repository.delete(id);
  }

  async getById(id: string): Promise<Space> {
    const space = await this.repository.findById(id);
    if (!space) {
      throw new SpaceNotFoundError(id);
    }
    return space;
  }

  async getBySlug(slug: string): Promise<Space> {
    const space = await this.repository.findBySlug(slug);
    if (!space) {
      throw new SpaceNotFoundError(`with slug ${slug}`);
    }
    return space;
  }

  async getChildren(parentId: string): Promise<Space[]> {
    const parent = await this.repository.findById(parentId);
    if (!parent) {
      throw new SpaceNotFoundError(parentId);
    }
    return this.repository.findChildren(parentId);
  }

  async list(options?: SpaceListOptions) {
    return this.repository.list(options);
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}

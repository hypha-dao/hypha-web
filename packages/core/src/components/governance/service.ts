import { inject, injectable } from 'inversify';
import { SYMBOLS } from '../../container/types';
import { Document } from './types';
import {
  type DocumentRepository,
  FindAllBySpaceSlugConfig,
} from './repository';
import { DocumentNotFoundError } from './errors';
import { PaginatedResponse } from '../../shared';

@injectable()
export class DocumentService {
  constructor(
    @inject(SYMBOLS.Repositories.DocumentRepository)
    private repository: DocumentRepository,
  ) {}

  async getAll(): Promise<Document[]> {
    return this.repository.findAll();
  }

  async getAllBySpaceSlug(
    {
      spaceSlug,
    }: {
      spaceSlug: string;
    },
    config: FindAllBySpaceSlugConfig,
  ): Promise<PaginatedResponse<Document>> {
    return this.repository.findAllBySpaceSlug({ spaceSlug }, config);
  }

  async getById(id: number): Promise<Document> {
    const document = await this.repository.findById(id);
    if (!document) {
      throw new DocumentNotFoundError(`Document with id ${id} not found`);
    }
    return document;
  }

  async getBySlug(slug: string): Promise<Document> {
    const document = await this.repository.findBySlug(slug);
    if (!document) {
      throw new DocumentNotFoundError(`Document with slug ${slug} not found`);
    }
    return document;
  }
}

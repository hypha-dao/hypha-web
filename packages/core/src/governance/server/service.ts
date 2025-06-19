import { inject, injectable } from 'inversify';
import { SYMBOLS } from '../../_container/types';
import { Document } from '../types';
import {
  type DocumentRepository,
  FindAllBySpaceSlugConfig,
} from './repository';
import { DocumentNotFoundError } from '../errors';
import { Order, PaginatedResponse } from '../../common';

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

  async getBySlug({ slug }: { slug: string }): Promise<Document> {
    const document = await this.repository.findBySlug(slug);
    if (!document) {
      throw new DocumentNotFoundError(`Document with slug ${slug} not found`);
    }
    return document;
  }

  async getAllBySpaceSlugWithoutPagination({
    spaceSlug,
    order,
  }: {
    spaceSlug: string;
    order?: Order<Document>;
  }): Promise<Document[]> {
    return this.repository.findAllBySpaceSlugWithoutPagination({ spaceSlug, order });
  }
}

import { Container } from '../../container/types';
import { Tokens } from '../../container/tokens';
import { Document } from './types';
import { DocumentRepository } from './repository';
import { DocumentNotFoundError } from './errors';

export class DocumentService {
  private repository: DocumentRepository;

  constructor(private container: Container) {
    this.repository = container.get(Tokens.DocumentRepository);
  }

  async getAll(): Promise<Document[]> {
    return this.repository.readAll();
  }

  async getById(id: number): Promise<Document> {
    const document = await this.repository.readById(id);
    if (!document) {
      throw new DocumentNotFoundError(id);
    }
    return document;
  }

  async getBySlug(slug: string): Promise<Document> {
    const document = await this.repository.readBySlug(slug);
    if (!document) {
      throw new DocumentNotFoundError(slug);
    }
    return document;
  }
}

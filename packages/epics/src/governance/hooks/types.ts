import {
  Document,
  FilterParams,
  Order,
  PaginationMetadata,
} from '@hypha-platform/core/client';

export type UseDocumentsReturn = {
  documents: Document[];
  pagination?: PaginationMetadata;
  isLoading: boolean;
};

export type UseDocumentsProps = {
  page?: number;
  filter?: FilterParams<Pick<Document, 'state'>>;
  searchTerm?: string;
  pageSize?: number;
  activeTab?: string;
  order?: Order<Document>;
};

export type UseDocuments = (props: UseDocumentsProps) => UseDocumentsReturn;

export enum JoinMethods {
  OPEN_ACCESS = 0,
  TOKEN_BASED = 1,
  INVITE_ONLY = 2,
}

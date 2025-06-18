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

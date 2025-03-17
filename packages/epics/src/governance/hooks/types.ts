import {
  Document,
  FilterParams,
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
  pageSize?: number;
};

export type UseDocuments = (props: UseDocumentsProps) => UseDocumentsReturn;

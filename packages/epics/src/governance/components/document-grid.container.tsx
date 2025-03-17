import { UseDocuments, UseDocumentsProps } from '../hooks';
import { DocumentGrid } from './document-grid';

type DocumentGridContainerProps = {
  basePath: string;
  pagination: UseDocumentsProps;
  useDocuments: UseDocuments;
};

export const DocumentGridContainer = ({
  basePath,
  pagination,
  useDocuments,
}: DocumentGridContainerProps) => {
  const { documents, isLoading } = useDocuments({ ...pagination });
  return (
    <DocumentGrid
      documents={documents}
      isLoading={isLoading}
      basePath={basePath}
    />
  );
};

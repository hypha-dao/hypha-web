import { UseDocuments, UseDocumentsProps } from '../hooks';
import { DocumentGrid } from './document-grid';

type DocumentGridContainerProps = {
  basePath: string;
  pagination: UseDocumentsProps;
  useDocuments: UseDocuments;
  activeTab: string;
};

export const DocumentGridContainer = ({
  basePath,
  pagination,
  useDocuments,
  activeTab,
}: DocumentGridContainerProps) => {
  const { documents, isLoading } = useDocuments({ ...pagination, activeTab });
  return (
    <DocumentGrid
      documents={documents}
      isLoading={isLoading}
      basePath={basePath}
    />
  );
};

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from '@hypha-platform/ui';

interface SectionPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const SectionPagination = ({
  currentPage,
  totalPages,
  onPageChange,
}: SectionPaginationProps) => {
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          />
        </PaginationItem>
        {Array.from({ length: totalPages }, (_, index) => (
          <PaginationItem key={index + 1}>
            <PaginationLink
              isActive={currentPage === index + 1}
              onClick={() => onPageChange(index + 1)}
            >
              {index + 1}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
};

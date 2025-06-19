'use client';

import useSWR from 'swr';
import {
  AgreementItem,
  fetchAgreements,
} from '@hypha-platform/graphql/rsc';
import { FilterParams, PaginationMetadata } from '@core/common';

type UseAgreementsReturn = {
  agreements: AgreementItem[];
  pagination?: PaginationMetadata;
  isLoading: boolean;
};

export const useAgreements = ({
  page = 1,
  filter,
}: {
  page?: number;
  filter?: FilterParams<AgreementItem>;
}): UseAgreementsReturn => {
  const { data, isLoading } = useSWR(['agreements', page, filter], () =>
    fetchAgreements({ page, filter }),
  );

  return {
    agreements: data?.agreements || [],
    pagination: data?.pagination,
    isLoading,
  };
};

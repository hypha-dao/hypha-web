'use client';

import React from 'react';
import useSWR from 'swr';
import queryString from 'query-string';

import { FilterParams } from '@hypha-platform/graphql/rsc';

import { useSpaceSlug } from './use-space-slug';
// TODO: #594 declare UI interface separately
import { Document, useBatchProposalDetailsWeb3Rpc } from '@hypha-platform/core/client';
import { UseDocuments, UseDocumentsReturn } from '@hypha-platform/epics';

export const useSpaceDocuments: UseDocuments = ({
  page = 1,
  pageSize = 4,
  filter,
  searchTerm,
}: {
  page?: number;
  pageSize?: number;
  filter?: FilterParams<Pick<Document, 'state'>>;
  searchTerm?: string;
}): UseDocumentsReturn => {
  const spaceSlug = useSpaceSlug();

  const queryParams = React.useMemo(() => {
    const effectiveFilter = {
      page,
      pageSize,
      ...(filter ? { ...filter } : {}),
      ...(searchTerm ? { searchTerm } : {}),
    };
    return `?${queryString.stringify(effectiveFilter)}`;
  }, [page, pageSize, filter, searchTerm]);

  const endpoint = React.useMemo(
    () => `/api/v1/spaces/${spaceSlug}/documents${queryParams}`,
    [spaceSlug, page, queryParams],
  );

  const { data: response, isLoading: loadingApi } = useSWR(
    [endpoint],
    ([endpoint]) => fetch(endpoint).then((res) => res.json()),
    {
      revalidateOnFocus: true,
      refreshInterval: 10000,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    },
  );

  const documents: Document[] = response?.data || [];

  const proposalIds = React.useMemo(
    () => documents.map((doc) => Number(doc.web3ProposalId)),
    [documents],
  );

  const {
    proposalsDetails,
    isLoading: loadingWeb3,
    error: errorWeb3,
  } = useBatchProposalDetailsWeb3Rpc({
    proposalIds,
  });

  const getDocumentBadges = React.useCallback(
    (document: Document, proposalDetails: any) => {
      if (document.state === 'proposal' && proposalDetails) {
        const now = new Date();

        const expired = proposalDetails.endTime instanceof Date
          ? now > proposalDetails.endTime
          : false;

        const executed = proposalDetails.executed;

        let votingStatus = 'Unknown';

        if (!expired && !executed) {
          votingStatus = 'On Voting';
        } else if (executed) {
          votingStatus = 'Accepted';
        } else if (expired && !executed) {
          votingStatus = 'Rejected';
        }

        return [
          {
            label: 'Proposal',
            className: 'capitalize',
            variant: 'solid',
            colorVariant: 'accent',
          },
          {
            label: votingStatus,
            className: 'capitalize',
            variant: 'outline',
            colorVariant:
              votingStatus === 'On Voting'
                ? 'warning'
                : votingStatus === 'Accepted'
                ? 'success'
                : votingStatus === 'Rejected'
                ? 'error'
                : 'default',
          },
        ];
      }

      return [];
    },
    [],
  );

  const enrichedDocuments = React.useMemo(() => {
    if (!proposalsDetails) {
      return documents.map((doc) => ({
        ...doc,
        badges: getDocumentBadges(doc, null),
      }));
    }

    return documents.map((doc, index) => {
      const rawDetails = proposalsDetails[index];

      const proposalDetails = {
        ...rawDetails,
        expired:
          rawDetails?.endTime instanceof Date
            ? new Date() > rawDetails.endTime
            : false,
      };

      return {
        ...doc,
        badges: getDocumentBadges(doc, proposalDetails),
        proposalDetails,
      };
    });
  }, [documents, proposalsDetails, getDocumentBadges]);

  return {
    documents: enrichedDocuments,
    pagination: response?.pagination,
    isLoading: loadingApi || loadingWeb3,
  };
};

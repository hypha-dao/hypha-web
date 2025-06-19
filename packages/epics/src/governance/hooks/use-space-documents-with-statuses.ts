'use client';

import React from 'react';
import useSWR from 'swr';

import { useSpaceProposalsWeb3Rpc } from '@core/space';
import { Document } from '@core/governance';

const getDocumentBadges = (document: Document) => {
  switch (document.status) {
    case 'onVoting':
      return [
        {
          label: 'Proposal',
          className: 'capitalize',
          variant: 'solid',
          colorVariant: 'accent',
        },
        {
          label: 'On voting',
          className: 'capitalize',
          variant: 'outline',
          colorVariant: 'warn',
        },
      ];
    case 'accepted':
      return [
        {
          label: 'Proposal',
          className: 'capitalize',
          variant: 'solid',
          colorVariant: 'accent',
        },
        {
          label: 'Accepted',
          className: 'capitalize',
          variant: 'outline',
          colorVariant: 'success',
        },
      ];
    case 'rejected':
      return [
        {
          label: 'Proposal',
          className: 'capitalize',
          variant: 'solid',
          colorVariant: 'accent',
        },
        {
          label: 'Rejected',
          className: 'capitalize',
          variant: 'outline',
          colorVariant: 'error',
        },
      ];
    default:
      return [];
  }
};

export const useSpaceDocumentsWithStatuses = ({
  spaceSlug,
  spaceId,
}: {
  spaceSlug: string;
  spaceId: number;
}) => {
  const { spaceProposalsIds } = useSpaceProposalsWeb3Rpc({ spaceId: spaceId });

  const endpoint = React.useMemo(
    () => `/api/v1/spaces/${spaceSlug}/documents/all`,
    [spaceSlug],
  );

  const {
    data: documentsFromDb,
    isLoading,
    mutate,
  } = useSWR(
    [endpoint],
    ([endpoint]) => fetch(endpoint).then((res) => res.json()),
    {
      revalidateOnFocus: true,
      refreshInterval: 10000,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    },
  );

  const response = React.useMemo(() => {
    if (!documentsFromDb || !spaceProposalsIds) {
      return {
        accepted: [],
        rejected: [],
        onVoting: [],
      };
    }

    const acceptedDocuments = (documentsFromDb as Document[])
      .filter(
        (doc: { web3ProposalId: number | null }) =>
          doc.web3ProposalId != null &&
          Array.from(spaceProposalsIds?.accepted ?? []).includes(
            BigInt(doc.web3ProposalId),
          ),
      )
      .map((doc) => {
        const documentWithStatus = { ...doc, status: 'accepted' } as Document;
        return {
          ...documentWithStatus,
          badges: getDocumentBadges(documentWithStatus),
        };
      });

    const rejectedDocuments = (documentsFromDb as Document[])
      .filter(
        (doc: { web3ProposalId: number | null }) =>
          doc.web3ProposalId != null &&
          Array.from(spaceProposalsIds?.rejected ?? []).includes(
            BigInt(doc.web3ProposalId),
          ),
      )
      .map((doc) => {
        const documentWithStatus = { ...doc, status: 'rejected' } as Document;
        return {
          ...documentWithStatus,
          badges: getDocumentBadges(documentWithStatus),
        };
      });

    const onVotingDocuments = (documentsFromDb as Document[])
      .filter(
        (doc: { web3ProposalId: number | null }) =>
          doc.web3ProposalId != null &&
          !Array.from(spaceProposalsIds?.accepted ?? []).includes(
            BigInt(doc.web3ProposalId),
          ) &&
          !Array.from(spaceProposalsIds?.rejected ?? []).includes(
            BigInt(doc.web3ProposalId),
          ),
      )
      .map((doc) => {
        const documentWithStatus = { ...doc, status: 'onVoting' } as Document;
        return {
          ...documentWithStatus,
          badges: getDocumentBadges(documentWithStatus),
        };
      });

    return {
      accepted: acceptedDocuments,
      rejected: rejectedDocuments,
      onVoting: onVotingDocuments,
    };
  }, [documentsFromDb, spaceProposalsIds]);

  return {
    documents: response,
    isLoading,
    update: mutate,
  };
};

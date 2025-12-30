'use client';

import React from 'react';
import useSWR from 'swr';

import { useSpaceProposalsWeb3Rpc } from '@hypha-platform/core/client';
import { Document } from '@hypha-platform/core/client';
import { DirectionType, Order, OrderField } from '@hypha-platform/core/client';
import queryString from 'query-string';

const getDocumentBadges = (document: Document) => {
  const badges = [];
  switch (document.label) {
    case 'Contribution':
      badges.push({
        label: 'Contribution',
        className: 'capitalize',
        variant: 'solid',
        colorVariant: 'accent',
      });
      break;
    case 'Collective Agreement':
      badges.push({
        label: 'Collective Agreement',
        className: 'capitalize',
        variant: 'solid',
        colorVariant: 'accent',
      });
      break;
    case 'Expenses':
      badges.push({
        label: 'Expenses',
        className: 'capitalize',
        variant: 'solid',
        colorVariant: 'accent',
      });
      break;
    case 'Funding':
      badges.push({
        label: 'Funding',
        className: 'capitalize',
        variant: 'solid',
        colorVariant: 'accent',
      });
      break;
    case 'Voting Method':
      badges.push({
        label: 'Voting Method',
        className: 'capitalize',
        variant: 'solid',
        colorVariant: 'accent',
      });
      break;
    case 'Entry Method':
      badges.push({
        label: 'Entry Method',
        className: 'capitalize',
        variant: 'solid',
        colorVariant: 'accent',
      });
      break;
    case 'Issue New Token':
      badges.push({
        label: 'Issue New Token',
        className: 'capitalize',
        variant: 'solid',
        colorVariant: 'accent',
      });
      break;
    case 'Invite':
      badges.push({
        label: 'Invite',
        className: 'capitalize',
        variant: 'solid',
        colorVariant: 'accent',
      });
      break;
    case 'Buy Hypha Tokens':
      badges.push({
        label: 'Buy Hypha Tokens',
        className: 'capitalize',
        variant: 'solid',
        colorVariant: 'accent',
      });
      break;
    case 'Activate Spaces':
      badges.push({
        label: 'Activate Spaces',
        className: 'capitalize',
        variant: 'solid',
        colorVariant: 'accent',
      });
      break;
    case 'Space To Space':
      badges.push({
        label: 'Space To Space',
        className: 'capitalize',
        variant: 'solid',
        colorVariant: 'accent',
      });
      break;
    case 'Space Transparency':
      badges.push({
        label: 'Space Transparency',
        className: 'capitalize',
        variant: 'solid',
        colorVariant: 'accent',
      });
      break;
    case 'Treasury Minting':
      badges.push({
        label: 'Treasury Minting',
        className: 'capitalize',
        variant: 'solid',
        colorVariant: 'accent',
      });
      break;
    default:
      break;
  }
  switch (document.status) {
    case 'onVoting':
      badges.push({
        label: 'On voting',
        className: 'capitalize',
        variant: 'outline',
        colorVariant: 'warn',
      });
      break;
    case 'accepted':
      badges.push({
        label: 'Accepted',
        className: 'capitalize',
        variant: 'outline',
        colorVariant: 'success',
      });
      break;
    case 'rejected':
      badges.push({
        label: 'Rejected',
        className: 'capitalize',
        variant: 'outline',
        colorVariant: 'error',
      });
      break;
  }
  return badges;
};

export const useSpaceDocumentsWithStatuses = ({
  spaceSlug,
  spaceId,
  order,
}: {
  spaceSlug: string;
  spaceId: number;
  order?: Order<Document>;
}) => {
  const { spaceProposalsIds } = useSpaceProposalsWeb3Rpc({ spaceId: spaceId });

  const getDirection = (dir: DirectionType) => {
    return `${dir === DirectionType.DESC ? '-' : '+'}`;
  };

  const getOrder = (field: OrderField<Document>) => {
    return `${getDirection(field.dir)}${field.name}`;
  };

  const queryParams = React.useMemo(() => {
    const effectiveFilter = {
      order: order
        ? order.map((field) => getOrder(field)).join(',')
        : undefined,
    };
    return `?${queryString.stringify(effectiveFilter)}`;
  }, [order]);

  const endpoint = React.useMemo(
    () => `/api/v1/spaces/${spaceSlug}/documents/all${queryParams}`,
    [spaceSlug, queryParams],
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

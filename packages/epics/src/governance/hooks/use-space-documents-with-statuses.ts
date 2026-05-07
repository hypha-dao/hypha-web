'use client';

import React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';

import {
  useSpaceProposalsWeb3Rpc,
  useWithdrawnProposalsWeb3Rpc,
} from '@hypha-platform/core/client';
import { Document } from '@hypha-platform/core/client';
import { DirectionType, Order, OrderField } from '@hypha-platform/core/client';
import queryString from 'query-string';
import { useAuthentication } from '@hypha-platform/authentication';

import {
  DOCUMENT_LABEL_BADGE_KEYS,
  normalizeProposalDocumentLabel,
} from '@hypha-platform/core/client';

const getDocumentBadges = (document: Document, t: (key: string) => string) => {
  const badges = [];
  const canonicalLabel = normalizeProposalDocumentLabel(document.label);
  const labelMessageKey =
    canonicalLabel !== ''
      ? DOCUMENT_LABEL_BADGE_KEYS[canonicalLabel]
      : undefined;
  if (labelMessageKey) {
    badges.push({
      label: t(labelMessageKey),
      className: 'capitalize',
      variant: 'solid',
      colorVariant: 'accent',
    });
  }
  switch (document.status) {
    case 'onVoting':
      badges.push({
        label: t('documentBadges.statusOnVoting'),
        className: 'capitalize',
        variant: 'outline',
        colorVariant: 'warn',
      });
      break;
    case 'accepted':
      badges.push({
        label: t('documentBadges.statusAccepted'),
        className: 'capitalize',
        variant: 'outline',
        colorVariant: 'success',
      });
      break;
    case 'rejected':
      badges.push({
        label: t('documentBadges.statusRejected'),
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
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { getAccessToken } = useAuthentication();
  const { spaceProposalsIds } = useSpaceProposalsWeb3Rpc({ spaceId: spaceId });
  const { withdrawnProposalsIds } = useWithdrawnProposalsWeb3Rpc({
    spaceId: spaceId,
  });

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
  const shouldFetchDocuments = Boolean(spaceSlug?.trim());

  const {
    data: documentsFromDb,
    isLoading,
    mutate,
    error,
  } = useSWR(
    shouldFetchDocuments ? [endpoint] : null,
    async ([endpoint]) => {
      const token = await getAccessToken();
      const headers: HeadersInit = {};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(endpoint, { headers });
      if (!res.ok) {
        throw new Error(
          `Failed to fetch documents: ${res.status} ${res.statusText}`,
        );
      }
      return res.json();
    },
    {
      revalidateOnFocus: true,
      refreshInterval: 10000,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    },
  );
  const response = React.useMemo(() => {
    if (
      !documentsFromDb ||
      !Array.isArray(documentsFromDb) ||
      !spaceProposalsIds
    ) {
      return {
        accepted: [],
        rejected: [],
        onVoting: [],
      };
    }

    const withdrawnIdsSet = new Set(
      Array.from(withdrawnProposalsIds ?? []).map((id) => Number(id)),
    );

    const acceptedDocuments = (documentsFromDb as Document[])
      .filter(
        (doc: { web3ProposalId: number | null }) =>
          doc.web3ProposalId != null &&
          !withdrawnIdsSet.has(doc.web3ProposalId) &&
          Array.from(spaceProposalsIds?.accepted ?? []).includes(
            BigInt(doc.web3ProposalId),
          ),
      )
      .map((doc) => {
        const documentWithStatus = { ...doc, status: 'accepted' } as Document;
        return {
          ...documentWithStatus,
          badges: getDocumentBadges(documentWithStatus, tAgreementFlow),
        };
      });

    const rejectedDocuments = (documentsFromDb as Document[])
      .filter(
        (doc: { web3ProposalId: number | null }) =>
          doc.web3ProposalId != null &&
          !withdrawnIdsSet.has(doc.web3ProposalId) &&
          Array.from(spaceProposalsIds?.rejected ?? []).includes(
            BigInt(doc.web3ProposalId),
          ),
      )
      .map((doc) => {
        const documentWithStatus = { ...doc, status: 'rejected' } as Document;
        return {
          ...documentWithStatus,
          badges: getDocumentBadges(documentWithStatus, tAgreementFlow),
        };
      });

    const onVotingDocuments = (documentsFromDb as Document[])
      .filter(
        (doc: { web3ProposalId: number | null }) =>
          doc.web3ProposalId != null &&
          !withdrawnIdsSet.has(doc.web3ProposalId) &&
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
          badges: getDocumentBadges(documentWithStatus, tAgreementFlow),
        };
      });
    return {
      accepted: acceptedDocuments,
      rejected: rejectedDocuments,
      onVoting: onVotingDocuments,
    };
  }, [
    documentsFromDb,
    spaceProposalsIds,
    withdrawnProposalsIds,
    tAgreementFlow,
  ]);
  return {
    documents: response,
    isLoading,
    update: mutate,
    error,
  };
};

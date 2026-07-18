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
import { useAccessTokenReady } from '@hypha-platform/authentication';

import {
  DOCUMENT_LABEL_BADGE_KEYS,
  normalizeProposalDocumentLabel,
} from '@hypha-platform/core/client';

/**
 * Shared default ordering for the space documents list. Exported so every
 * consumer (proposal aside page, `ProposalDetail`, agreements tab) uses the
 * exact same SWR key and the `/documents/all` request is deduped instead of
 * fetched once per component instance.
 */
export const PROPOSAL_DOCUMENTS_DEFAULT_ORDER: Order<Document> = [
  { name: 'createdAt', dir: DirectionType.DESC },
];

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

const emptyDocuments = {
  accepted: [] as Document[],
  rejected: [] as Document[],
  onVoting: [] as Document[],
};

export const useSpaceDocumentsWithStatuses = ({
  spaceSlug,
  spaceId,
  order,
}: {
  spaceSlug: string;
  spaceId: number | undefined | null;
  order?: Order<Document>;
}) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { getAccessToken, isAuthenticated, isAuthLoading, accessTokenReady } =
    useAccessTokenReady();
  const {
    spaceProposalsIds,
    isLoading: isProposalsLoading,
    error: proposalsError,
  } = useSpaceProposalsWeb3Rpc({ spaceId: spaceId });
  const { withdrawnProposalsIds, isLoading: isWithdrawnLoading } =
    useWithdrawnProposalsWeb3Rpc({
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

  // Network/Org/Space activity levels require a Bearer token. Wait for Privy
  // + an actual access token, and key SWR by auth state so we refetch when
  // the session becomes usable.
  const shouldFetchDocuments =
    Boolean(spaceSlug?.trim()) && !isAuthLoading && accessTokenReady;

  const {
    data: documentsFromDb,
    isLoading: isDocumentsLoading,
    mutate,
    error: documentsError,
  } = useSWR(
    shouldFetchDocuments ? [endpoint, isAuthenticated ? 'auth' : 'anon'] : null,
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
      // The `/documents/all` endpoint returns the full (unpaginated) document
      // set, so polling it every 10s is expensive. New documents are rare and
      // user-driven changes (create/vote/withdraw) call `update()` for instant
      // reflection, so a slower background poll is enough.
      refreshInterval: 30000,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    },
  );

  const hasValidSpaceId = spaceId != null && Number.isFinite(Number(spaceId));
  const proposalsReady = !hasValidSpaceId || spaceProposalsIds != null;
  const documentsReady = Array.isArray(documentsFromDb);

  const response = React.useMemo(() => {
    if (!documentsReady || !spaceProposalsIds) {
      return emptyDocuments;
    }

    const withdrawnIdsSet = new Set(
      Array.from(withdrawnProposalsIds ?? []).map((id) => id.toString()),
    );
    const acceptedIdsSet = new Set(
      Array.from(spaceProposalsIds.accepted ?? []).map((id) => id.toString()),
    );
    const rejectedIdsSet = new Set(
      Array.from(spaceProposalsIds.rejected ?? []).map((id) => id.toString()),
    );

    const acceptedDocuments = (documentsFromDb as Document[])
      .filter(
        (doc: { web3ProposalId: number | null }) =>
          doc.web3ProposalId != null &&
          !withdrawnIdsSet.has(String(doc.web3ProposalId)) &&
          acceptedIdsSet.has(String(doc.web3ProposalId)),
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
          !withdrawnIdsSet.has(String(doc.web3ProposalId)) &&
          rejectedIdsSet.has(String(doc.web3ProposalId)),
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
          !withdrawnIdsSet.has(String(doc.web3ProposalId)) &&
          !acceptedIdsSet.has(String(doc.web3ProposalId)) &&
          !rejectedIdsSet.has(String(doc.web3ProposalId)),
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
    documentsReady,
    spaceProposalsIds,
    withdrawnProposalsIds,
    tAgreementFlow,
  ]);

  const isLoading =
    isAuthLoading ||
    !accessTokenReady ||
    (shouldFetchDocuments && isDocumentsLoading) ||
    (hasValidSpaceId && isProposalsLoading) ||
    isWithdrawnLoading ||
    // Still assembling the intersection — keep the UI in a loading state so we
    // never flash "List is empty" while chain proposal IDs are catching up.
    (shouldFetchDocuments &&
      !documentsError &&
      !proposalsError &&
      (!documentsReady || !proposalsReady));

  return {
    documents: response,
    isLoading,
    update: mutate,
    error: documentsError ?? proposalsError,
  };
};

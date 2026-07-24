'use client';

import { Button, Skeleton, Separator, Image } from '@hypha-platform/ui';
import { WithdrawResubmitBanner } from './withdraw-resubmit-banner';
import { ProgressLine } from './progress-line';
import { intervalToDuration, isPast } from 'date-fns';
import { VoterList } from '../../governance/components/voter-list';
import {
  useMyVote,
  useIsDelegate,
  type SpaceDetails,
  useMe,
  useWithdrawProposal,
  useJwt,
  useAgreementMutationsWeb2Rsc,
  useSpaceMinProposalDuration,
  type Person,
  type Space,
} from '@hypha-platform/core/client';
import { getTokenUpdateByDocumentIdAction } from '@hypha-platform/core/governance/server/actions';
import {
  buildUpdateIssuedTokenResubmitPayload,
  RESUBMIT_UPDATE_ISSUED_TOKEN_EMBEDDED_FIELD,
  type DecodedUpdateTokenWhitelist,
  type UpdateTokenProposalSnapshot,
} from '../update-issued-token-resubmit';
import { useSpaceMember } from '../../spaces';
import { getDurationParts } from '@hypha-platform/ui-utils';
import { useTheme } from 'next-themes';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  RESUBMIT_FORM_DATA_KEY,
  RESUBMIT_PROPOSAL_DATA_KEY,
  getCreateRouteSegmentForProposalLabel,
} from '../../utils/resubmit-proposal-template';

function formatTimeRemaining(
  endTime: string,
  tProposalDetails: any,
  executed?: boolean,
  expired?: boolean,
): string {
  const end = new Date(endTime);

  if (isPast(end) || executed || expired) {
    return tProposalDetails('voting.voteClosed');
  }

  const duration = intervalToDuration({
    start: new Date(),
    end,
  });

  const parts = [];
  if (duration.days) parts.push(`${duration.days}d`);
  if (duration.hours) parts.push(`${duration.hours}h`);
  if (duration.minutes) parts.push(`${duration.minutes}m`);

  return parts.length
    ? tProposalDetails('voting.voteWillCloseIn', { duration: parts.join(' ') })
    : tProposalDetails('voting.voteClosingSoon');
}

/** @deprecated use getCreateRouteSegmentForProposalLabel */
const getCreateRouteForLabel = getCreateRouteSegmentForProposalLabel;

export const FormVoting = ({
  unity,
  quorum,
  endTime,
  executed,
  expired,
  isLoading,
  onAccept,
  onReject,
  isCheckingExpiration,
  isVoting,
  documentSlug,
  isAuthenticated,
  web3SpaceId,
  spaceDetails,
  proposalStatus,
  hideDurationData,
  proposalId,
  proposalCreator,
  onWithdrawSuccess,
  documentTitle,
  documentDescription,
  documentLeadImage,
  documentAttachments,
  spaceSlug,
  closeUrl,
  label,
  documentId,
  updateTokenProposalSnapshot,
  redeemResubmitPayload,
  proposalTemplateData,
  updateTokenDecodedWhitelist,
  membersForUpdateTokenResubmit,
  spacesForUpdateTokenResubmit,
  dbSpacesForUpdateTokenResubmit,
  isOwnershipTokenForUpdateTokenResubmit,
}: {
  unity: number;
  quorum: number;
  endTime: string;
  expired?: boolean;
  executed?: boolean;
  isLoading?: boolean;
  onAccept: () => void;
  onReject: () => void;
  isCheckingExpiration: boolean;
  isVoting?: boolean;
  documentSlug: string;
  isAuthenticated?: boolean;
  web3SpaceId?: number;
  spaceDetails?: SpaceDetails;
  proposalStatus?: string | null;
  hideDurationData?: boolean;
  proposalId?: number | null;
  proposalCreator?: `0x${string}` | null;
  onWithdrawSuccess?: () => void;
  documentTitle?: string;
  documentDescription?: string;
  documentLeadImage?: string;
  documentAttachments?: (string | { name: string; url: string })[];
  spaceSlug?: string;
  closeUrl?: string;
  label?: string;
  documentId?: number;
  updateTokenProposalSnapshot?: UpdateTokenProposalSnapshot | null;
  redeemResubmitPayload?: {
    token: string;
    amount: string;
    conversions: { asset: string; percentage: string }[];
  };
  proposalTemplateData?: Record<string, unknown>;
  /** Decoded whitelist addresses from the update-token proposal transactions */
  updateTokenDecodedWhitelist?: DecodedUpdateTokenWhitelist | null;
  membersForUpdateTokenResubmit?: Person[];
  spacesForUpdateTokenResubmit?: Space[];
  dbSpacesForUpdateTokenResubmit?: Space[];
  /** When DB has no type yet, use for whitelist from/to mapping (ownership = receive-only UI) */
  isOwnershipTokenForUpdateTokenResubmit?: boolean;
}) => {
  const tCommon = useTranslations('Common');
  const tProposalDetails = useTranslations('ProposalDetails');
  const { myVote, mutate: mutateMyVote } = useMyVote(documentSlug);
  const { isMember } = useSpaceMember({ spaceId: web3SpaceId as number });
  const { isDelegate } = useIsDelegate({ spaceId: web3SpaceId as number });
  const { theme } = useTheme();
  const { person } = useMe();
  const { jwt } = useJwt();
  const router = useRouter();
  const params = useParams();
  const lang = params?.lang as string;
  const { withdrawProposal, isWithdrawing } = useWithdrawProposal({
    proposalId: proposalId ?? null,
  });
  const { deleteAgreementBySlug } = useAgreementMutationsWeb2Rsc(jwt);

  const [localVote, setLocalVote] = useState<'no' | 'yes' | null>(null);
  const wasVotingRef = useRef(false);

  useEffect(() => {
    const voting = Boolean(isVoting);
    if (wasVotingRef.current && !voting && mutateMyVote) {
      void mutateMyVote().catch((error) => {
        console.error('Failed to refresh vote after submission:', error);
      });
    }
    wasVotingRef.current = voting;
  }, [isVoting, mutateMyVote]);

  const isCreator = Boolean(
    proposalCreator &&
      person?.address &&
      proposalCreator.toLowerCase() === person.address.toLowerCase(),
  );

  const showWithdrawBlock =
    isCreator &&
    !executed &&
    !expired &&
    !isPast(new Date(endTime)) &&
    proposalStatus === 'onVoting';

  const deleteDocument = async () => {
    if (!documentSlug || !jwt) return;

    try {
      await deleteAgreementBySlug({ slug: documentSlug });
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const handleWithdraw = async () => {
    try {
      await withdrawProposal();
      await deleteDocument();
      await onWithdrawSuccess?.();
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (closeUrl) {
        router.push(closeUrl);
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error('Error withdrawing proposal:', error);
    }
  };

  const handleResubmit = async () => {
    try {
      const tokenPurchaseFromTemplate =
        label === 'Token Purchase' && proposalTemplateData
          ? (
              proposalTemplateData as {
                spaceTokenPurchaseForm?: {
                  tokenAddress?: string;
                  activatePurchase?: boolean;
                  purchaseCurrency?: string;
                  purchasePrice?: number;
                  tokensAvailableForPurchase?: number;
                };
              }
            ).spaceTokenPurchaseForm
          : undefined;

      let updateIssuedTokenResubmitPayload: ReturnType<
        typeof buildUpdateIssuedTokenResubmitPayload
      > = null;

      if (label === 'Update Token') {
        let dbRow: Awaited<
          ReturnType<typeof getTokenUpdateByDocumentIdAction>
        > | null = null;
        if (documentId != null && jwt) {
          try {
            dbRow = await getTokenUpdateByDocumentIdAction(documentId, {
              authToken: jwt,
            });
          } catch {
            dbRow = null;
          }
        }
        updateIssuedTokenResubmitPayload =
          buildUpdateIssuedTokenResubmitPayload({
            dbRow: dbRow
              ? {
                  tokenAddress: dbRow.tokenAddress,
                  data: dbRow.data,
                }
              : null,
            snapshot: updateTokenProposalSnapshot ?? null,
            decodedWhitelistFromProposal:
              updateTokenDecodedWhitelist ?? undefined,
            dbSpacesForWhitelistMapping: dbSpacesForUpdateTokenResubmit,
            membersForWhitelistMapping: membersForUpdateTokenResubmit,
            spacesForWhitelistMapping: spacesForUpdateTokenResubmit,
            isOwnershipTokenForWhitelist:
              isOwnershipTokenForUpdateTokenResubmit,
          });
      }

      const proposalData = {
        resubmitTemplateSegment: getCreateRouteSegmentForProposalLabel(label),
        title: documentTitle || '',
        description: documentDescription || '',
        leadImage: documentLeadImage || undefined,
        attachments: documentAttachments || undefined,
        ...(proposalTemplateData ?? {}),
        ...(redeemResubmitPayload
          ? { redeemResubmit: redeemResubmitPayload }
          : {}),
        ...(tokenPurchaseFromTemplate
          ? {
              tokenAddress: tokenPurchaseFromTemplate.tokenAddress || '',
              activatePurchase: Boolean(
                tokenPurchaseFromTemplate.activatePurchase,
              ),
              ...(tokenPurchaseFromTemplate.purchaseCurrency !== undefined
                ? {
                    purchaseCurrency:
                      tokenPurchaseFromTemplate.purchaseCurrency as
                        | 'USD'
                        | 'EUR',
                  }
                : {}),
              ...(tokenPurchaseFromTemplate.purchasePrice !== undefined &&
              Number.isFinite(tokenPurchaseFromTemplate.purchasePrice)
                ? { purchasePrice: tokenPurchaseFromTemplate.purchasePrice }
                : {}),
              ...(tokenPurchaseFromTemplate.tokensAvailableForPurchase !==
                undefined &&
              Number.isFinite(
                tokenPurchaseFromTemplate.tokensAvailableForPurchase,
              )
                ? {
                    tokensAvailableForPurchase:
                      tokenPurchaseFromTemplate.tokensAvailableForPurchase,
                  }
                : {}),
            }
          : {}),
        ...(label === 'Update Token' && updateIssuedTokenResubmitPayload
          ? {
              [RESUBMIT_UPDATE_ISSUED_TOKEN_EMBEDDED_FIELD]:
                updateIssuedTokenResubmitPayload,
            }
          : {}),
      };

      sessionStorage.setItem(
        RESUBMIT_PROPOSAL_DATA_KEY,
        JSON.stringify(proposalData),
      );

      const saved = sessionStorage.getItem(RESUBMIT_PROPOSAL_DATA_KEY);
      if (!saved) {
        console.error('Failed to save resubmit data to sessionStorage');
        return;
      }

      await withdrawProposal();
      await deleteDocument();
      await onWithdrawSuccess?.();

      await new Promise((resolve) => setTimeout(resolve, 200));

      if (spaceSlug && lang) {
        const routePath = getCreateRouteForLabel(label);

        let createPath: string;
        if (routePath === '') {
          createPath = `/${lang}/dho/${spaceSlug}/agreements/create`;
        } else {
          createPath = `/${lang}/dho/${spaceSlug}/agreements/create/${routePath}`;
        }

        router.push(createPath);
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error('Error resubmitting proposal:', error);
      sessionStorage.removeItem(RESUBMIT_PROPOSAL_DATA_KEY);
      sessionStorage.removeItem(RESUBMIT_FORM_DATA_KEY);
    }
  };

  const isDisabled =
    isVoting ||
    !isAuthenticated ||
    isCheckingExpiration ||
    (!isMember && !isDelegate);
  const tooltipMessage = !isAuthenticated
    ? tCommon('signIn')
    : !isMember && !isDelegate
    ? tCommon('joinSpaceToUse')
    : '';

  function getVoteLabels(spaceDetails?: SpaceDetails) {
    if (!spaceDetails) {
      return {
        reject: tProposalDetails('voting.voteNo'),
        accept: tProposalDetails('voting.voteYes'),
      };
    }

    const quorum = Number(spaceDetails.quorum);
    const unity = Number(spaceDetails.unity);

    if (quorum === 0 && unity === 100) {
      return {
        reject: tProposalDetails('voting.object'),
        accept: tProposalDetails('voting.consent'),
      };
    }

    if (quorum === 100 && unity === 100) {
      return {
        reject: tProposalDetails('voting.no'),
        accept: tProposalDetails('voting.hellYeah'),
      };
    }

    if (quorum === 100 && unity === 0) {
      return {
        reject: tProposalDetails('voting.notSure'),
        accept: tProposalDetails('voting.looksGood'),
      };
    }

    return {
      reject: tProposalDetails('voting.voteNo'),
      accept: tProposalDetails('voting.voteYes'),
    };
  }

  const labels = getVoteLabels(spaceDetails);

  const hideTargets = () => {
    return proposalStatus === 'accepted' || proposalStatus === 'rejected';
  };

  const spaceIdBigInt = web3SpaceId ? BigInt(web3SpaceId) : undefined;

  const { duration } = useSpaceMinProposalDuration({
    spaceId: spaceIdBigInt as bigint,
  });

  const handleAccept = () => {
    setLocalVote('yes');
    onAccept();
  };

  const handleReject = () => {
    setLocalVote('no');
    onReject();
  };

  const showVotedMessage = myVote || localVote;
  const voteText = myVote || localVote;

  const votingInProgress =
    Boolean(isVoting) &&
    proposalStatus === 'onVoting' &&
    !executed &&
    !expired &&
    !isPast(new Date(endTime));

  const isRejectDisabled = isDisabled || votingInProgress || voteText === 'no';
  const isAcceptDisabled = isDisabled || votingInProgress || voteText === 'yes';

  const hasUserVoted = Boolean(myVote ?? localVote);

  return (
    <div className="flex flex-col gap-7 text-neutral-11">
      <VoterList documentSlug={documentSlug} />
      <div className="flex flex-col gap-6">
        <Skeleton
          width="100%"
          height="48px"
          loading={isLoading}
          className="rounded-lg"
        >
          <ProgressLine
            label={tProposalDetails('voting.quorumMinParticipation')}
            value={quorum}
            target={
              spaceDetails?.quorum ? Number(spaceDetails.quorum) : undefined
            }
            indicatorColor="bg-accent-12"
            hideTargets={hideTargets()}
            hasUserVoted={hasUserVoted}
          />
        </Skeleton>
        <Skeleton
          width="100%"
          height="48px"
          loading={isLoading}
          className="rounded-lg"
        >
          <ProgressLine
            label={tProposalDetails('voting.unityMinAlignment')}
            value={unity}
            target={
              spaceDetails?.unity ? Number(spaceDetails.unity) : undefined
            }
            indicatorColor="bg-accent-9"
            hideTargets={hideTargets()}
            hasUserVoted={hasUserVoted}
          />
        </Skeleton>
      </div>
      {votingInProgress ? (
        <div
          className="rounded-lg border border-accent-6/40 bg-accent-surface/80 px-4 py-3 text-sm text-foreground backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <span className="font-medium">
            {tProposalDetails('voting.submittingVote')}
          </span>
        </div>
      ) : null}
      <div className="flex items-end justify-between">
        <Skeleton
          width="100%"
          height="28px"
          loading={isLoading}
          className="rounded-lg"
        >
          <div className="flex flex-col gap-3">
            <Skeleton
              loading={isLoading}
              width={120}
              height={40}
              className="rounded-lg"
            >
              {hideDurationData ? null : Number(duration) === 0 ? (
                <div className="flex gap-2 h-fit items-center">
                  <Image
                    className="max-w-[24px] max-h-[24px] min-w-[24px] min-h-[24px]"
                    width={24}
                    height={24}
                    src={
                      theme === 'light'
                        ? '/placeholder/auto-execution-icon-light.svg'
                        : '/placeholder/auto-execution-icon.svg'
                    }
                    alt={tProposalDetails('voting.proposalVotingIconAlt')}
                  />
                  <div className="flex flex-col">
                    <span className="text-1 text-accent-11 text-nowrap font-medium">
                      {tProposalDetails('voting.autoExecution')}
                    </span>
                    <span className="text-[9px] text-accent-11 text-nowrap font-medium">
                      {spaceDetails?.quorum}%{' '}
                      {tProposalDetails('labels.quorum')} |{' '}
                      {spaceDetails?.unity}% {tProposalDetails('labels.unity')}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 h-fit items-center">
                  <Image
                    className="max-w-[24px] max-h-[24px] min-w-[24px] min-h-[24px]"
                    width={24}
                    height={24}
                    src={
                      theme === 'light'
                        ? '/placeholder/non-auto-execution-icon-light.svg'
                        : '/placeholder/non-auto-execution-icon.svg'
                    }
                    alt={tProposalDetails('voting.proposalVotingIconAlt')}
                  />
                  <div className="flex flex-col">
                    <span className="text-1 text-accent-11 text-nowrap font-medium">
                      {tProposalDetails('voting.toVote', {
                        duration: (() => {
                          const { unit, count } = getDurationParts(
                            Number(duration),
                          );
                          return tCommon(
                            unit === 'hours' ? 'durationHours' : 'durationDays',
                            { count },
                          );
                        })(),
                      })}
                    </span>
                    <span className="text-[9px] text-accent-11 text-nowrap font-medium">
                      {spaceDetails?.quorum}%{' '}
                      {tProposalDetails('labels.quorum')} |{' '}
                      {spaceDetails?.unity}% {tProposalDetails('labels.unity')}
                    </span>
                  </div>
                </div>
              )}
            </Skeleton>
            <div className="text-1">
              {formatTimeRemaining(
                endTime,
                tProposalDetails,
                executed,
                expired,
              )}
            </div>
          </div>
          {executed || expired || isPast(new Date(endTime)) ? null : (
            <div className="flex flex-col gap-2 items-end">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  colorVariant="accent"
                  className="active:bg-accent-9"
                  onClick={handleReject}
                  disabled={isRejectDisabled}
                  title={tooltipMessage}
                >
                  {labels.reject}
                </Button>
                <Button
                  variant="outline"
                  colorVariant="accent"
                  className="active:bg-accent-9"
                  onClick={handleAccept}
                  disabled={isAcceptDisabled}
                  title={tooltipMessage}
                >
                  {labels.accept}
                </Button>
              </div>
              {showVotedMessage && (
                <div className="text-2 text-neutral-10">
                  {tProposalDetails('voting.youVoted', {
                    vote:
                      voteText === 'yes'
                        ? tProposalDetails('voting.voteValueYes')
                        : tProposalDetails('voting.voteValueNo'),
                  })}
                </div>
              )}
            </div>
          )}
        </Skeleton>
      </div>
      {showWithdrawBlock && (
        <WithdrawResubmitBanner
          onWithdraw={handleWithdraw}
          onResubmit={handleResubmit}
          isWithdrawing={isWithdrawing}
          hideResubmit={
            getCreateRouteSegmentForProposalLabel(label) === 'issue-new-token'
          }
        />
      )}
    </div>
  );
};

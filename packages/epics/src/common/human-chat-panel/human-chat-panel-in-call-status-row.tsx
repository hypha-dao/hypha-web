'use client';

import { useTranslations } from 'next-intl';
import { Loader2, RefreshCw } from 'lucide-react';
import { CallHangUpIcon } from './call-hang-up-icon';

type HumanChatPanelInCallStatusRowProps = {
  /** Total participants including self, for the i18n `count` interpolation. */
  participantCount: number;
  /** Participants other than self. */
  othersInRoomCallCount: number;
  disabled?: boolean;
  /** True while a leave/refresh action is in flight. */
  busy?: boolean;
  onLeave: () => void;
  onRefresh: () => void;
};

/**
 * #2456: the single "In this call — N members / Only you" status row + hangup/refresh buttons,
 * shared between `HumanChatPanelCallBanner` (this tab holds the live session) and
 * `HumanChatPanelCallJoinStrip`'s `isRefresh` mode (this tab doesn't, but the same user does
 * elsewhere) — both represent the same conceptual state and must render identically. Not
 * responsible for the surrounding alert rows, capture-consent banner, or full in-call toolbar
 * (mic/camera/screenshare/etc) — those only ever apply to the connected-tab case and stay owned
 * by `HumanChatPanelCallBanner` itself.
 *
 * Deliberately no local "did my click finish" state. `disabled`/`busy` already derive from real
 * `callState` upstream (see call sites), which itself updates from the actual Matrix RTC / LiveKit
 * session — so once a leave or refresh actually completes, the surrounding component naturally
 * re-renders into whatever state is now true (this row, a different row, or nothing at all) with
 * fresh props. A local "pending → confirmed" flag only fakes that signal and can drift from
 * reality (previously: a checkmark could flash and revert while the real action was still
 * settling). Both buttons share the same disabled/busy state so an in-flight leave can't race an
 * in-flight refresh, or vice versa.
 */
export function HumanChatPanelInCallStatusRow({
  participantCount,
  othersInRoomCallCount,
  disabled = false,
  busy = false,
  onLeave,
  onRefresh,
}: HumanChatPanelInCallStatusRowProps) {
  const t = useTranslations('HumanChatPanel');
  const isBusy = busy || disabled;

  return (
    <div className="flex min-h-[44px] flex-wrap items-center gap-2 px-4 py-2">
      <div className="min-w-0 flex-1 basis-0 pr-1 sm:pr-2">
        {othersInRoomCallCount === 0 ? (
          <p className="text-xs font-medium leading-tight text-foreground">
            <span className="block max-w-full">
              {t('callBannerInCallSoloLine1', { count: participantCount })}
            </span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground sm:text-xs">
              {t('callBannerInCallSoloLine2')}
            </span>
          </p>
        ) : (
          <p
            className="text-xs font-medium leading-tight text-foreground"
            title={t('callBannerInCallWithOthers', {
              count: participantCount,
              otherCount: othersInRoomCallCount,
            })}
          >
            {t('callBannerInCallWithOthers', {
              count: participantCount,
              otherCount: othersInRoomCallCount,
            })}
          </p>
        )}
      </div>
      <div className="shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onLeave}
            disabled={isBusy}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-800/30 bg-red-600 text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-50"
            title={t('callLeave')}
            aria-label={t('callLeave')}
            aria-busy={isBusy}
          >
            {isBusy ? (
              <Loader2
                className="h-4 w-4 animate-spin"
                strokeWidth={1.75}
                aria-hidden
              />
            ) : (
              <CallHangUpIcon className="h-4 w-4" strokeWidth={1.75} />
            )}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isBusy}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            title={t('callRefreshWithVideoShort')}
            aria-label={t('callRefreshWithVideoShort')}
            aria-busy={isBusy}
          >
            {isBusy ? (
              <Loader2
                className="h-4 w-4 animate-spin"
                strokeWidth={1.75}
                aria-hidden
              />
            ) : (
              <RefreshCw className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

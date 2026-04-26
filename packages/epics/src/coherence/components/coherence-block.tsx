'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { Empty } from '../../common/empty';
import { DhoTabPage } from '../../common';
import {
  Coherence,
  useFindCoherences,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import React from 'react';
import { useTranslations } from 'next-intl';
import { CoherenceOrder } from '../types';
import { SignalSection } from './signal-section';
import { useHumanChatPanel } from '../../common/human-chat-panel-context';

type CoherenceBlockProps = {
  lang: Locale;
  spaceSlug: string;
  order?: CoherenceOrder;
  humanChatEnabled?: boolean;
};

export function CoherenceBlock({
  lang,
  spaceSlug,
  order,
  humanChatEnabled = false,
}: CoherenceBlockProps) {
  const t = useTranslations('CoherenceTab');
  const [hideArchived, setHideArchived] = React.useState(true);
  const { isAuthenticated } = useAuthentication();
  const { space, isLoading: isSpaceLoading } = useSpaceBySlug(spaceSlug);
  const {
    coherences: signals,
    isLoading: isSignalsLoading,
    refresh: refreshSignals,
  } = useFindCoherences({
    spaceId: space?.id,
    includeArchived: !hideArchived,
    orderBy: order,
  });

  const refresh = React.useCallback(async () => {
    await refreshSignals();
  }, [refreshSignals]);

  const chatBasePath = React.useMemo(
    () => `/${lang}/dho/${spaceSlug}/coherence/chat`,
    [lang, spaceSlug],
  );

  const { openCoherenceChat } = useHumanChatPanel();

  const handleSignalClick = React.useCallback(
    (signal: Coherence) => {
      openCoherenceChat(
        signal.roomId ?? null,
        signal.title ?? '',
        signal.slug ?? '',
      );
    },
    [openCoherenceChat],
  );

  const onSignalClick = humanChatEnabled ? handleSignalClick : undefined;

  return (
    <DhoTabPage>
      {isAuthenticated ? (
        <SignalSection
          basePath={chatBasePath}
          label={t('signals')}
          hasSearch={true}
          signals={signals ?? []}
          isLoading={isSpaceLoading || isSignalsLoading}
          firstPageSize={6}
          pageSize={50}
          refresh={refresh}
          onSignalClick={onSignalClick}
        />
      ) : (
        <Empty>
          <p>{t('signInToSee')}</p>
        </Empty>
      )}
    </DhoTabPage>
  );
}

'use client';

import { FC, ReactNode } from 'react';
import { Text } from '@radix-ui/themes';
import { useSignalsSection } from '../hooks';
import { Button, ErrorAlert, Input, SectionLoadMore } from '@hypha-platform/ui';
import { Empty } from '../../common';
import { SignalGridContainer } from './signal-grid.container';
import { Coherence, DirectionType } from '@hypha-platform/core/client';
import { PlusIcon } from '@radix-ui/react-icons';
import { useParams } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import Link from 'next/link';
import React from 'react';
import { useTranslations } from 'next-intl';
import { SearchIcon } from 'lucide-react';

const SIGNAL_PROVISIONING_NOTICE_STORAGE_KEY =
  'coherence.signalProvisioningNotice';
const SIGNAL_PROVISIONING_NOTICE_EVENT = 'coherence:signalProvisioningNotice';
const SIGNAL_PROVISIONING_NOTICE_AUTO_DISMISS_MS = 8000;

type SignalSectionProps = {
  basePath: string;
  signals: Coherence[];
  leadImage?: string;
  toolbarLeft?: ReactNode;
  isLoading: boolean;
  firstPageSize?: number;
  pageSize?: number;
  order?: string;
  refresh: () => Promise<void>;
  onSignalClick?: (signal: Coherence) => void;
};

export const SignalSection: FC<SignalSectionProps> = ({
  basePath,
  signals,
  leadImage,
  toolbarLeft,
  isLoading,
  firstPageSize = 3,
  pageSize = 3,
  refresh,
  onSignalClick,
}) => {
  const t = useTranslations('CoherenceTab');
  const { lang, id } = useParams<{ lang: Locale; id: string }>();
  const {
    pages,
    loadMore,
    pagination,
    onUpdateSearch,
    searchTerm,
    filteredSignals,
  } = useSignalsSection({
    signals,
    firstPageSize,
    pageSize,
  });
  const [provisioningNoticeLines, setProvisioningNoticeLines] = React.useState<
    string[]
  >([]);

  const readProvisioningNotice = React.useCallback(() => {
    const rawNotice = sessionStorage.getItem(
      SIGNAL_PROVISIONING_NOTICE_STORAGE_KEY,
    );
    if (!rawNotice) return;
    sessionStorage.removeItem(SIGNAL_PROVISIONING_NOTICE_STORAGE_KEY);
    try {
      const parsed = JSON.parse(rawNotice);
      if (!Array.isArray(parsed)) return;
      const lines = parsed.filter(
        (line): line is string =>
          typeof line === 'string' && line.trim().length > 0,
      );
      if (lines.length > 0) setProvisioningNoticeLines(lines);
    } catch (error) {
      console.warn('Failed to parse signal provisioning notice:', error);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    readProvisioningNotice();
    window.addEventListener(
      SIGNAL_PROVISIONING_NOTICE_EVENT,
      readProvisioningNotice,
    );
    return () =>
      window.removeEventListener(
        SIGNAL_PROVISIONING_NOTICE_EVENT,
        readProvisioningNotice,
      );
  }, [readProvisioningNotice]);

  React.useEffect(() => {
    if (provisioningNoticeLines.length === 0) return;
    const timeoutId = window.setTimeout(() => {
      setProvisioningNoticeLines([]);
    }, SIGNAL_PROVISIONING_NOTICE_AUTO_DISMISS_MS);
    return () => window.clearTimeout(timeoutId);
  }, [provisioningNoticeLines]);

  const createSignalHref = `/${lang}/dho/${id}/coherence/new-signal`;

  return (
    <div className="flex w-full flex-col gap-4">
      {toolbarLeft ? <div>{toolbarLeft}</div> : null}
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
        <Input
          type="search"
          placeholder={t('searchSignals')}
          aria-label={t('searchSignals')}
          onChange={(event) => onUpdateSearch(event.target.value)}
          leftIcon={<SearchIcon className="text-accent-9" size="16px" />}
          className="w-full"
        />
        <Button
          asChild
          variant="default"
          colorVariant="accent"
          disabled={isLoading}
          className="w-full lg:w-auto"
        >
          <Link href={createSignalHref} className="w-full lg:w-auto">
            <PlusIcon />
            {t('newSignal')}
          </Link>
        </Button>
      </div>

      {pagination?.totalPages === 0 ? (
        <Empty>
          <p>{t('listIsEmpty')}</p>
        </Empty>
      ) : (
        <div className="w-full space-y-2">
          {Array.from({ length: pages }).map((_, index) => (
            <SignalGridContainer
              key={`signal-container-${index}`}
              basePath={basePath}
              leadImage={leadImage}
              pagination={{
                page: index + 1,
                firstPageSize,
                pageSize,
                searchTerm,
                order: [
                  {
                    dir: DirectionType.DESC,
                    name: 'id',
                  },
                ],
              }}
              signals={filteredSignals}
              refresh={refresh}
              onSignalClick={onSignalClick}
            />
          ))}
        </div>
      )}
      {pagination?.totalPages === 0 ? null : (
        <SectionLoadMore
          onClick={loadMore}
          disabled={pagination?.totalPages === pages}
          isLoading={isLoading}
        >
          <Text className="line-clamp-3 max-w-md text-center text-sm leading-snug">
            {pagination?.totalPages === pages ? t('noMore') : t('loadMore')}
          </Text>
        </SectionLoadMore>
      )}
      {provisioningNoticeLines.length > 0 ? (
        <ErrorAlert lines={provisioningNoticeLines} bgColor="bg-yellow-600" />
      ) : null}
    </div>
  );
};

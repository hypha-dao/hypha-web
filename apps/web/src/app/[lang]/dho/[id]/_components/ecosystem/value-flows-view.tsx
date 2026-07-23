'use client';

import { useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { useTransfers } from '@hypha-platform/epics';
import type { TransferWithEntity } from '@hypha-platform/epics';
import { MyceliumForceGraph } from './mycelium-force-graph';
import type { MyceliumGraph, MyceliumNode, MyceliumNodeKind } from './types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';

type ValueFlowsViewProps = {
  spaceSlug: string;
  spaceTitle: string;
  spaceLogoUrl?: string | null;
  accentHex?: string;
};

type PeriodKey = '7d' | '30d' | '90d' | '365d' | 'all';

type AggregatedFlow = {
  id: string;
  kind: MyceliumNodeKind;
  label: string;
  imageUrl?: string | null;
  total: number;
  symbol: string;
  transferCount: number;
  firstTimestamp: number;
  lastTimestamp: number;
  transfers: TransferWithEntity[];
};

const PERIOD_MS: Record<Exclude<PeriodKey, 'all'>, number> = {
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
  '365d': 365 * 24 * 60 * 60 * 1000,
};

function recipientId(transfer: TransferWithEntity): string {
  if (transfer.space?.title) {
    return `space-${transfer.space.title}-${transfer.to}`;
  }
  if (transfer.person?.name || transfer.person?.surname) {
    return `person-${transfer.person.name ?? ''}-${
      transfer.person.surname ?? ''
    }-${transfer.to}`;
  }
  return `addr-${
    transfer.direction === 'outgoing' ? transfer.to : transfer.from
  }`;
}

function recipientLabel(transfer: TransferWithEntity): string {
  if (transfer.space?.title) return transfer.space.title;
  const personName = [transfer.person?.name, transfer.person?.surname]
    .filter(Boolean)
    .join(' ');
  if (personName) return personName;
  const address =
    transfer.direction === 'outgoing' ? transfer.to : transfer.from;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function recipientKind(transfer: TransferWithEntity): MyceliumNodeKind {
  if (transfer.space?.title) return 'space';
  if (transfer.person) return 'person';
  return 'external';
}

function recipientImage(
  transfer: TransferWithEntity,
): string | null | undefined {
  return transfer.space?.avatarUrl || transfer.person?.avatarUrl;
}

function transferTime(transfer: TransferWithEntity): number {
  const raw = transfer.timestamp;
  if (typeof raw === 'number') {
    // Alchemy sometimes returns seconds
    return raw < 1e12 ? raw * 1000 : raw;
  }
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function ValueFlowsView({
  spaceSlug,
  spaceTitle,
  spaceLogoUrl,
  accentHex,
}: ValueFlowsViewProps) {
  const t = useTranslations('SelectNavigationAction');
  const format = useFormatter();
  const { transfers, isLoading } = useTransfers({
    spaceSlug,
    refreshInterval: 30_000,
  });
  const [symbolFilter, setSymbolFilter] = useState<string>('all');
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);

  const outgoing = useMemo(
    () => transfers.filter((transfer) => transfer.direction === 'outgoing'),
    [transfers],
  );

  const symbols = useMemo(() => {
    const set = new Set<string>();
    for (const transfer of outgoing) {
      if (transfer.symbol) set.add(transfer.symbol);
    }
    return Array.from(set).sort();
  }, [outgoing]);

  const periodFiltered = useMemo(() => {
    const bySymbol =
      symbolFilter === 'all'
        ? outgoing
        : outgoing.filter((transfer) => transfer.symbol === symbolFilter);

    if (period === 'all') return bySymbol;
    const cutoff = Date.now() - PERIOD_MS[period];
    return bySymbol.filter((transfer) => transferTime(transfer) >= cutoff);
  }, [outgoing, symbolFilter, period]);

  const aggregated = useMemo(() => {
    const map = new Map<string, AggregatedFlow>();
    for (const transfer of periodFiltered) {
      // Keep symbols separate so "All tokens" never sums USDC + ETH etc.
      const id = `${recipientId(transfer)}|${transfer.symbol}`;
      const existing = map.get(id);
      const ts = transferTime(transfer);
      if (!existing) {
        map.set(id, {
          id,
          kind: recipientKind(transfer),
          label: recipientLabel(transfer),
          imageUrl: recipientImage(transfer),
          total: transfer.value || 0,
          symbol: transfer.symbol,
          transferCount: 1,
          firstTimestamp: ts,
          lastTimestamp: ts,
          transfers: [transfer],
        });
        continue;
      }
      existing.total += transfer.value || 0;
      existing.transferCount += 1;
      existing.firstTimestamp = Math.min(existing.firstTimestamp, ts);
      existing.lastTimestamp = Math.max(existing.lastTimestamp, ts);
      existing.transfers.push(transfer);
      if (!existing.imageUrl) existing.imageUrl = recipientImage(transfer);
      // Prefer space/person kind if we learn more
      if (existing.kind === 'external') {
        existing.kind = recipientKind(transfer);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [periodFiltered]);

  const selectedFlow = useMemo(() => {
    if (!selectedFlowId) return aggregated[0] ?? null;
    return (
      aggregated.find((flow) => flow.id === selectedFlowId) ??
      aggregated[0] ??
      null
    );
  }, [aggregated, selectedFlowId]);

  const graph = useMemo<MyceliumGraph>(() => {
    const nodes: MyceliumNode[] = [
      {
        id: `hub-${spaceSlug}`,
        kind: 'hub',
        label: spaceTitle,
        imageUrl: spaceLogoUrl,
        meta: t('valueFlows.hubMeta'),
      },
    ];
    const links: MyceliumGraph['links'] = [];
    const maxTotal = Math.max(...aggregated.map((flow) => flow.total), 1);

    for (const flow of aggregated.slice(0, 80)) {
      nodes.push({
        id: flow.id,
        kind: flow.kind,
        label: flow.label,
        imageUrl: flow.imageUrl,
        meta: t('valueFlows.recipientMeta', {
          amount: format.number(flow.total),
          symbol: flow.symbol,
        }),
      });
      links.push({
        id: `flow-${flow.id}`,
        source: `hub-${spaceSlug}`,
        target: flow.id,
        weight: flow.total / maxTotal,
        strength: 0.35 + (flow.total / maxTotal) * 0.55,
        label: `${format.number(flow.total)} ${flow.symbol}`,
        meta: flow.id,
      });
    }

    return { nodes, links };
  }, [aggregated, spaceSlug, spaceTitle, spaceLogoUrl, format, t]);

  const periodStartLabel = useMemo(() => {
    if (period === 'all') return t('valueFlows.periodAll');
    const start = new Date(Date.now() - PERIOD_MS[period]);
    return format.dateTime(start, { dateStyle: 'medium' });
  }, [period, format, t]);

  const cumulativeTotal = useMemo(() => {
    // Only sum amounts when a single token is selected.
    if (symbolFilter === 'all') return null;
    return aggregated.reduce((sum, flow) => sum + flow.total, 0);
  }, [aggregated, symbolFilter]);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h3 className="text-3 font-semibold text-foreground">
            {t('valueFlows.title')}
          </h3>
          <p className="mt-0.5 max-w-2xl text-1 text-muted-foreground">
            {t('valueFlows.description')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={period}
            onValueChange={(value) => setPeriod(value as PeriodKey)}
          >
            <SelectTrigger className="h-8 w-[9.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">{t('valueFlows.period7d')}</SelectItem>
              <SelectItem value="30d">{t('valueFlows.period30d')}</SelectItem>
              <SelectItem value="90d">{t('valueFlows.period90d')}</SelectItem>
              <SelectItem value="365d">{t('valueFlows.period365d')}</SelectItem>
              <SelectItem value="all">{t('valueFlows.periodAll')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={symbolFilter} onValueChange={setSymbolFilter}>
            <SelectTrigger className="h-8 w-[9.5rem]">
              <SelectValue placeholder={t('valueFlows.allTokens')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('valueFlows.allTokens')}</SelectItem>
              {symbols.map((symbol) => (
                <SelectItem key={symbol} value={symbol}>
                  {symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-1 text-muted-foreground">
            {isLoading
              ? t('visibleSpaces.loading')
              : cumulativeTotal == null
              ? t('valueFlows.statsCountOnly', {
                  count: periodFiltered.length,
                  recipients: aggregated.length,
                })
              : t('valueFlows.statsCumulative', {
                  count: periodFiltered.length,
                  recipients: aggregated.length,
                  total: format.number(cumulativeTotal),
                  symbol: symbolFilter,
                })}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-1 text-1 text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-current opacity-70" />
          {t('valueFlows.legendPerson')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-current opacity-70" />
          {t('valueFlows.legendSpace')}
        </span>
        <span>{t('valueFlows.periodRange', { start: periodStartLabel })}</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <MyceliumForceGraph
          graph={graph}
          accentHex={accentHex}
          emptyLabel={t('valueFlows.empty')}
          onNodeClick={(node) => {
            if (node.kind === 'hub') return;
            setSelectedFlowId(node.id);
          }}
        />

        <aside className="rounded-2xl border border-border/55 bg-background/80 p-4">
          <p className="text-1 font-medium uppercase tracking-wide text-muted-foreground">
            {t('valueFlows.details')}
          </p>
          {selectedFlow ? (
            <dl className="mt-3 space-y-3 text-2">
              <div>
                <dt className="text-muted-foreground">
                  {t('valueFlows.recipient')}
                </dt>
                <dd className="font-medium text-foreground">
                  {selectedFlow.label}
                  <span className="ms-2 text-1 font-normal text-muted-foreground">
                    {selectedFlow.kind === 'space'
                      ? t('valueFlows.kindSpace')
                      : selectedFlow.kind === 'person'
                      ? t('valueFlows.kindPerson')
                      : t('valueFlows.kindExternal')}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t('valueFlows.cumulativeAmount')}
                </dt>
                <dd className="font-semibold text-foreground">
                  {format.number(selectedFlow.total)} {selectedFlow.symbol}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t('valueFlows.transferCount')}
                </dt>
                <dd className="text-foreground">
                  {format.number(selectedFlow.transferCount)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t('valueFlows.dateRange')}
                </dt>
                <dd className="text-foreground">
                  {format.dateTime(new Date(selectedFlow.firstTimestamp), {
                    dateStyle: 'medium',
                  })}
                  {' → '}
                  {format.dateTime(new Date(selectedFlow.lastTimestamp), {
                    dateStyle: 'medium',
                  })}
                </dd>
              </div>
              <div>
                <dt className="mb-1.5 text-muted-foreground">
                  {t('valueFlows.recentTransfers')}
                </dt>
                <dd className="space-y-1.5">
                  {[...selectedFlow.transfers]
                    .sort((a, b) => transferTime(b) - transferTime(a))
                    .slice(0, 5)
                    .map((transfer, index) => (
                      <div
                        key={`${transfer.transactionHash}-${index}`}
                        className="rounded-lg border border-border/40 bg-background-3/40 px-2.5 py-1.5"
                      >
                        <p className="font-medium text-foreground">
                          {format.number(transfer.value)} {transfer.symbol}
                        </p>
                        <p className="text-1 text-muted-foreground">
                          {format.dateTime(new Date(transferTime(transfer)), {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </p>
                      </div>
                    ))}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-2 text-muted-foreground">
              {t('valueFlows.selectHint')}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

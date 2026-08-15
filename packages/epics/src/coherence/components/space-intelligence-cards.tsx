'use client';

import { FC, KeyboardEvent } from 'react';
import type {
  IntelligenceGraph,
  IntelligenceListItem,
} from '@hypha-platform/core/intelligence';
import { cn } from '@hypha-platform/ui-utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { resolveDateFnsLocale } from '../../utils/date-fns-locale';
import { PRIORITY_LEFT_ACCENT_BAR_CLASS } from '../utils/signal-priority-styles';
import {
  SIGNAL_TAG_BADGE_CLASS,
  SIGNAL_TAG_OVERFLOW_BADGE_CLASS,
} from '../utils/signal-tag-badge-styles';

type SpaceIntelligenceGraphProps = {
  graph: IntelligenceGraph;
  className?: string;
};

/** Lightweight SVG force-free layout: circle of nodes + related edges (M3). */
export const SpaceIntelligenceGraph: FC<SpaceIntelligenceGraphProps> = ({
  graph,
  className,
}) => {
  const nodes = graph.nodes;
  if (nodes.length === 0) {
    return null;
  }

  const width = 640;
  const height = 280;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.36;
  const positions = new Map<string, { x: number; y: number }>();

  nodes.forEach((node, index) => {
    const angle = (2 * Math.PI * index) / nodes.length - Math.PI / 2;
    positions.set(node.id, {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  });

  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-lg border border-border bg-neutral-2',
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Space intelligence knowledge graph (artifacts and signals)"
      >
        {graph.edges.map((edge) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) return null;
          const proposed = edge.relation === 'proposed-patch';
          return (
            <line
              key={`${edge.relation}-${edge.from}-${edge.to}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className={proposed ? 'stroke-accent-8' : 'stroke-accent-7'}
              strokeWidth={proposed ? 1 : 1.5}
              strokeDasharray={proposed ? '4 3' : undefined}
            />
          );
        })}
        {nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const isSignal =
            node.kind === 'signal' || node.kind === 'signal-missing';
          const missing = node.kind === 'signal-missing';
          return (
            <g key={node.id}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isSignal ? 10 : 14}
                className={
                  missing
                    ? 'fill-neutral-4 stroke-neutral-8'
                    : isSignal
                    ? 'fill-background stroke-accent-9'
                    : 'fill-accent-4 stroke-accent-9'
                }
                strokeWidth={1.5}
              />
              <text
                x={pos.x}
                y={pos.y + 28}
                textAnchor="middle"
                className="fill-neutral-12 text-[10px]"
              >
                {(node.title.length > 28
                  ? `${node.title.slice(0, 26)}…`
                  : node.title
                ).replace(/[<>&]/g, '')}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const STATUS_LEFT_BAR: Record<string, string> = {
  draft: 'bg-neutral-7',
  current: 'bg-accent-9',
  contested: 'bg-warning-9',
  superseded: 'bg-neutral-7',
  archived: 'bg-error-9',
};

function IntelligenceTagBadges({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  const visible = tags.slice(0, 2);
  const overflow = tags.length - visible.length;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {visible.map((tag) => (
        <span
          key={tag}
          className={cn(
            'inline-flex items-center border px-1.5 py-0.5 text-[10px]',
            SIGNAL_TAG_BADGE_CLASS,
          )}
        >
          {tag}
        </span>
      ))}
      {overflow > 0 ? (
        <span
          className={cn(
            'inline-flex items-center border px-1.5 py-0.5 text-[10px]',
            SIGNAL_TAG_OVERFLOW_BADGE_CLASS,
          )}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

function stopCardActivationKey(event: KeyboardEvent<HTMLElement>) {
  if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
    }
    event.stopPropagation();
  }
}

type IntelligenceCardProps = {
  artifact: IntelligenceListItem;
  canEdit?: boolean;
  onDelete?: (artifact: IntelligenceListItem) => void;
};

export const SpaceIntelligenceCard: FC<IntelligenceCardProps> = ({
  artifact,
  canEdit = false,
  onDelete,
}) => {
  const t = useTranslations('CoherenceTab');
  const router = useRouter();
  const params = useParams<{ lang: string; id: string; tab?: string }>();
  const locale = useLocale();
  const dateFnsLocale = resolveDateFnsLocale(locale);

  const typeKey = `intelligenceTypes.${artifact.type}`;
  const statusKey = `intelligenceStatuses.${artifact.status}`;
  const typeLabel = t.has(typeKey as never)
    ? t(typeKey as never)
    : artifact.type;
  const statusLabel = t.has(statusKey as never)
    ? t(statusKey as never)
    : artifact.status;

  const updatedAtDate = artifact.updated_at
    ? new Date(
        /^\d{4}-\d{2}-\d{2}$/.test(artifact.updated_at)
          ? `${artifact.updated_at}T00:00:00`
          : artifact.updated_at,
      )
    : null;
  const updatedShort =
    updatedAtDate && !Number.isNaN(updatedAtDate.getTime())
      ? formatDistanceToNowStrict(updatedAtDate, {
          addSuffix: false,
          locale: dateFnsLocale,
        })
      : '';

  const editHref =
    params.lang && params.id
      ? `/${params.lang}/dho/${params.id}/${
          params.tab ?? 'memory'
        }/edit-intelligence/${artifact.id}`
      : undefined;

  const openEditor = () => {
    if (!editHref) return;
    router.push(editHref);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openEditor}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openEditor();
        }
      }}
      className="craft-card-interactive group relative flex h-full min-h-0 w-full cursor-pointer flex-col rounded-xl border border-border/70 bg-background-2 text-left text-card-foreground shadow-none outline-none transition-[border-color,background-color] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-accent-9/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div
        className={cn(
          PRIORITY_LEFT_ACCENT_BAR_CLASS,
          STATUS_LEFT_BAR[artifact.status] ?? STATUS_LEFT_BAR.current,
        )}
        title={statusLabel}
        aria-label={statusLabel}
      />
      <div className="relative flex flex-1 flex-col gap-0 p-0">
        <div className="relative flex flex-1 flex-col gap-2.5 px-3.5 pb-3 pt-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 text-3 font-medium leading-snug tracking-tight [font-family:var(--font-family-heading)]">
                  {artifact.title}
                </h3>
              </div>
              {canEdit && (editHref || onDelete) ? (
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                  {editHref ? (
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md p-0 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={t('spaceIntelligenceEditMenu')}
                      title={t('spaceIntelligenceEditMenu')}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        router.push(editHref);
                      }}
                      onKeyDown={stopCardActivationKey}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md p-0 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={t('spaceIntelligenceDeleteMenu')}
                      title={t('spaceIntelligenceDeleteMenu')}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onDelete(artifact);
                      }}
                      onKeyDown={stopCardActivationKey}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <p className="text-1 text-muted-foreground">
              <span>{typeLabel}</span>
              <span aria-hidden> · </span>
              <span>{statusLabel}</span>
              {updatedShort ? (
                <>
                  <span aria-hidden> · </span>
                  <span>{updatedShort}</span>
                </>
              ) : null}
            </p>
          </div>
          {artifact.excerpt ? (
            <p className="line-clamp-2 min-h-[2.5rem] text-2 leading-snug text-muted-foreground">
              {artifact.excerpt}
            </p>
          ) : null}
          <IntelligenceTagBadges tags={artifact.tags} />
        </div>
      </div>
    </div>
  );
};

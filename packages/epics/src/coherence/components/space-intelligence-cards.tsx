'use client';

import { FC, KeyboardEvent } from 'react';
import type {
  IntelligenceGraph,
  IntelligenceGraphNode,
  IntelligenceListItem,
} from '@hypha-platform/core/intelligence';
import { cn } from '@hypha-platform/ui-utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { ChatBubbleIcon } from '@radix-ui/react-icons';
import { Pencil, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { resolveDateFnsLocale } from '../../utils/date-fns-locale';
import { PRIORITY_LEFT_ACCENT_BAR_CLASS } from '../utils/signal-priority-styles';
import {
  SIGNAL_TAG_BADGE_CLASS,
  SIGNAL_TAG_OVERFLOW_BADGE_CLASS,
} from '../utils/signal-tag-badge-styles';

function intelligenceEditHref(
  params: { lang?: string; id?: string; tab?: string },
  artifactId: string,
): string | undefined {
  if (!params.lang || !params.id) return undefined;
  return `/${params.lang}/dho/${params.id}/${
    params.tab ?? 'memory'
  }/edit-intelligence/${artifactId}`;
}

function intelligenceSignalHref(
  params: { lang?: string; id?: string },
  signalSlug: string,
): string | undefined {
  if (!params.lang || !params.id) return undefined;
  return `/${params.lang}/dho/${
    params.id
  }/coherence/edit-signal/${encodeURIComponent(signalSlug)}`;
}

function pushOverlayHref(
  router: ReturnType<typeof useRouter>,
  href: string | undefined,
) {
  if (!href) return;
  window.setTimeout(() => {
    router.push(href, { scroll: false });
  }, 0);
}

function graphNodeLabel(title: string, max = 40): string {
  const clean = title.replace(/[<>&]/g, '');
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function layoutIntelligenceGraph(
  nodes: IntelligenceGraphNode[],
  width: number,
  minHeight: number,
): { positions: Map<string, { x: number; y: number }>; height: number } {
  const signals = nodes
    .filter((node) => node.kind !== 'artifact')
    .sort((a, b) => a.title.localeCompare(b.title));
  const artifacts = nodes
    .filter((node) => node.kind === 'artifact')
    .sort((a, b) => a.title.localeCompare(b.title));
  const row = 72;
  const padY = 56;
  const height = Math.max(
    minHeight,
    padY * 2 + Math.max(signals.length, artifacts.length, 1) * row,
  );
  const positions = new Map<string, { x: number; y: number }>();
  const place = (list: IntelligenceGraphNode[], x: number) => {
    if (list.length === 0) return;
    const span = height - padY * 2;
    list.forEach((node, index) => {
      const y =
        list.length === 1
          ? height / 2
          : padY + (span * index) / Math.max(list.length - 1, 1);
      positions.set(node.id, { x, y });
    });
  };
  if (signals.length === 0) {
    place(artifacts, width / 2);
  } else {
    place(signals, 200);
    place(artifacts, width - 200);
  }
  return { positions, height };
}

type SpaceIntelligenceGraphProps = {
  graph: IntelligenceGraph;
  className?: string;
};

/** Bipartite SVG layout: signals on the left, artifacts on the right. */
export const SpaceIntelligenceGraph: FC<SpaceIntelligenceGraphProps> = ({
  graph,
  className,
}) => {
  const t = useTranslations('CoherenceTab');
  const router = useRouter();
  const params = useParams<{ lang: string; id: string; tab?: string }>();
  const nodes = graph.nodes;
  if (nodes.length === 0) {
    return null;
  }

  const width = 720;
  const { positions, height } = layoutIntelligenceGraph(nodes, width, 360);
  const hasSignalColumn = nodes.some((node) => node.kind !== 'artifact');

  const openNode = (node: IntelligenceGraphNode) => {
    if (node.kind === 'artifact') {
      pushOverlayHref(router, intelligenceEditHref(params, node.id));
      return;
    }
    const slug = node.slug?.trim();
    if (!slug) return;
    pushOverlayHref(router, intelligenceSignalHref(params, slug));
  };

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
        role="group"
        aria-label={t('spaceIntelligenceGraphAria')}
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
          const canOpen =
            node.kind === 'artifact' || Boolean(node.slug?.trim());
          const labelSide: 'left' | 'right' | 'below' = !hasSignalColumn
            ? 'below'
            : isSignal
            ? 'left'
            : 'right';
          const labelX =
            labelSide === 'left'
              ? pos.x - 20
              : labelSide === 'right'
              ? pos.x + 20
              : pos.x;
          const labelY = labelSide === 'below' ? pos.y + 26 : pos.y + 4;
          const openLabel = t('spaceIntelligenceOpenArtifact', {
            title: node.title,
          });
          return (
            <g
              key={node.id}
              role={canOpen ? 'button' : undefined}
              tabIndex={canOpen ? 0 : undefined}
              className={
                canOpen
                  ? 'cursor-pointer outline-none focus-visible:[&>circle]:stroke-[3]'
                  : undefined
              }
              aria-label={canOpen ? openLabel : undefined}
              onClick={
                canOpen
                  ? (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openNode(node);
                    }
                  : undefined
              }
              onKeyDown={
                canOpen
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openNode(node);
                      }
                    }
                  : undefined
              }
            >
              <title>{canOpen ? openLabel : node.title}</title>
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
                x={labelX}
                y={labelY}
                textAnchor={
                  labelSide === 'left'
                    ? 'end'
                    : labelSide === 'right'
                    ? 'start'
                    : 'middle'
                }
                dominantBaseline={labelSide === 'below' ? 'hanging' : 'middle'}
                className="fill-neutral-12 text-[10px]"
              >
                {graphNodeLabel(node.title)}
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
  const visible = tags.slice(0, 5);
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
  onOpenComments?: (artifact: IntelligenceListItem) => void;
  commentsDisabled?: boolean;
  commentsTitle?: string;
};

export const SpaceIntelligenceCard: FC<IntelligenceCardProps> = ({
  artifact,
  canEdit = false,
  onDelete,
  onOpenComments,
  commentsDisabled = false,
  commentsTitle,
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

  const editHref = intelligenceEditHref(params, artifact.id);

  const openEditor = () => {
    pushOverlayHref(router, editHref);
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
                        pushOverlayHref(router, editHref);
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
            <p className="line-clamp-5 min-h-[6.25rem] text-2 leading-snug text-muted-foreground">
              {artifact.excerpt}
            </p>
          ) : null}
          <IntelligenceTagBadges tags={artifact.tags} />
        </div>
        {onOpenComments ? (
          <div className="mt-auto flex shrink-0 items-center gap-2 border-t border-border/50 px-3.5 py-2">
            <button
              type="button"
              className="inline-flex h-7 min-w-0 flex-1 items-center justify-start gap-1.5 rounded-md px-2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              disabled={commentsDisabled}
              title={commentsTitle}
              aria-label={t('openConversation')}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenComments(artifact);
              }}
              onKeyDown={stopCardActivationKey}
            >
              <ChatBubbleIcon aria-hidden />
              <span className="truncate text-1">{t('openConversation')}</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

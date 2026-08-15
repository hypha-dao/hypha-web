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
import { Archive, Brain, Pencil } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { resolveDateFnsLocale } from '../../utils/date-fns-locale';
import {
  PRIORITY_LEFT_ACCENT_BAR_CLASS,
  priorityGraphNodeClass,
} from '../utils/signal-priority-styles';
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

function intelligenceDocumentationHref(
  params: { lang?: string; id?: string },
  node: IntelligenceGraphNode,
): string | undefined {
  const fileHref = node.href?.trim();
  if (
    fileHref &&
    (fileHref.startsWith('https://') || fileHref.startsWith('http://'))
  ) {
    return fileHref;
  }
  const slug = node.slug?.trim();
  if (!params.lang || !params.id || !slug) return undefined;
  return `/${params.lang}/dho/${params.id}/memory?doc=${encodeURIComponent(
    slug,
  )}`;
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

function graphHoverLabel(node: IntelligenceGraphNode): string {
  const type = node.type?.trim();
  if (node.kind === 'artifact') {
    return type ? `${node.title} · ${type}` : node.title;
  }
  if (node.kind === 'documentation') {
    return `${node.title} · Documentation`;
  }
  const kind = type && type !== 'signal' ? type : 'Signal';
  return `${node.title} · ${kind}`;
}

function graphNodeLabel(title: string, max = 40): string {
  const clean = title.replace(/[<>&]/g, '');
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function signalTrianglePoints(x: number, y: number): string {
  const height = 28;
  const width = 30;
  return `${x},${y - height * 0.62} ${x - width / 2},${y + height * 0.42} ${
    x + width / 2
  },${y + height * 0.42}`;
}

function layoutIntelligenceGraph(
  nodes: IntelligenceGraphNode[],
  width: number,
  minHeight: number,
): { positions: Map<string, { x: number; y: number }>; height: number } {
  const signals = nodes
    .filter((node) => node.kind === 'signal' || node.kind === 'signal-missing')
    .sort((a, b) => a.title.localeCompare(b.title));
  const documents = nodes
    .filter((node) => node.kind === 'documentation')
    .sort((a, b) => a.title.localeCompare(b.title));
  const artifacts = nodes
    .filter((node) => node.kind === 'artifact')
    .sort((a, b) => a.title.localeCompare(b.title));
  const row = 72;
  const padY = 56;
  const height = Math.max(
    minHeight,
    padY * 2 +
      Math.max(signals.length, documents.length, artifacts.length, 1) * row,
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
  if (signals.length === 0 && documents.length === 0) {
    place(artifacts, width / 2);
  } else if (documents.length === 0) {
    place(signals, 200);
    place(artifacts, width - 200);
  } else if (signals.length === 0) {
    place(artifacts, 200);
    place(documents, width - 200);
  } else {
    place(signals, 130);
    place(artifacts, width / 2);
    place(documents, width - 130);
  }
  return { positions, height };
}

type SpaceIntelligenceGraphProps = {
  graph: IntelligenceGraph;
  className?: string;
};

/** Signals left, artifacts center, documentation right. */
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
  const hasSignals = nodes.some(
    (node) => node.kind === 'signal' || node.kind === 'signal-missing',
  );
  const hasDocuments = nodes.some((node) => node.kind === 'documentation');
  const hasSideColumns = hasSignals || hasDocuments;

  const openNode = (node: IntelligenceGraphNode) => {
    if (node.kind === 'artifact') {
      pushOverlayHref(router, intelligenceEditHref(params, node.id));
      return;
    }
    if (node.kind === 'documentation') {
      const href = intelligenceDocumentationHref(params, node);
      if (!href) return;
      if (href.startsWith('http://') || href.startsWith('https://')) {
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }
      pushOverlayHref(router, href);
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
        <style>{`
          .intel-graph-node { outline: none; }
          .intel-graph-node[role='button'] { cursor: pointer; }
          .intel-graph-node[role='button']:hover {
            filter: drop-shadow(0 3px 8px rgba(15, 23, 42, 0.28));
          }
          .intel-graph-node[role='button']:focus-visible circle,
          .intel-graph-node[role='button']:focus-visible polygon,
          .intel-graph-node[role='button']:focus-visible rect {
            stroke-width: 3;
          }
          .intel-graph-hover-label { opacity: 0; }
          .intel-graph-node:hover .intel-graph-hover-label,
          .intel-graph-node:focus-visible .intel-graph-hover-label {
            opacity: 1;
          }
        `}</style>
        {graph.edges.map((edge) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) return null;
          const proposed = edge.relation === 'proposed-patch';
          const midX = (from.x + to.x) / 2;
          return (
            <path
              key={`${edge.relation}-${edge.from}-${edge.to}`}
              d={`M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`}
              fill="none"
              className={proposed ? 'stroke-accent-8' : 'stroke-accent-7'}
              strokeWidth={proposed ? 1.25 : 1.75}
              strokeDasharray={proposed ? '5 4' : undefined}
            />
          );
        })}
        {nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const isSignal =
            node.kind === 'signal' || node.kind === 'signal-missing';
          const isDocumentation = node.kind === 'documentation';
          const missing = node.kind === 'signal-missing';
          const canOpen =
            node.kind === 'artifact' ||
            isDocumentation ||
            Boolean(node.slug?.trim());
          const labelSide: 'left' | 'right' | 'below' = !hasSideColumns
            ? 'below'
            : isSignal
            ? 'left'
            : isDocumentation
            ? 'right'
            : hasDocuments && hasSignals
            ? 'below'
            : hasDocuments
            ? 'left'
            : 'right';
          const labelX =
            labelSide === 'left'
              ? pos.x - 22
              : labelSide === 'right'
              ? pos.x + 22
              : pos.x;
          const labelY = labelSide === 'below' ? pos.y + 28 : pos.y + 4;
          const hoverLabel = graphHoverLabel(node);
          return (
            <g
              key={node.id}
              role={canOpen ? 'button' : undefined}
              tabIndex={canOpen ? 0 : undefined}
              className="intel-graph-node"
              aria-label={canOpen ? hoverLabel : undefined}
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
              <title>{hoverLabel}</title>
              {isSignal ? (
                <>
                  <polygon
                    points={signalTrianglePoints(pos.x, pos.y)}
                    className={
                      missing
                        ? 'fill-neutral-4 stroke-neutral-8'
                        : priorityGraphNodeClass(node.priority)
                    }
                    strokeWidth={1.5}
                  />
                  <g
                    transform={`translate(${pos.x - 6} ${pos.y - 4})`}
                    className={
                      missing
                        ? 'fill-neutral-8 stroke-neutral-8'
                        : 'fill-white stroke-white'
                    }
                    strokeWidth={1.35}
                    strokeLinecap="round"
                    aria-hidden
                  >
                    <circle cx="6" cy="7" r="1.35" stroke="none" />
                    <path d="M2.4 4.4a4.4 4.4 0 0 1 7.2 0" fill="none" />
                    <path d="M3.6 5.7a2.6 2.6 0 0 1 4.8 0" fill="none" />
                  </g>
                </>
              ) : isDocumentation ? (
                <>
                  <rect
                    x={pos.x - 13}
                    y={pos.y - 13}
                    width={26}
                    height={26}
                    rx={2}
                    className="fill-accent-5 stroke-accent-11"
                    strokeWidth={1.5}
                  />
                  <g
                    transform={`translate(${pos.x - 6} ${pos.y - 7})`}
                    className="stroke-white"
                    fill="none"
                    strokeWidth={1.35}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M3 1.5h4.2L11 5.3V12.5H3z" />
                    <path d="M7.2 1.5V5.3H11" />
                  </g>
                </>
              ) : (
                <>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={14}
                    className="fill-accent-4 stroke-accent-9"
                    strokeWidth={1.5}
                  />
                  <Brain
                    x={pos.x - 7}
                    y={pos.y - 7}
                    width={14}
                    height={14}
                    className="text-accent-11"
                    strokeWidth={2.2}
                    aria-hidden
                  />
                </>
              )}
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
              <text
                x={pos.x}
                y={pos.y - (isSignal || isDocumentation ? 26 : 22)}
                textAnchor="middle"
                className="intel-graph-hover-label fill-neutral-12 text-[10px] font-medium"
              >
                {graphNodeLabel(hoverLabel, 48)}
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
                      <Archive className="h-3.5 w-3.5" aria-hidden />
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

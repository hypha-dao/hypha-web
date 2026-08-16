'use client';

import { FC, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  buildIntelligenceSunburstTree,
  filterSunburstInputsByPriority,
  SIGNAL_SUNBURST_UNCATEGORIZED_ID,
  SUNBURST_PRIORITY_FILTERS,
  sunburstBoardColor,
  type IntelligenceGraph,
  type IntelligenceListItem,
  type IntelligenceSunburstNode,
  type SunburstBoardInput,
  type SunburstPriorityFilter,
} from '@hypha-platform/core/intelligence';
import {
  resolveDefaultBoard,
  useFindCoherences,
  useSignalWorkflow,
} from '@hypha-platform/core/client';
import { Slider } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';

const SUNBURST_SIZE = 720;
const SUNBURST_VISIBLE_RINGS = 4;

type SpaceIntelligenceSunburstProps = {
  spaceSlug: string;
  graph: IntelligenceGraph;
  artifacts: IntelligenceListItem[];
  hideArchived?: boolean;
  className?: string;
};

type ArcState = { x0: number; x1: number; y0: number; y1: number };

type LayoutNode = d3.HierarchyRectangularNode<IntelligenceSunburstNode> & {
  current: ArcState;
  target?: ArcState;
};

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
  node: IntelligenceSunburstNode,
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

function openSunburstNode(
  router: ReturnType<typeof useRouter>,
  params: { lang?: string; id?: string; tab?: string },
  node: IntelligenceSunburstNode,
) {
  if (node.kind === 'artifact' && node.artifactId) {
    pushOverlayHref(router, intelligenceEditHref(params, node.artifactId));
    return;
  }
  if (node.kind === 'file') {
    const href = intelligenceDocumentationHref(params, node);
    if (!href) return;
    if (href.startsWith('http://') || href.startsWith('https://')) {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    pushOverlayHref(router, href);
    return;
  }
  if (node.kind === 'signal' && node.slug) {
    pushOverlayHref(router, intelligenceSignalHref(params, node.slug));
  }
}

function sunburstLabelLines(name: string, maxWordLength: number): string[] {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word.length > maxWordLength
        ? `${word.slice(0, maxWordLength - 1)}…`
        : word,
    );
}

function applyWrappedSvgText(
  el: d3.Selection<SVGTextElement, unknown, d3.BaseType, unknown>,
  name: string,
  maxWordLength: number,
) {
  const lines = sunburstLabelLines(name, maxWordLength);
  const lineHeight = 1.1;
  const startDy = 0.35 - ((Math.max(lines.length, 1) - 1) * lineHeight) / 2;
  el.text(null);
  for (const [i, line] of lines.entries()) {
    el.append('tspan')
      .attr('x', 0)
      .attr('dy', `${i === 0 ? startDy : lineHeight}em`)
      .text(line);
  }
}

function priorityFilterLabel(
  t: ReturnType<typeof useTranslations>,
  filter: SunburstPriorityFilter,
) {
  if (filter === 'all') return t('all');
  return t(`priorities.${filter}` as never);
}

function SunburstPrioritySlider({
  value,
  onChange,
}: {
  value: SunburstPriorityFilter;
  onChange: (next: SunburstPriorityFilter) => void;
}) {
  const t = useTranslations('CoherenceTab');
  const index = Math.max(0, SUNBURST_PRIORITY_FILTERS.indexOf(value));
  return (
    <div className="mx-auto w-full max-w-md px-1">
      <Slider
        min={0}
        max={SUNBURST_PRIORITY_FILTERS.length - 1}
        step={1}
        value={[index]}
        onValueChange={(next) => {
          const step = SUNBURST_PRIORITY_FILTERS[next[0] ?? 0];
          if (step) onChange(step);
        }}
        aria-label={t('spaceIntelligenceSunburstPriority')}
        aria-valuetext={priorityFilterLabel(t, value)}
      />
      <div className="mt-1.5 flex justify-between gap-1">
        {SUNBURST_PRIORITY_FILTERS.map((step, stepIndex) => (
          <button
            key={step}
            type="button"
            className={cn(
              'min-w-0 flex-1 text-center text-[11px] leading-tight text-muted-foreground hover:text-foreground',
              stepIndex === index && 'font-semibold text-foreground',
            )}
            onClick={() => onChange(step)}
          >
            {priorityFilterLabel(t, step)}
          </button>
        ))}
      </div>
    </div>
  );
}

function categoryColor(node: LayoutNode, boards: SunburstBoardInput[]): string {
  let current: LayoutNode | null = node;
  while (current && current.depth > 1) {
    current = current.parent as LayoutNode | null;
  }
  if (current?.data.color) return current.data.color;
  const slug = current?.data.categoryId ?? SIGNAL_SUNBURST_UNCATEGORIZED_ID;
  return sunburstBoardColor(slug, boards);
}

export const SpaceIntelligenceSunburst: FC<SpaceIntelligenceSunburstProps> = ({
  spaceSlug,
  graph,
  artifacts,
  hideArchived = true,
  className,
}) => {
  const t = useTranslations('CoherenceTab');
  const router = useRouter();
  const params = useParams<{ lang: string; id: string; tab?: string }>();
  const hostRef = useRef<HTMLDivElement>(null);
  const [priorityFilter, setPriorityFilter] =
    useState<SunburstPriorityFilter>('all');
  const { coherences, isLoading } = useFindCoherences({
    spaceSlug,
    includeArchived: !hideArchived,
  });
  const { workflow, isLoading: isWorkflowLoading } =
    useSignalWorkflow(spaceSlug);

  const boards: SunburstBoardInput[] = useMemo(
    () =>
      (workflow?.boards ?? [])
        .filter((board) => !board.archived)
        .sort((a, b) => a.position - b.position)
        .map((board) => ({
          slug: board.slug,
          name: board.name,
          color: board.color,
          position: board.position,
        })),
    [workflow],
  );
  const defaultBoard = workflow ? resolveDefaultBoard(workflow) : 'general';

  const tree = useMemo(() => {
    const files = graph.nodes.flatMap((node) => {
      if (node.kind !== 'documentation') return [];
      const edge = graph.edges.find(
        (item) =>
          item.from === node.id && item.relation === 'linked-documentation',
      );
      if (!edge?.to) return [];
      return [
        {
          id: node.id,
          title: node.title,
          linked_artifact_id: edge.to,
          slug: node.slug,
          href: node.href,
        },
      ];
    });
    const filtered = filterSunburstInputsByPriority({
      filter: priorityFilter,
      signals: (coherences ?? [])
        .filter((item) => item.slug?.trim())
        .map((item) => ({
          slug: item.slug as string,
          title: item.title,
          board: item.board,
          priority: item.priority,
        })),
      artifacts: artifacts.map((item) => ({
        id: item.id,
        title: item.title,
        linked_signals: item.linked_signals,
      })),
    });
    return buildIntelligenceSunburstTree({
      rootName: t('spaceIntelligence'),
      defaultBoard,
      boards,
      signals: filtered.signals,
      artifacts: filtered.artifacts,
      files,
    });
  }, [
    artifacts,
    boards,
    coherences,
    defaultBoard,
    graph.edges,
    graph.nodes,
    priorityFilter,
    t,
  ]);

  const hasSlices = (tree.children?.length ?? 0) > 0;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !hasSlices) return;

    const width = SUNBURST_SIZE;
    // Hole (root) + visible rings, so the outer category rim sits at the edge.
    const radius = width / (2 * (SUNBURST_VISIBLE_RINGS + 1));
    const yOuter = SUNBURST_VISIBLE_RINGS + 1;
    const hierarchy = d3
      .hierarchy(tree)
      .sum((node) => node.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const root = d3
      .partition<IntelligenceSunburstNode>()
      .size([2 * Math.PI, hierarchy.height + 1])(hierarchy) as LayoutNode;
    root.each((node) => {
      const layout = node as LayoutNode;
      layout.current = {
        x0: layout.x0,
        x1: layout.x1,
        y0: layout.y0,
        y1: layout.y1,
      };
    });

    /** Invert depth so board categories (first ring) draw on the outer edge. */
    const ringInner = (d: ArcState) =>
      Math.max(0, (yOuter + 1 - d.y1) * radius);
    const ringOuter = (d: ArcState) =>
      Math.max(ringInner(d), (yOuter + 1 - d.y0) * radius - 1);

    const arc = d3
      .arc<ArcState>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius * 1.5)
      .innerRadius((d) => ringInner(d))
      .outerRadius((d) => ringOuter(d));

    const arcVisible = (d: ArcState) =>
      d.y1 <= yOuter && d.y0 >= 1 && d.x1 > d.x0;
    const labelVisible = (d: ArcState) =>
      arcVisible(d) && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
    const labelTransform = (d: ArcState) => {
      const x = ((d.x0 + d.x1) / 2) * (180 / Math.PI);
      const y = (ringInner(d) + ringOuter(d)) / 2;
      return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    };

    const svg = d3
      .select(host)
      .append('svg')
      .attr('viewBox', [-width / 2, -width / 2, width, width].join(' '))
      .attr('class', 'h-auto w-full')
      .attr('role', 'group')
      .attr('aria-label', t('spaceIntelligenceSunburstAria'))
      .style('font', '10px var(--font-sans, sans-serif)');

    const path = svg
      .append('g')
      .selectAll('path')
      .data(root.descendants().slice(1) as LayoutNode[])
      .join('path')
      .attr('fill', (d) => categoryColor(d, boards))
      .attr('fill-opacity', (d) =>
        arcVisible(d.current) ? (d.children ? 0.7 : 0.5) : 0,
      )
      .attr('pointer-events', (d) => (arcVisible(d.current) ? 'auto' : 'none'))
      .attr('d', (d) => arc(d.current))
      .style('cursor', 'pointer');

    path.append('title').text((d) => {
      const trail = d
        .ancestors()
        .map((node) => node.data.name)
        .reverse()
        .join(' / ');
      return trail;
    });

    const label = svg
      .append('g')
      .attr('pointer-events', 'none')
      .attr('text-anchor', 'middle')
      .style('user-select', 'none')
      .selectAll('text')
      .data(root.descendants().slice(1) as LayoutNode[])
      .join('text')
      .attr('fill-opacity', (d) => +labelVisible(d.current))
      .attr('transform', (d) => labelTransform(d.current))
      .attr('class', (d) =>
        d.data.kind === 'category'
          ? 'fill-neutral-12 font-semibold'
          : 'fill-neutral-12',
      )
      .style('font-size', (d) => (d.data.kind === 'category' ? '12px' : '10px'))
      .each(function (d) {
        applyWrappedSvgText(
          d3.select(this),
          d.data.name,
          d.data.kind === 'category' ? 22 : 28,
        );
      });

    const parent = svg
      .append('circle')
      .datum(root)
      .attr('r', radius)
      .attr('fill', 'transparent')
      .attr('pointer-events', 'all')
      .attr('class', 'cursor-pointer')
      .on('click', (event, p) => clicked(event, p as LayoutNode));

    const centerLabel = svg
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('class', 'fill-neutral-12 pointer-events-none')
      .style('font-size', '12px')
      .style('font-weight', '600');
    applyWrappedSvgText(centerLabel, root.data.name, 28);

    let focus: LayoutNode = root;

    function isNavigable(node: IntelligenceSunburstNode) {
      return (
        node.kind === 'signal' ||
        node.kind === 'artifact' ||
        node.kind === 'file'
      );
    }

    function clicked(event: Event, p: LayoutNode) {
      if (isNavigable(p.data) && (!p.children || p === focus)) {
        openSunburstNode(router, params, p.data);
        return;
      }
      if (p === focus && p === root) return;
      focus = p;
      parent.datum(p.parent || root);
      applyWrappedSvgText(centerLabel, p.data.name, 28);
      root.each((node) => {
        const layout = node as LayoutNode;
        layout.target = {
          x0:
            Math.max(0, Math.min(1, (layout.x0 - p.x0) / (p.x1 - p.x0))) *
            2 *
            Math.PI,
          x1:
            Math.max(0, Math.min(1, (layout.x1 - p.x0) / (p.x1 - p.x0))) *
            2 *
            Math.PI,
          y0: Math.max(0, layout.y0 - p.depth),
          y1: Math.max(0, layout.y1 - p.depth),
        };
      });
      const transition = svg
        .transition()
        .duration((event as MouseEvent).altKey ? 7500 : 750);
      path
        .transition(transition)
        .tween('data', (d) => {
          const interpolate = d3.interpolate(d.current, d.target as ArcState);
          return (t) => {
            d.current = interpolate(t);
          };
        })
        .filter(function (d) {
          return Boolean(
            +this.getAttribute('fill-opacity')! ||
              arcVisible(d.target as ArcState),
          );
        })
        .attr('fill-opacity', (d) =>
          arcVisible(d.target as ArcState) ? (d.children ? 0.7 : 0.5) : 0,
        )
        .attr('pointer-events', (d) =>
          arcVisible(d.target as ArcState) ? 'auto' : 'none',
        )
        .attrTween('d', (d) => () => arc(d.current) as string);
      label
        .filter(function (d) {
          return Boolean(
            +this.getAttribute('fill-opacity')! ||
              labelVisible(d.target as ArcState),
          );
        })
        .transition(transition)
        .attr('fill-opacity', (d) => +labelVisible(d.target as ArcState))
        .attrTween('transform', (d) => () => labelTransform(d.current));
    }

    path.on('click', (event, d) => {
      event.stopPropagation();
      clicked(event, d);
    });

    return () => {
      svg.remove();
    };
  }, [boards, hasSlices, params, router, t, tree]);

  const legendBoards = boards.length
    ? boards
    : (tree.children ?? []).map((child) => ({
        slug: child.categoryId ?? SIGNAL_SUNBURST_UNCATEGORIZED_ID,
        name: child.name,
        color: child.color,
      }));
  const usedBoards = new Set(
    (tree.children ?? [])
      .map((child) => child.categoryId)
      .filter(Boolean) as string[],
  );

  if ((isLoading && !coherences) || isWorkflowLoading) {
    return (
      <p className="text-2 text-muted-foreground">
        {t('spaceIntelligenceLoading')}
      </p>
    );
  }

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-3 overflow-hidden rounded-lg border border-border bg-neutral-2 p-3',
        className,
      )}
    >
      <SunburstPrioritySlider
        value={priorityFilter}
        onChange={setPriorityFilter}
      />
      {hasSlices ? (
        <div ref={hostRef} className="mx-auto w-full max-w-[720px]" />
      ) : (
        <p className="text-2 px-2 py-8 text-center text-muted-foreground">
          {priorityFilter === 'all'
            ? t('spaceIntelligenceSunburstEmpty')
            : t('spaceIntelligenceSunburstEmptyPriority')}
        </p>
      )}
      {hasSlices ? (
        <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 px-2">
          {legendBoards.map((board) => {
            const active = usedBoards.has(board.slug);
            return (
              <li
                key={board.slug}
                className={cn(
                  'inline-flex items-center gap-1.5 text-[11px]',
                  active ? 'text-foreground' : 'text-muted-foreground/60',
                )}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: sunburstBoardColor(board.slug, boards),
                  }}
                  aria-hidden
                />
                {board.name}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useTheme } from 'next-themes';
import { DEFAULT_SPACE_AVATAR_IMAGE } from '@hypha-platform/core/client';
import { MYCELIUM, myceliumNodeRadius } from './mycelium-theme';
import type { MyceliumGraph, MyceliumLink, MyceliumNode } from './types';

type SimNode = MyceliumNode & d3.SimulationNodeDatum;
type SimLink = Omit<MyceliumLink, 'source' | 'target'> & {
  source: string | SimNode;
  target: string | SimNode;
};

type HoverState = {
  x: number;
  y: number;
  title: string;
  detail?: string;
};

type MyceliumForceGraphProps = {
  graph: MyceliumGraph;
  className?: string;
  emptyLabel?: string;
  ariaLabel?: string;
  /** Space/brand accent used for hypha links and node rings. */
  accentHex?: string;
  onNodeClick?: (node: MyceliumNode) => void;
  onNodeExpand?: (node: MyceliumNode) => void;
};

function withAlpha(hex: string, alpha: number): string {
  const parsed = d3.color(hex);
  if (!parsed) return hex;
  parsed.opacity = alpha;
  return parsed.formatRgb();
}

function hyphaPath(
  source: { x: number; y: number },
  target: { x: number; y: number },
): string {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dist = Math.hypot(dx, dy) || 1;
  const bend = Math.min(48, dist * 0.28);
  const mx = (source.x + target.x) / 2;
  const my = (source.y + target.y) / 2;
  const nx = (-dy / dist) * bend;
  const ny = (dx / dist) * bend;
  return `M${source.x},${source.y} Q${mx + nx},${my + ny} ${target.x},${
    target.y
  }`;
}

function activateNode(
  d: SimNode,
  onNodeExpand: MyceliumForceGraphProps['onNodeExpand'],
  onNodeClick: MyceliumForceGraphProps['onNodeClick'],
) {
  if (d.expandable && onNodeExpand) {
    onNodeExpand(d);
    return;
  }
  onNodeClick?.(d);
}

export function MyceliumForceGraph({
  graph,
  className,
  emptyLabel,
  ariaLabel,
  accentHex,
  onNodeClick,
  onNodeExpand,
}: MyceliumForceGraphProps) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const onNodeClickRef = useRef(onNodeClick);
  const onNodeExpandRef = useRef(onNodeExpand);
  const [hover, setHover] = useState<HoverState | null>(null);
  const isDark = resolvedTheme === 'dark';
  const accent = accentHex?.trim() || MYCELIUM.accent;
  const svgAriaLabel = ariaLabel ?? emptyLabel ?? 'Ecosystem mycelium graph';

  const graphKey = useMemo(
    () =>
      JSON.stringify({
        nodes: graph.nodes.map((n) => [
          n.id,
          n.expanded,
          n.label,
          n.meta,
          n.kind,
        ]),
        links: graph.links.map((l) => [
          l.id,
          l.source,
          l.target,
          l.weight,
          l.strength,
        ]),
      }),
    [graph],
  );

  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
    onNodeExpandRef.current = onNodeExpand;

    if (!svgRef.current) return;
    const hasClick = !!onNodeClick;
    d3.select(svgRef.current)
      .selectAll<SVGGElement, SimNode>('.mycelium-node')
      .attr('tabindex', (d) => (d.expandable || hasClick ? 0 : null))
      .attr('role', (d) => (d.expandable || hasClick ? 'button' : null))
      .style('cursor', (d) =>
        d.expandable || hasClick ? 'pointer' : 'default',
      );
  }, [onNodeClick, onNodeExpand]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    if (graph.nodes.length === 0) return;
    if (resolvedTheme === undefined) return;

    const container = containerRef.current;
    const width = Math.max(container.clientWidth, 320);
    const nodeCount = graph.nodes.length;
    const height = Math.max(
      MYCELIUM.canvasMinHeight,
      Math.min(720, width * (nodeCount > 24 ? 0.85 : 0.72)),
    );
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', '100%');

    const nodes: SimNode[] = graph.nodes.map((node) => ({
      ...node,
      x: width / 2 + (Math.random() - 0.5) * 40,
      y: height / 2 + (Math.random() - 0.5) * 40,
    }));
    const hub = nodes.find((n) => n.kind === 'hub');
    if (hub) {
      hub.fx = width / 2;
      hub.fy = height / 2;
    }

    const links: SimLink[] = graph.links.map((link) => ({ ...link }));
    const linkColor = withAlpha(accent, isDark ? 0.72 : 0.62);
    const accentSoft = withAlpha(accent, isDark ? 0.22 : 0.16);
    const accentMuted = withAlpha(accent, isDark ? 0.45 : 0.38);
    const fill = isDark ? '#0f172a' : '#ffffff';
    const badgeStroke = isDark ? '#0b1220' : '#ffffff';
    const hasClick = !!onNodeClickRef.current;

    const defs = svg.append('defs');
    const glow = defs
      .append('filter')
      .attr('id', 'mycelium-glow')
      .attr('x', '-40%')
      .attr('y', '-40%')
      .attr('width', '180%')
      .attr('height', '180%');
    glow
      .append('feGaussianBlur')
      .attr('stdDeviation', 2.4)
      .attr('result', 'coloredBlur');
    const merge = glow.append('feMerge');
    merge.append('feMergeNode').attr('in', 'coloredBlur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');

    const g = svg.append('g');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.45, 2.4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });
    svg.call(zoom);

    const maxWeight = Math.max(
      ...links.map((l) => l.weight ?? l.strength ?? 0.4),
      0.001,
    );
    const strokeFor = (d: SimLink) => {
      const w = (d.weight ?? d.strength ?? 0.4) / maxWeight;
      // Strong visual range so large flows read clearly vs small ones.
      return 1.5 + Math.sqrt(Math.max(w, 0)) * 14;
    };

    const link = g
      .append('g')
      .attr('fill', 'none')
      .selectAll<SVGPathElement, SimLink>('path')
      .data(links)
      .join('path')
      .attr('class', 'mycelium-link')
      .attr('stroke', linkColor)
      .attr('stroke-width', strokeFor)
      .attr('stroke-linecap', 'round')
      .attr('opacity', (d) => {
        const w = (d.weight ?? d.strength ?? 0.4) / maxWeight;
        return 0.45 + w * 0.45;
      })
      .attr('filter', 'url(#mycelium-glow)');

    const node = g
      .append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .attr('class', 'mycelium-node')
      .attr('tabindex', (d) => (d.expandable || hasClick ? 0 : null))
      .attr('role', (d) => (d.expandable || hasClick ? 'button' : null))
      .style('cursor', (d) =>
        d.expandable || hasClick ? 'pointer' : 'default',
      )
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.25).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            if (d.kind !== 'hub') {
              d.fx = null;
              d.fy = null;
            }
          }),
      );

    node.each(function (d) {
      const group = d3.select(this);
      const r = myceliumNodeRadius(d.kind);
      const safeId = d.id.replace(/[^a-zA-Z0-9_-]/g, '-');
      const clipId = `mycelium-clip-${safeId}`;
      const isSpaceShape = d.kind === 'space';
      const corner = isSpaceShape ? r * 0.35 : r;

      const clip = defs.append('clipPath').attr('id', clipId);
      if (isSpaceShape) {
        clip
          .append('rect')
          .attr('x', -r)
          .attr('y', -r)
          .attr('width', r * 2)
          .attr('height', r * 2)
          .attr('rx', corner)
          .attr('ry', corner);
      } else {
        clip.append('circle').attr('r', r);
      }

      // Soft halo
      if (isSpaceShape) {
        group
          .append('rect')
          .attr('class', 'mycelium-halo')
          .attr('x', -(r + 4))
          .attr('y', -(r + 4))
          .attr('width', (r + 4) * 2)
          .attr('height', (r + 4) * 2)
          .attr('rx', corner + 2)
          .attr('ry', corner + 2)
          .attr('fill', accentSoft)
          .attr('opacity', 0.7);
        group
          .append('rect')
          .attr('class', 'mycelium-ring')
          .attr('x', -(r + 1.5))
          .attr('y', -(r + 1.5))
          .attr('width', (r + 1.5) * 2)
          .attr('height', (r + 1.5) * 2)
          .attr('rx', corner)
          .attr('ry', corner)
          .attr('fill', fill)
          .attr('stroke', d.expanded ? accent : accentMuted)
          .attr('stroke-width', d.expanded ? 2.4 : 1.6);
      } else {
        group
          .append('circle')
          .attr('class', 'mycelium-halo')
          .attr('r', r + (d.kind === 'hub' ? 6 : 3))
          .attr('fill', accentSoft)
          .attr('opacity', d.kind === 'hub' ? 0.9 : 0.55);
        group
          .append('circle')
          .attr('class', 'mycelium-ring')
          .attr('r', r + 1.5)
          .attr('fill', fill)
          .attr('stroke', d.expanded ? accent : accentMuted)
          .attr('stroke-width', d.expanded ? 2.4 : 1.4);
      }

      group
        .append('image')
        .attr(
          'href',
          d.imageUrl ||
            (d.kind === 'person'
              ? '/placeholder/default-profile.svg'
              : DEFAULT_SPACE_AVATAR_IMAGE),
        )
        .attr('x', -r)
        .attr('y', -r)
        .attr('width', r * 2)
        .attr('height', r * 2)
        .attr('preserveAspectRatio', 'xMidYMid slice')
        .attr('clip-path', `url(#${clipId})`);

      // Kind badge: person = round pip, space = square pip
      const badgeX = r * 0.78;
      const badgeY = r * 0.78;
      if (d.kind === 'person' || d.kind === 'space') {
        if (d.kind === 'space') {
          group
            .append('rect')
            .attr('class', 'mycelium-badge')
            .attr('x', badgeX - 5)
            .attr('y', badgeY - 5)
            .attr('width', 10)
            .attr('height', 10)
            .attr('rx', 2)
            .attr('fill', accent)
            .attr('stroke', badgeStroke)
            .attr('stroke-width', 1.2);
        } else {
          group
            .append('circle')
            .attr('class', 'mycelium-badge')
            .attr('cx', badgeX)
            .attr('cy', badgeY)
            .attr('r', 4.5)
            .attr('fill', accent)
            .attr('stroke', badgeStroke)
            .attr('stroke-width', 1.2);
        }
      }

      if (d.expandable) {
        group
          .append('circle')
          .attr('class', 'mycelium-expand')
          .attr('cx', r * 0.72)
          .attr('cy', -r * 0.72)
          .attr('r', 7)
          .attr('fill', accent)
          .attr('stroke', badgeStroke)
          .attr('stroke-width', 1.5);
        group
          .append('text')
          .attr('x', r * 0.72)
          .attr('y', -r * 0.72 + 1)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('fill', '#ffffff')
          .attr('font-size', 10)
          .attr('font-weight', 700)
          .text(d.expanded ? '−' : '+');
      }
    });

    const handleActivate = (event: Event, d: SimNode) => {
      event.stopPropagation();
      activateNode(d, onNodeExpandRef.current, onNodeClickRef.current);
    };

    node
      .on('mouseenter', (event, d) => {
        const rect = container.getBoundingClientRect();
        setHover({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          title: d.label,
          detail: d.meta,
        });
      })
      .on('mousemove', (event) => {
        const rect = container.getBoundingClientRect();
        setHover((prev) =>
          prev
            ? {
                ...prev,
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
              }
            : null,
        );
      })
      .on('mouseleave', () => setHover(null))
      .on('click', handleActivate)
      .on('keydown', (event, d) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        handleActivate(event, d);
      })
      .on('focus', function () {
        d3.select(this)
          .select('.mycelium-ring')
          .attr('stroke', accent)
          .attr('stroke-width', 3);
      })
      .on('blur', function (_, d) {
        d3.select(this)
          .select('.mycelium-ring')
          .attr('stroke', d.expanded ? accent : accentMuted)
          .attr(
            'stroke-width',
            d.expanded ? 2.4 : d.kind === 'space' ? 1.6 : 1.4,
          );
      });

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((d) => 70 + (1 - (d.strength ?? 0.4)) * 50)
          .strength(0.55),
      )
      .force(
        'charge',
        d3.forceManyBody().strength(nodeCount > 30 ? -320 : -220),
      )
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force(
        'collision',
        d3
          .forceCollide<SimNode>()
          .radius(
            (d) => myceliumNodeRadius(d.kind) + (nodeCount > 30 ? 18 : 14),
          ),
      );

    simulation.on('tick', () => {
      link.attr('d', (d) => {
        const s = d.source as SimNode;
        const t = d.target as SimNode;
        return hyphaPath(
          { x: s.x ?? 0, y: s.y ?? 0 },
          { x: t.x ?? 0, y: t.y ?? 0 },
        );
      });
      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
      setHover(null);
    };
    // Rebuild on structure only. Theme/accent colors are patched by the style effect.
    // `resolvedTheme === undefined` is intentional so we re-run once when theme settles,
    // without rebuilding on every light↔dark toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphKey, resolvedTheme === undefined]);

  useEffect(() => {
    if (!svgRef.current || resolvedTheme === undefined) return;

    const linkColor = withAlpha(accent, isDark ? 0.72 : 0.62);
    const accentSoft = withAlpha(accent, isDark ? 0.22 : 0.16);
    const accentMuted = withAlpha(accent, isDark ? 0.45 : 0.38);
    const fill = isDark ? '#0f172a' : '#ffffff';
    const badgeStroke = isDark ? '#0b1220' : '#ffffff';

    const svg = d3.select(svgRef.current);
    svg.selectAll('.mycelium-link').attr('stroke', linkColor);
    svg.selectAll('.mycelium-halo').attr('fill', accentSoft);
    svg.selectAll<SVGElement, SimNode>('.mycelium-node').each(function (d) {
      d3.select(this)
        .select('.mycelium-ring')
        .attr('fill', fill)
        .attr('stroke', d.expanded ? accent : accentMuted);
    });
    svg
      .selectAll('.mycelium-badge, .mycelium-expand')
      .attr('fill', accent)
      .attr('stroke', badgeStroke);
  }, [isDark, accent, resolvedTheme]);

  if (graph.nodes.length === 0) {
    return (
      <div
        className={[
          'flex min-h-[16rem] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/40 text-sm text-muted-foreground',
          className ?? '',
        ].join(' ')}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={[
        'relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-b from-background/30 via-background/40 to-background/80',
        className ?? '',
      ].join(' ')}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, ${withAlpha(
            accent,
            0.14,
          )}, transparent 62%)`,
        }}
      />
      <svg
        ref={svgRef}
        className="relative z-[1] h-auto w-full"
        role="img"
        aria-label={svgAriaLabel}
      />
      {hover ? (
        <div
          className="pointer-events-none absolute z-20 max-w-[16rem] rounded-xl border border-border/60 bg-popover/95 px-3 py-2 shadow-lg backdrop-blur-sm"
          style={{
            left: Math.min(
              Math.max(hover.x + 12, 8),
              (containerRef.current?.clientWidth ?? 320) - 180,
            ),
            top: Math.max(hover.y - 12, 8),
          }}
        >
          <p className="truncate text-2 font-semibold text-foreground">
            {hover.title}
          </p>
          {hover.detail ? (
            <p className="mt-0.5 line-clamp-3 text-1 text-muted-foreground">
              {hover.detail}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

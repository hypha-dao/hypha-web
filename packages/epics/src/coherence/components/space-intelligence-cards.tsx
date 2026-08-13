'use client';

import { FC } from 'react';
import type {
  IntelligenceGraph,
  IntelligenceManifestEntry,
} from '@hypha-platform/core/intelligence';
import { cn } from '@hypha-platform/ui-utils';

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

type IntelligenceCardProps = {
  artifact: IntelligenceManifestEntry;
  onSelect?: (id: string) => void;
};

export const SpaceIntelligenceCard: FC<IntelligenceCardProps> = ({
  artifact,
  onSelect,
}) => {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(artifact.id)}
      className="flex h-full w-full flex-col gap-2 rounded-lg border border-border bg-background p-4 text-left transition-colors hover:border-accent-7 hover:bg-accent-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-md bg-accent-3 px-2 py-0.5 text-1 font-medium text-accent-11">
          {artifact.type}
        </span>
        <span className="text-1 text-muted-foreground">{artifact.status}</span>
      </div>
      <h3 className="text-3 font-medium leading-snug text-foreground">
        {artifact.title}
      </h3>
      {artifact.tags.length > 0 ? (
        <p className="line-clamp-2 text-1 text-muted-foreground">
          {artifact.tags.join(' · ')}
        </p>
      ) : null}
    </button>
  );
};

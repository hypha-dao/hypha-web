'use client';

import { useEffect, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { loadLandGeo } from '../network-map/lib/load-land-geo';

const WIDTH = 720;
const HEIGHT = 380;

export type ExchangeMapNode = {
  slug: string;
  title: string;
  latitude: number;
  longitude: number;
};

export type ExchangeMapArc = {
  from: string;
  to: string;
  percent: number;
};

function projectPoint(
  projection: d3.GeoProjection,
  latitude: number,
  longitude: number,
) {
  const point = projection([longitude, latitude]);
  if (!point) return null;
  return { x: point[0], y: point[1] };
}

export function ExchangeWorldMap({
  nodes,
  arcs,
  selectedSlug,
  onSelect,
  label,
}: {
  nodes: ExchangeMapNode[];
  arcs: ExchangeMapArc[];
  selectedSlug: string;
  onSelect: (slug: string) => void;
  label: string;
}) {
  const [land, setLand] = useState<d3.GeoPermissibleObjects | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLandGeo()
      .then((geo) => {
        if (!cancelled) setLand(geo);
      })
      .catch(() => {
        if (!cancelled) setLand(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const projection = useMemo(() => {
    const next = d3.geoNaturalEarth1();
    next.fitExtent(
      [
        [28, 18],
        [WIDTH - 28, HEIGHT - 18],
      ],
      land ?? { type: 'Sphere' },
    );
    return next;
  }, [land]);

  const landPath = land ? d3.geoPath(projection)(land) ?? '' : '';
  const placed = new Map(
    nodes.flatMap((node) => {
      const point = projectPoint(projection, node.latitude, node.longitude);
      return point ? [[node.slug, { node, point }] as const] : [];
    }),
  );

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-full w-full"
      role="img"
      aria-label={label}
    >
      <path
        d={landPath}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.35"
        vectorEffect="non-scaling-stroke"
      />
      {arcs.map((arc) => {
        const from = placed.get(arc.from)?.point;
        const to = placed.get(arc.to)?.point;
        if (!from || !to) return null;
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = Math.hypot(dx, dy) || 1;
        const lift = Math.min(42, length * 0.22);
        const controlX = midX - (dy / length) * lift;
        const controlY = midY + (dx / length) * lift;
        return (
          <g key={`${arc.from}:${arc.to}`}>
            <path
              d={`M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`}
              fill="none"
              stroke="currentColor"
              strokeDasharray="5 4"
              strokeOpacity="0.55"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={controlX}
              y={controlY}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-foreground"
              fontSize="11"
            >
              {arc.percent}%
            </text>
          </g>
        );
      })}
      {nodes.map((node) => {
        const point = placed.get(node.slug)?.point;
        if (!point) return null;
        const selected = node.slug === selectedSlug;
        return (
          <g
            key={node.slug}
            className="cursor-pointer"
            onClick={() => onSelect(node.slug)}
          >
            <title>{node.title}</title>
            <circle
              cx={point.x}
              cy={point.y}
              r={selected ? 7 : 4.5}
              fill="currentColor"
              stroke="var(--background)"
              strokeWidth={selected ? 2 : 1}
            />
          </g>
        );
      })}
    </svg>
  );
}

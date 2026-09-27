'use client';

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import * as d3 from 'd3';
import { useTheme } from 'next-themes';
import { DEFAULT_SPACE_AVATAR_IMAGE } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import type { VisibleSpace } from './types';

type SpaceNode = {
  id: number;
  name: string;
  slug?: string;
  logoUrl?: string | null;
  children?: SpaceNode[];
};

type SpaceHierarchyNode = d3.HierarchyNode<SpaceNode> & {
  r?: number;
};

export type SpaceVisualizationZoomApi = {
  zoomIn: () => void;
  zoomOut: () => void;
};

type Props = {
  data: SpaceNode;
  currentSpaceId?: number;
  onVisibleSpacesChange?: (spaces: VisibleSpace[]) => void;
  enableHoverActions?: boolean;
  showNodeLabels?: boolean;
  ariaLabel?: string;
  /** Parent row calls these so zoom stays on the membership line. */
  zoomApiRef?: MutableRefObject<SpaceVisualizationZoomApi>;
  /** Stage fill. Default is a square that sizes from width. */
  className?: string;
};

const VISUALIZATION_CONFIG = {
  BASE_RADIUS: 420,
  DEPTH_SCALE: 0.45,
  ORBIT_RATIO: 0.9,
  LOGO_RATIO: 0.25,
  ZOOM_DURATION: 720,
  LOGO_STROKE_WIDTH: 20,
  STROKE_WIDTH_SCALE: 0.7,
  /** Names stay at least this large, even when a node is drawn small. */
  LABEL_MIN_FONT: 11,
  LABEL_MAX_FONT: 15,
  /** Clear gap between the outermost ring and the top of the name. */
  LABEL_GAP: 10,
  MAX_LABEL_CHARS: 18,
} as const;

function truncateLabel(
  name: string,
  maxChars = VISUALIZATION_CONFIG.MAX_LABEL_CHARS,
): string {
  const trimmed = name.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

/** SVG rejects negative `r` / `width` / `height`; clamp during zoom transitions. */
function clampSvgLength(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * One continuous ring. A stroked circle, and a path closed with `Z`,
 * starts and ends on a seam: the join gaps, stubs, or paints twice.
 * Four cubics return to the start with the same tangent, then a short
 * step continues along that tangent so the butt ends meet as one stroke.
 */
function smoothClosedCirclePath(radius: number): string {
  const r = clampSvgLength(radius);
  if (r <= 0) return '';
  const k = r * 0.5522847498307936;
  const n = (value: number) => value.toFixed(3);
  const overlap = Math.min(2.5, r * 0.02);
  const theta = overlap / r;
  const endX = r * Math.cos(theta);
  const endY = r * Math.sin(theta);
  const handle = overlap / 3;
  const tx = -Math.sin(theta);
  const ty = Math.cos(theta);
  return [
    `M ${n(r)} 0`,
    `C ${n(r)} ${n(k)} ${n(k)} ${n(r)} 0 ${n(r)}`,
    `C ${n(-k)} ${n(r)} ${n(-r)} ${n(k)} ${n(-r)} 0`,
    `C ${n(-r)} ${n(-k)} ${n(-k)} ${n(-r)} 0 ${n(-r)}`,
    `C ${n(k)} ${n(-r)} ${n(r)} ${n(-k)} ${n(r)} 0`,
    `C ${n(r)} ${n(handle)} ${n(endX - tx * handle)} ${n(
      endY - ty * handle,
    )} ${n(endX)} ${n(endY)}`,
  ].join(' ');
}

function finiteOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? (value as number) : fallback;
}

/** Screen inset so a hairline on the bounds is not cut by the stage edge. */
const CLUSTER_FIT_PADDING = 12;

type LayoutBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type ClusterFrame = {
  cx: number;
  cy: number;
  width: number;
  height: number;
};

type LabelMetrics = {
  labelFontSize: number;
  labelTop: number;
};

function labelMetrics(
  screenLogoRadius: number,
  isCurrent: boolean,
  isFocused: boolean,
): LabelMetrics {
  const labelFontSize = clampSvgLength(
    Math.min(
      VISUALIZATION_CONFIG.LABEL_MAX_FONT,
      Math.max(VISUALIZATION_CONFIG.LABEL_MIN_FONT, screenLogoRadius * 0.42),
    ),
  );
  const ringOutset = isCurrent
    ? Math.max(4, screenLogoRadius * 0.14)
    : isFocused
    ? Math.max(3.5, screenLogoRadius * 0.12)
    : 0;
  const labelTop =
    screenLogoRadius +
    ringOutset +
    3 +
    Math.max(VISUALIZATION_CONFIG.LABEL_GAP, labelFontSize * 0.5);
  return { labelFontSize, labelTop };
}

/** Middle-anchored names. Wide enough that a full label stays inside the fit. */
function estimateLabelHalfWidth(name: string, fontSize: number): number {
  const text = truncateLabel(name);
  return (text.length * fontSize * 0.62) / 2;
}

function includePoint(bounds: LayoutBounds, x: number, y: number) {
  if (x < bounds.minX) bounds.minX = x;
  if (y < bounds.minY) bounds.minY = y;
  if (x > bounds.maxX) bounds.maxX = x;
  if (y > bounds.maxY) bounds.maxY = y;
}

function includeCircle(
  bounds: LayoutBounds,
  x: number,
  y: number,
  radius: number,
) {
  includePoint(bounds, x - radius, y - radius);
  includePoint(bounds, x + radius, y + radius);
}

/**
 * Rings and the labels under them, in layout units. Label size is in screen
 * pixels, so the layout extent depends on the scale used to draw them.
 */
function clusterBounds(
  focus: SpaceHierarchyNode,
  scale: number,
  showLabels: boolean,
  currentSpaceId?: number,
): LayoutBounds {
  const bounds: LayoutBounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  const safeScale = Math.max(scale, 0.0001);
  focus.each((node) => {
    const d = node as SpaceHierarchyNode;
    const x = finiteOr(d.x, 0);
    const y = finiteOr(d.y, 0);
    const radius = finiteOr(d.r, 0);
    includeCircle(bounds, x, y, radius);
    if (!showLabels) return;
    const isCurrent =
      typeof currentSpaceId === 'number' && d.data.id === currentSpaceId;
    const isFocused = d === focus;
    const screenLogoRadius =
      radius * safeScale * VISUALIZATION_CONFIG.LOGO_RATIO;
    const { labelFontSize, labelTop } = labelMetrics(
      screenLogoRadius,
      isCurrent,
      isFocused,
    );
    const half = estimateLabelHalfWidth(d.data.name, labelFontSize) / safeScale;
    const bottom = y + (labelTop + labelFontSize * 1.35) / safeScale;
    includePoint(bounds, x - half, y);
    includePoint(bounds, x + half, bottom);
  });
  if (!Number.isFinite(bounds.minX)) {
    const x = finiteOr(focus.x, 0);
    const y = finiteOr(focus.y, 0);
    const radius = Math.max(finiteOr(focus.r, 1), 1);
    includeCircle(bounds, x, y, radius);
  }
  return bounds;
}

function frameFromBounds(bounds: LayoutBounds): ClusterFrame {
  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const height = Math.max(bounds.maxY - bounds.minY, 1);
  return {
    cx: (bounds.minX + bounds.maxX) / 2,
    cy: (bounds.minY + bounds.maxY) / 2,
    width,
    height,
  };
}

function fitScale(
  frame: ClusterFrame,
  viewWidth: number,
  viewHeight: number,
): number {
  const innerW = Math.max(viewWidth - CLUSTER_FIT_PADDING * 2, 1);
  const innerH = Math.max(viewHeight - CLUSTER_FIT_PADDING * 2, 1);
  return Math.min(innerW / frame.width, innerH / frame.height);
}

/**
 * Largest uniform scale that keeps the focused cluster — outer rings and the
 * labels under the logos — inside the stage. Extra stage height is used until
 * the width (or the label block) is the limit.
 */
function solveClusterFrame(
  focus: SpaceHierarchyNode,
  viewWidth: number,
  viewHeight: number,
  showLabels: boolean,
  currentSpaceId?: number,
): ClusterFrame {
  const diameter = Math.max(finiteOr(focus.r, 1) * 2, 1);
  let scale =
    Math.min(Math.max(viewWidth, 1), Math.max(viewHeight, 1)) / diameter;
  let frame = frameFromBounds(
    clusterBounds(focus, scale, showLabels, currentSpaceId),
  );
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const nextScale = fitScale(frame, viewWidth, viewHeight);
    const nextFrame = frameFromBounds(
      clusterBounds(focus, nextScale, showLabels, currentSpaceId),
    );
    const settled =
      Math.abs(nextScale - scale) <= Math.max(0.002, Math.abs(scale) * 0.01) &&
      Math.abs(nextFrame.width - frame.width) <= 0.5 &&
      Math.abs(nextFrame.height - frame.height) <= 0.5;
    scale = nextScale;
    frame = nextFrame;
    if (settled) break;
  }
  return frame;
}

function sanitizeHierarchyLayout(root: SpaceHierarchyNode): void {
  root.each((node) => {
    const d = node as SpaceHierarchyNode;
    d.x = finiteOr(d.x, 0);
    d.y = finiteOr(d.y, 0);
    d.r = Math.max(finiteOr(d.r, VISUALIZATION_CONFIG.BASE_RADIUS), 1);
  });
}

export function SpaceVisualization({
  data,
  currentSpaceId,
  onVisibleSpacesChange,
  enableHoverActions = true,
  showNodeLabels = true,
  ariaLabel = 'Space hierarchy visualization',
  zoomApiRef,
  className,
}: Props) {
  const { resolvedTheme } = useTheme();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousVisibleSpacesRef = useRef<string>('');
  const onVisibleSpacesChangeRef = useRef(onVisibleSpacesChange);
  const focusRef = useRef<d3.HierarchyNode<SpaceNode> | null>(null);
  const themeRef = useRef(resolvedTheme);
  const savedFocusIdRef = useRef<number | null>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    text: string;
    spaceId?: number;
    spaceSlug?: string;
  }>({ visible: false, x: 0, y: 0, text: '' });
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const tooltipHideTimeoutRef = useRef<number | null>(null);

  const clearTooltipHideTimeout = () => {
    if (tooltipHideTimeoutRef.current == null) return;
    window.clearTimeout(tooltipHideTimeoutRef.current);
    tooltipHideTimeoutRef.current = null;
  };

  const scheduleTooltipHide = () => {
    clearTooltipHideTimeout();
    tooltipHideTimeoutRef.current = window.setTimeout(() => {
      setTooltip((prev) => ({ ...prev, visible: false }));
    }, 120);
  };

  useEffect(() => {
    themeRef.current = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    onVisibleSpacesChangeRef.current = onVisibleSpacesChange;
  }, [onVisibleSpacesChange]);

  useEffect(() => {
    previousVisibleSpacesRef.current = '';
    // Reset focus memory when hierarchy / entry space changes (stable first paint).
    savedFocusIdRef.current = null;
  }, [data, currentSpaceId]);

  useEffect(() => {
    if (!tooltip.visible || !tooltipRef.current || !containerRef.current)
      return;

    const tooltipEl = tooltipRef.current;
    const containerEl = containerRef.current;
    const tooltipRect = tooltipEl.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();

    let adjustedX = tooltip.x + 10;
    let adjustedY = tooltip.y;

    if (adjustedX + tooltipRect.width > containerRect.width) {
      adjustedX = tooltip.x - tooltipRect.width - 10;
    }

    if (adjustedX < 0) {
      adjustedX = 10;
    }

    if (adjustedY + tooltipRect.height / 2 > containerRect.height) {
      adjustedY = containerRect.height - tooltipRect.height / 2;
    }

    if (adjustedY - tooltipRect.height / 2 < 0) {
      adjustedY = tooltipRect.height / 2;
    }

    if (
      Math.abs(adjustedX - 10 - tooltip.x) > 0.5 ||
      Math.abs(adjustedY - tooltip.y) > 0.5
    ) {
      setTooltip((prev) => ({
        ...prev,
        x: adjustedX - 10,
        y: adjustedY,
      }));
    }
  }, [tooltip.visible, tooltip.x, tooltip.y]);

  useEffect(() => {
    if (!svgRef.current) return;

    const dark = themeRef.current === 'dark';
    const ink = dark ? 'var(--hypha-text)' : 'var(--hypha-ink)';
    const paper = dark ? 'var(--hypha-ink)' : 'var(--hypha-paper)';
    // Opaque mix of the same hairline. A translucent stroke darkens where
    // the ring's ends meet; on the diagram ground this is the same colour.
    const hairline = dark
      ? 'color-mix(in srgb, var(--hypha-text) 38%, var(--hypha-ink))'
      : 'color-mix(in srgb, var(--hypha-ink) 34%, var(--hypha-paper))';
    const spaceAccent = 'var(--space-accent, var(--color-accent-9))';
    const getDiagramFillColor = () => paper;
    const getLabelFillColor = () => ink;
    const getLabelStrokeColor = () => paper;
    const getLogoRingColor = () => hairline;
    const ORBIT_STROKE_WIDTH = 1.15;

    const getStrokeWidth = (depth: number): number => {
      return (
        VISUALIZATION_CONFIG.LOGO_STROKE_WIDTH *
        Math.pow(VISUALIZATION_CONFIG.STROKE_WIDTH_SCALE, depth)
      );
    };

    const root = d3.hierarchy<SpaceNode>(data) as SpaceHierarchyNode;

    root.each((d) => {
      (d as SpaceHierarchyNode).r =
        VISUALIZATION_CONFIG.BASE_RADIUS *
        Math.pow(VISUALIZATION_CONFIG.DEPTH_SCALE, d.depth);
    });

    root.x = 0;
    root.y = 0;

    root.eachBefore((d) => {
      if (!d.children || d.children.length === 0) return;

      const node = d as SpaceHierarchyNode;
      const parentLogoRadius = node.r! * VISUALIZATION_CONFIG.LOGO_RATIO;
      const parentStrokeWidth = getStrokeWidth(node.depth);
      const parentLogoRadiusWithStroke =
        parentLogoRadius + parentStrokeWidth / 2;
      const children = d.children.map((child) => child as SpaceHierarchyNode);
      const n = children.length;

      const calculateMinOrbitRadius = (
        childRadii: number[],
        childNodes: SpaceHierarchyNode[],
      ): number => {
        let maxChildRadiusWithStroke = 0;
        childRadii.forEach((radius, index) => {
          const childNode = childNodes[index];
          if (childNode) {
            const childStrokeWidth = getStrokeWidth(childNode.depth);
            const childRadiusWithStroke = radius + childStrokeWidth / 2;
            maxChildRadiusWithStroke = Math.max(
              maxChildRadiusWithStroke,
              childRadiusWithStroke,
            );
          }
        });
        const baseMinOrbitRadius =
          parentLogoRadiusWithStroke + maxChildRadiusWithStroke;

        if (n <= 1) {
          return baseMinOrbitRadius;
        }

        const minOrbitRadiusForSpacing =
          maxChildRadiusWithStroke / Math.sin(Math.PI / n);

        return Math.max(baseMinOrbitRadius, minOrbitRadiusForSpacing);
      };

      children.forEach((childNode) => {
        const childStrokeWidth = getStrokeWidth(childNode.depth);
        const childRadiusWithStroke = childNode.r! + childStrokeWidth / 2;
        const minOrbitRadius =
          parentLogoRadiusWithStroke + childRadiusWithStroke;
        const maxOrbit = node.r! - childNode.r!;

        if (minOrbitRadius > maxOrbit) {
          childNode.r = clampSvgLength(
            (node.r! - parentLogoRadiusWithStroke) / 2,
          );
        }
      });

      const childRadii = children.map((c) => c.r!);
      let minOrbitRadius = calculateMinOrbitRadius(childRadii, children);
      let maxOrbit = node.r! - Math.max(...childRadii);

      if (minOrbitRadius > maxOrbit) {
        let minChildRadius = 0;
        let maxChildRadius = Math.max(...childRadii);
        let bestChildRadius = maxChildRadius;
        const tolerance = 0.1;

        while (maxChildRadius - minChildRadius > tolerance) {
          const testChildRadius = (minChildRadius + maxChildRadius) / 2;
          const testRadii = children.map(() => testChildRadius);
          const testMinOrbitRadius = calculateMinOrbitRadius(
            testRadii,
            children,
          );
          const testMaxOrbit = node.r! - testChildRadius;

          if (testMinOrbitRadius <= testMaxOrbit) {
            bestChildRadius = testChildRadius;
            minChildRadius = testChildRadius;
          } else {
            maxChildRadius = testChildRadius;
          }
        }

        children.forEach((childNode) => {
          childNode.r = clampSvgLength(bestChildRadius);
        });

        const adjustedRadii = children.map((c) => c.r!);
        minOrbitRadius = calculateMinOrbitRadius(adjustedRadii, children);
      }

      const maxChildRadius = Math.max(...children.map((c) => c.r!));
      maxOrbit = node.r! - maxChildRadius;

      const availableOrbit = Math.max(0, maxOrbit - minOrbitRadius);
      let orbitRadius =
        minOrbitRadius + availableOrbit * VISUALIZATION_CONFIG.ORBIT_RATIO;

      if (n > 1) {
        const minDistanceBetweenCenters =
          2 * orbitRadius * Math.sin(Math.PI / n);
        const requiredDistance = 2 * maxChildRadius;

        if (minDistanceBetweenCenters < requiredDistance) {
          let maxChildRadiusWithStroke = 0;
          children.forEach((childNode) => {
            const childStrokeWidth = getStrokeWidth(childNode.depth);
            const childRadiusWithStroke = childNode.r! + childStrokeWidth / 2;
            maxChildRadiusWithStroke = Math.max(
              maxChildRadiusWithStroke,
              childRadiusWithStroke,
            );
          });
          const safeOrbitRadius =
            maxChildRadiusWithStroke / Math.sin(Math.PI / n);
          orbitRadius = Math.max(
            safeOrbitRadius,
            parentLogoRadiusWithStroke + maxChildRadiusWithStroke,
            orbitRadius,
          );
        }
      }

      const step = (2 * Math.PI) / n;
      const safeOrbitRadius = Number.isFinite(orbitRadius)
        ? Math.max(minOrbitRadius, orbitRadius)
        : minOrbitRadius;
      children.forEach((childNode, i) => {
        const angle = i * step;
        const parentX = finiteOr(d.x, 0);
        const parentY = finiteOr(d.y, 0);
        childNode.x = parentX + Math.cos(angle) * safeOrbitRadius;
        childNode.y = parentY + Math.sin(angle) * safeOrbitRadius;
      });
    });

    sanitizeHierarchyLayout(root);

    const findNodeById = (
      node: SpaceHierarchyNode,
      id: number,
    ): SpaceHierarchyNode | null => {
      if (node.data.id === id) {
        return node;
      }
      if (node.children) {
        for (const child of node.children) {
          const found = findNodeById(child as SpaceHierarchyNode, id);
          if (found) return found;
        }
      }
      return null;
    };

    // Open on the space the user is viewing so membership modules (individuals /
    // spaces / agents) match that space's Members tab. Drill-in focus is
    // remembered across re-renders; zoom out still reaches the org root.
    let focus = root;
    if (typeof currentSpaceId === 'number') {
      const currentNode = findNodeById(root, currentSpaceId);
      if (currentNode) {
        focus = currentNode;
      }
    }

    if (savedFocusIdRef.current) {
      const savedNode = findNodeById(root, savedFocusIdRef.current);
      if (savedNode) {
        focus = savedNode;
      } else {
        savedFocusIdRef.current = null;
      }
    }

    focusRef.current = focus;
    savedFocusIdRef.current = focus.data.id;

    const readStageSize = (): { width: number; height: number } | null => {
      const el = containerRef.current;
      const rect = el?.getBoundingClientRect();
      if (!rect || rect.width < 2 || rect.height < 2) return null;
      return { width: rect.width, height: rect.height };
    };

    const svg = d3
      .select(svgRef.current)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('shape-rendering', 'auto')
      .style('cursor', 'pointer');

    svg.selectAll('*').remove();

    const g = svg.append('g');

    const defs = svg.append('defs');
    const orbits = g
      .selectAll<SVGPathElement, SpaceHierarchyNode>('path.orbit')
      .data(root.descendants() as SpaceHierarchyNode[])
      .join('path')
      .attr('class', 'orbit')
      .attr('fill', 'none')
      .attr('stroke', hairline)
      .attr('stroke-width', ORBIT_STROKE_WIDTH)
      .attr('stroke-linecap', 'butt')
      .attr('stroke-linejoin', 'round')
      .attr('vector-effect', 'non-scaling-stroke')
      .attr('shape-rendering', 'auto')
      .style('pointer-events', 'all')
      .on('click', (event, d) => {
        if (focus !== d) {
          event.stopPropagation();
          zoom(d);
        }
      });

    const logos = g
      .selectAll<SVGGElement, SpaceHierarchyNode>('g.logo')
      .data(root.descendants() as SpaceHierarchyNode[])
      .join('g')
      .attr('class', 'logo')
      .style('pointer-events', 'all')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        if (focus !== d) {
          event.stopPropagation();
          zoom(d);
        }
      });

    if (enableHoverActions) {
      logos
        .on('mouseenter', function (event: MouseEvent, d: SpaceHierarchyNode) {
          clearTooltipHideTimeout();
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          setTooltip((prev) => ({
            ...prev,
            visible: true,
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            text: d.data.name,
            spaceId: d.data.id,
            spaceSlug: d.data.slug,
          }));
        })
        .on('mousemove', function (event: MouseEvent) {
          clearTooltipHideTimeout();
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          setTooltip((prev) => ({
            ...prev,
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          }));
        })
        .on('mouseleave', function () {
          scheduleTooltipHide();
        });
    } else {
      logos.on('mouseenter', null).on('mousemove', null).on('mouseleave', null);
    }

    logos.each(function (d: SpaceHierarchyNode) {
      const logoGroup = d3.select(this);
      const clipId = `clip-${d.data.id}`;

      const clipPath = defs.append('clipPath').attr('id', clipId);

      clipPath.append('circle').attr('r', 1);

      logoGroup
        .append('circle')
        .attr('class', 'logo-disk')
        .attr('fill', getDiagramFillColor())
        .attr('stroke', 'none')
        .attr('shape-rendering', 'geometricPrecision');

      logoGroup
        .append('image')
        .attr('href', d.data.logoUrl || DEFAULT_SPACE_AVATAR_IMAGE)
        .attr('preserveAspectRatio', 'xMidYMid slice')
        .attr('alt', `${d.data.name} logo`)
        .attr('clip-path', `url(#${clipId})`);

      logoGroup
        .append('path')
        .attr('class', 'logo-ring')
        .attr('fill', 'none')
        .attr('stroke', getLogoRingColor())
        .attr('stroke-width', 1.25)
        .attr('stroke-linecap', 'butt')
        .attr('stroke-linejoin', 'round')
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('shape-rendering', 'auto')
        .style('pointer-events', 'none');

      logoGroup
        .append('path')
        .attr('class', 'focus-ring')
        .attr('fill', 'none')
        .attr('stroke', ink)
        .attr('stroke-width', 1.15)
        .attr('stroke-linecap', 'butt')
        .attr('stroke-linejoin', 'round')
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('shape-rendering', 'auto')
        .attr('opacity', 0)
        .style('pointer-events', 'none');

      logoGroup
        .append('path')
        .attr('class', 'current-ring')
        .attr('fill', 'none')
        .attr('stroke', spaceAccent)
        .attr('stroke-width', 1.25)
        .attr('stroke-linecap', 'butt')
        .attr('stroke-linejoin', 'round')
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('shape-rendering', 'auto')
        .attr('opacity', 0)
        .style('pointer-events', 'none');

      if (showNodeLabels) {
        logoGroup
          .append('text')
          .attr('class', 'node-label')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'hanging')
          .attr('fill', getLabelFillColor())
          .attr('stroke', getLabelStrokeColor())
          .attr('stroke-width', 1.25)
          .attr('paint-order', 'stroke fill')
          .style('font-family', 'var(--font-family-text), sans-serif')
          .style('font-weight', '500')
          .style('letter-spacing', '-0.01em')
          .style('pointer-events', 'none')
          .text(truncateLabel(d.data.name));
      }

      logoGroup.append('title').text(d.data.name);
    });

    svg.on('click', () => {
      if (focus.parent) {
        zoom(focus.parent);
      }
    });

    function isDescendantOf(
      node: SpaceHierarchyNode,
      ancestor: SpaceHierarchyNode,
    ): boolean {
      let current = node.parent;
      while (current) {
        if (current === ancestor) return true;
        current = current.parent;
      }
      return false;
    }

    function isDescendantOfOrSelf(
      node: SpaceHierarchyNode,
      ancestor: SpaceHierarchyNode,
    ): boolean {
      if (node === ancestor) return true;

      let current = node.parent;
      while (current) {
        if (current === ancestor) return true;
        current = current.parent;
      }
      return false;
    }

    function isAncestorOf(
      ancestor: SpaceHierarchyNode,
      node: SpaceHierarchyNode,
    ): boolean {
      let current = node.parent;
      while (current) {
        if (current === ancestor) return true;
        current = current.parent;
      }
      return false;
    }

    function isVisibleForFocus(
      d: SpaceHierarchyNode,
      focusNode: SpaceHierarchyNode,
    ): boolean {
      if (d === focusNode) return true;

      if (isDescendantOfOrSelf(d, focusNode)) {
        return true;
      }

      if (isAncestorOf(d, focusNode)) {
        return true;
      }

      let currentAncestor = focusNode.parent;
      while (currentAncestor) {
        if (isDescendantOfOrSelf(d, currentAncestor)) {
          return true;
        }
        currentAncestor = currentAncestor.parent;
      }

      return false;
    }

    function isVisible(d: SpaceHierarchyNode): boolean {
      if (!focus) return false;
      return isVisibleForFocus(d, focus);
    }

    function getVisibleSpaces(focusNode: SpaceHierarchyNode): VisibleSpace[] {
      const visibleSpaces: VisibleSpace[] = [
        {
          id: focusNode.data.id,
          name: focusNode.data.name,
          slug: focusNode.data.slug,
          logoUrl: focusNode.data.logoUrl,
          parentId: focusNode.parent?.data.id ?? null,
          root: true,
        },
      ];

      function collectDescendants(node: SpaceHierarchyNode) {
        if (node.children) {
          node.children.forEach((child) => {
            visibleSpaces.push({
              id: child.data.id,
              name: child.data.name,
              slug: child.data.slug,
              logoUrl: child.data.logoUrl,
              parentId: child.parent?.data.id ?? null,
              root: false,
            });
            collectDescendants(child as SpaceHierarchyNode);
          });
        }
      }

      collectDescendants(focusNode);

      return visibleSpaces;
    }

    function notifyVisibleSpaces(focusNode: SpaceHierarchyNode) {
      const callback = onVisibleSpacesChangeRef.current;
      if (callback) {
        const visibleSpaces = getVisibleSpaces(focusNode);
        const spacesKey = JSON.stringify(visibleSpaces.map((s) => s.id).sort());
        if (previousVisibleSpacesRef.current !== spacesKey) {
          previousVisibleSpacesRef.current = spacesKey;
          callback(visibleSpaces);
        }
      }
    }

    orbits.style('opacity', (d: SpaceHierarchyNode) => (isVisible(d) ? 1 : 0));
    logos.style('opacity', (d: SpaceHierarchyNode) => (isVisible(d) ? 1 : 0));
    orbits.style('display', (d: SpaceHierarchyNode) =>
      isVisible(d) ? 'block' : 'none',
    );
    logos.style('display', (d: SpaceHierarchyNode) =>
      isVisible(d) ? 'block' : 'none',
    );

    logos.each(function () {
      d3.select(this)
        .select('circle.logo-disk')
        .attr('fill', getDiagramFillColor())
        .attr('stroke', 'none');
    });

    const initialSize = readStageSize();
    let frame = initialSize
      ? solveClusterFrame(
          focus,
          initialSize.width,
          initialSize.height,
          showNodeLabels,
          currentSpaceId,
        )
      : frameFromBounds(
          clusterBounds(focus, 1, showNodeLabels, currentSpaceId),
        );
    if (initialSize) applyFrame(frame);
    previousVisibleSpacesRef.current = '';
    notifyVisibleSpaces(focus);

    function zoom(
      target: SpaceHierarchyNode,
      options?: {
        onEnd?: () => void;
      },
    ) {
      focus = target;
      focusRef.current = focus;
      savedFocusIdRef.current = focus.data.id;

      const size = readStageSize();
      if (!size) return;
      const nextFrame = solveClusterFrame(
        focus,
        size.width,
        size.height,
        showNodeLabels,
        currentSpaceId,
      );
      const startFrame = frame;

      const transition = svg
        .transition()
        .duration(VISUALIZATION_CONFIG.ZOOM_DURATION)
        .tween('zoom', () => {
          return (t) => {
            const eased = d3.easeCubicInOut(t);
            frame = {
              cx: startFrame.cx + (nextFrame.cx - startFrame.cx) * eased,
              cy: startFrame.cy + (nextFrame.cy - startFrame.cy) * eased,
              width: Math.max(
                startFrame.width + (nextFrame.width - startFrame.width) * eased,
                1,
              ),
              height: Math.max(
                startFrame.height +
                  (nextFrame.height - startFrame.height) * eased,
                1,
              ),
            };
            applyFrame(frame);
          };
        });

      transition
        .selectAll<SVGElement, SpaceHierarchyNode>('path.orbit, g.logo')
        .style('opacity', (d: SpaceHierarchyNode) => (isVisible(d) ? 1 : 0))
        .on('start', function (d: SpaceHierarchyNode) {
          if (isVisible(d) && this instanceof SVGElement) {
            (this as SVGElement).style.display = 'block';
          }
        })
        .on('end', function (d: SpaceHierarchyNode) {
          if (!isVisible(d) && this instanceof SVGElement) {
            (this as SVGElement).style.display = 'none';
          }
        });

      logos.each(function () {
        d3.select(this)
          .select('circle.logo-disk')
          .transition()
          .duration(VISUALIZATION_CONFIG.ZOOM_DURATION)
          .attr('fill', getDiagramFillColor())
          .attr('stroke', 'none');
      });

      transition.on('end', () => {
        notifyVisibleSpaces(focus);
        options?.onEnd?.();
      });
    }

    const zoomByDirection = (direction: 1 | -1) => {
      const current = focusRef.current as SpaceHierarchyNode | null;
      if (!current) return;
      if (direction < 0) {
        if (current.parent) zoom(current.parent as SpaceHierarchyNode);
        return;
      }
      const children = (current.children ?? []) as SpaceHierarchyNode[];
      if (children.length === 0) return;
      const next = children.reduce((largest, child) =>
        (child.r ?? 0) > (largest.r ?? 0) ? child : largest,
      );
      zoom(next);
    };

    if (zoomApiRef) {
      zoomApiRef.current = {
        zoomIn: () => zoomByDirection(1),
        zoomOut: () => zoomByDirection(-1),
      };
    }

    function applyFrame(next: ClusterFrame) {
      const size = readStageSize();
      if (!size) return;
      const { width: viewWidth, height: viewHeight } = size;
      // 1:1 with the stage. The cluster is placed in this box, so a tall stage
      // is usable instead of letterboxing a square view.
      svg.attr(
        'viewBox',
        `${-viewWidth / 2} ${-viewHeight / 2} ${viewWidth} ${viewHeight}`,
      );
      const k = fitScale(next, viewWidth, viewHeight);

      const nodeTransform = (d: SpaceHierarchyNode) => {
        const tx = (finiteOr(d.x, 0) - next.cx) * k;
        const ty = (finiteOr(d.y, 0) - next.cy) * k;
        return `translate(${tx}, ${ty})`;
      };

      orbits
        .attr('transform', nodeTransform)
        .attr('d', (d: SpaceHierarchyNode) =>
          smoothClosedCirclePath(finiteOr(d.r, 0) * k),
        )
        .attr('fill', 'none')
        .attr('stroke', hairline)
        .attr('stroke-width', ORBIT_STROKE_WIDTH)
        .attr('stroke-linecap', 'butt')
        .attr('stroke-linejoin', 'round');

      logos
        .attr('transform', nodeTransform)
        .each(function (d: SpaceHierarchyNode) {
          const r = clampSvgLength(
            finiteOr(d.r, 0) * k * VISUALIZATION_CONFIG.LOGO_RATIO,
          );
          const clipId = `clip-${d.data.id}`;
          const diameter = clampSvgLength(r * 2);
          const isFocused = d === focus;
          const isCurrent =
            typeof currentSpaceId === 'number' && d.data.id === currentSpaceId;
          // Hanging baseline: y is the top of the glyphs. Clear the disk,
          // the accent or focus ring, and the hairline before the gap.
          const { labelFontSize, labelTop: labelY } = labelMetrics(
            r,
            isCurrent,
            isFocused,
          );
          const selection = d3.select(this);

          selection
            .select('circle.logo-disk')
            .attr('r', r)
            .attr('fill', getDiagramFillColor())
            .attr('stroke', 'none');

          defs.select(`#${clipId} circle`).attr('r', r);

          selection
            .select('image')
            .attr('x', -r)
            .attr('y', -r)
            .attr('width', diameter)
            .attr('height', diameter);

          selection
            .select('path.logo-ring')
            .attr('d', smoothClosedCirclePath(r))
            .attr('stroke', getLogoRingColor())
            .attr('stroke-width', isFocused ? 1.5 : 1.15);

          selection
            .select('path.focus-ring')
            .attr(
              'd',
              smoothClosedCirclePath(
                clampSvgLength(r + Math.max(3.5, r * 0.12)),
              ),
            )
            .attr('stroke', ink)
            .attr('opacity', isFocused && !isCurrent ? 0.9 : 0);

          selection
            .select('path.current-ring')
            .attr(
              'd',
              smoothClosedCirclePath(clampSvgLength(r + Math.max(4, r * 0.14))),
            )
            .attr('stroke', spaceAccent)
            .attr('opacity', isCurrent ? 1 : 0);

          if (showNodeLabels) {
            selection
              .select('text.node-label')
              .attr('y', labelY)
              .attr('font-size', `${labelFontSize}px`)
              .attr('fill', getLabelFillColor())
              .attr('stroke', getLabelStrokeColor())
              .attr('opacity', showNodeLabels && isVisible(d) ? 1 : 0)
              .text(truncateLabel(d.data.name));
          }
        });
    }

    let fittedKey = initialSize
      ? `${Math.round(initialSize.width)}x${Math.round(initialSize.height)}`
      : '';
    const stageObserver = new ResizeObserver(() => {
      const size = readStageSize();
      if (!size) return;
      const key = `${Math.round(size.width)}x${Math.round(size.height)}`;
      if (key === fittedKey) return;
      fittedKey = key;
      frame = solveClusterFrame(
        focus,
        size.width,
        size.height,
        showNodeLabels,
        currentSpaceId,
      );
      applyFrame(frame);
    });
    if (containerRef.current) stageObserver.observe(containerRef.current);

    return () => {
      stageObserver.disconnect();
      svg.interrupt();
      if (zoomApiRef) {
        zoomApiRef.current = { zoomIn: () => {}, zoomOut: () => {} };
      }
    };
  }, [data, currentSpaceId, resolvedTheme, enableHoverActions, showNodeLabels]);

  useEffect(() => {
    return () => {
      clearTooltipHideTimeout();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn('relative aspect-square w-full overflow-hidden', className)}
    >
      <svg
        ref={svgRef}
        className="absolute inset-0 block h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={ariaLabel}
      />
      {enableHoverActions && tooltip.visible && (
        <div
          ref={tooltipRef}
          onMouseEnter={clearTooltipHideTimeout}
          onMouseLeave={scheduleTooltipHide}
          className="absolute z-50 rounded-none border border-border/70 bg-background px-2.5 py-1.5 shadow-none"
          style={{
            left: `${tooltip.x + 10}px`,
            top: `${tooltip.y + 10}px`,
            transform: 'translate(0, -50%)',
          }}
        >
          <div className="max-w-[14rem] truncate text-1 font-medium text-foreground">
            {tooltip.text}
          </div>
        </div>
      )}
    </div>
  );
}

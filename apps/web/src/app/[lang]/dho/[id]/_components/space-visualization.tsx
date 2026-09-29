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
  /**
   * `square` sizes from the column width. `fill` stretches to the positioned
   * stage so a tall slot is the drawing box, not empty space under a square.
   */
  layout?: 'square' | 'fill';
  /** Stage fill. Default is a square that sizes from width. */
  className?: string;
};

const VISUALIZATION_CONFIG = {
  BASE_RADIUS: 420,
  DEPTH_SCALE: 0.45,
  /** Center mark inside an enclosure, small enough that child rings fit around it. */
  ENCLOSURE_LOGO_RATIO: 0.22,
  /** Leaf mark inside its own ring: narrow gap inside the stroke, ring stays visible. */
  LEAF_LOGO_RATIO: 0.84,
  ZOOM_DURATION: 720,
  /**
   * One caption size. Scaling with the logo pushed the center name down
   * into the child ring, where it no longer read as centered under the mark.
   */
  LABEL_FONT: 11,
  /** Gap between the node shape and the top of the name. */
  LABEL_GAP: 8,
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
 * One continuous ring. Butt caps on a seam leave a gap, and `Z` leaves a
 * corner. The join sits on the right (3 o'clock), so the bottom of the
 * circle is the middle of an arc, not a seam. Three steps under 180° draw
 * the turn, then a longer arc continues past the start along the same
 * tangent so the caps overlap on the stroke.
 */
function smoothClosedCirclePath(radius: number): string {
  const r = clampSvgLength(radius);
  if (r <= 0) return '';
  // Long enough that the overlapping caps cover the join even when the
  // stroke is clipped to a device pixel. Capped so the extra arc stays
  // well under 180°.
  const overlap = Math.min(Math.max(24, r * 0.1), r * 0.28);
  const theta = overlap / r;
  const n = (value: number) => value.toFixed(3);
  const point = (angle: number) => {
    const x = r * Math.cos(angle);
    const y = r * Math.sin(angle);
    return `${n(x)} ${n(y)}`;
  };
  // Sweep-flag 1 follows increasing angle (clockwise in SVG, y downward).
  // Each step stays under 180° so the large-arc flag cannot flip it.
  const arc = (angle: number) => `A ${n(r)} ${n(r)} 0 0 1 ${point(angle)}`;
  const start = -theta;
  return [
    `M ${point(start)}`,
    arc(start + (2 * Math.PI) / 3),
    arc(start + (4 * Math.PI) / 3),
    arc(start + 2 * Math.PI),
    arc(start + 2 * Math.PI + 2 * theta),
  ].join(' ');
}

function finiteOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? (value as number) : fallback;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function stageSizeKey(size: { width: number; height: number }): string {
  return `${Math.round(size.width)}x${Math.round(size.height)}`;
}

/**
 * Screen inset so the bottom of a ring — where the curve is flattest — is
 * not shaved off by the stage. A 12px pad left that curve on the clip edge,
 * so the two sides stopped short of each other above the footer.
 */
const CLUSTER_FIT_PADDING = 36;

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

function logoRatio(node: { children?: readonly unknown[] }): number {
  return node.children && node.children.length > 0
    ? VISUALIZATION_CONFIG.ENCLOSURE_LOGO_RATIO
    : VISUALIZATION_CONFIG.LEAF_LOGO_RATIO;
}

/**
 * Child rings rest inside the parent ring, on one shared orbit, clear of the
 * name under the center mark. They read as one cluster instead of discs
 * pasted onto a frame.
 */
function placeChildRings(node: SpaceHierarchyNode): void {
  const children = (node.children ?? []) as SpaceHierarchyNode[];
  const n = children.length;
  if (n === 0) return;

  const parentR = Math.max(finiteOr(node.r, 1), 1);
  const inner = parentR * 0.97;
  const centerClear =
    parentR * VISUALIZATION_CONFIG.ENCLOSURE_LOGO_RATIO + parentR * 0.16;

  let childR = parentR * VISUALIZATION_CONFIG.DEPTH_SCALE;
  if (n === 1) {
    childR = Math.min(childR, (inner - centerClear) / 2);
  } else {
    const sin = Math.sin(Math.PI / n);
    const insideParent = (inner - centerClear) / 2;
    const separated = inner / (1 + 1.12 / sin);
    childR = Math.min(childR, insideParent, separated);
  }
  childR = clampSvgLength(Math.max(childR, 1));

  let orbit = inner - childR;
  if (orbit < centerClear + childR) {
    childR = clampSvgLength(Math.max((inner - centerClear) / 2, 1));
    orbit = inner - childR;
  }

  const parentX = finiteOr(node.x, 0);
  const parentY = finiteOr(node.y, 0);
  const step = (2 * Math.PI) / n;
  children.forEach((child, index) => {
    child.r = childR;
    const angle = -Math.PI / 2 + index * step;
    child.x = parentX + Math.cos(angle) * orbit;
    child.y = parentY + Math.sin(angle) * orbit;
  });
}

function nodeShapeRadius(d: SpaceHierarchyNode, k: number): number {
  const hasChildren = Boolean(d.children && d.children.length > 0);
  const r = finiteOr(d.r, 0) * k;
  return hasChildren ? r * logoRatio(d) : r;
}

function nodeLabelTop(d: SpaceHierarchyNode, k: number): number {
  return nodeShapeRadius(d, k) + VISUALIZATION_CONFIG.LABEL_GAP;
}

/**
 * Size the filled disc to the cluster already on its rim. A previous pass's
 * radius is not a floor — that ratcheted the fill outward and left the logos
 * in the middle. Leaf names add a little air; an intermediate caption is
 * hidden, so it must not inflate the disc.
 */
function growRingAroundLabels(node: SpaceHierarchyNode, scale: number): void {
  const children = (node.children ?? []) as SpaceHierarchyNode[];
  for (const child of children) {
    growRingAroundLabels(child, scale);
  }
  if (children.length === 0) return;

  const safeScale = Math.max(scale, 0.0001);
  const pad = 8 / safeScale;
  const parentX = finiteOr(node.x, 0);
  const parentY = finiteOr(node.y, 0);
  let needed = 1;
  for (const child of children) {
    const dx = finiteOr(child.x, 0) - parentX;
    const dy = finiteOr(child.y, 0) - parentY;
    const childEdge = Math.hypot(dx, dy) + finiteOr(child.r, 0);
    needed = Math.max(needed, childEdge + pad);
    if (child.children && child.children.length > 0) continue;
    const top = nodeLabelTop(child, safeScale);
    const { labelFontSize } = labelMetrics(nodeShapeRadius(child, safeScale));
    const bottom = (top + labelFontSize * 1.35) / safeScale;
    const half =
      estimateLabelHalfWidth(child.data.name, labelFontSize) / safeScale;
    needed = Math.max(
      needed,
      Math.hypot(dx - half, dy + bottom) + pad,
      Math.hypot(dx + half, dy + bottom) + pad,
    );
  }
  node.r = needed;
}

function labelMetrics(screenShapeRadius: number): LabelMetrics {
  const labelFontSize = VISUALIZATION_CONFIG.LABEL_FONT;
  const labelTop = screenShapeRadius + VISUALIZATION_CONFIG.LABEL_GAP;
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
    const top = nodeLabelTop(d, safeScale);
    const { labelFontSize } = labelMetrics(nodeShapeRadius(d, safeScale));
    const half = estimateLabelHalfWidth(d.data.name, labelFontSize) / safeScale;
    const bottom = y + (top + labelFontSize * 1.35) / safeScale;
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

/** Phones keep a tight inset so the disc fills the column. */
function clusterFitPadding(viewWidth: number): number {
  return viewWidth < 768 ? 8 : CLUSTER_FIT_PADDING;
}

function fitScale(
  frame: ClusterFrame,
  viewWidth: number,
  viewHeight: number,
): number {
  const pad = clusterFitPadding(viewWidth);
  const innerW = Math.max(viewWidth - pad * 2, 1);
  const innerH = Math.max(viewHeight - pad * 2, 1);
  return Math.min(innerW / frame.width, innerH / frame.height);
}

type ScreenSpan = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** Circles and the names under them, in viewBox pixels around the frame center. */
function screenSpan(
  nodes: SpaceHierarchyNode[],
  cx: number,
  cy: number,
  scale: number,
  showLabels: boolean,
): ScreenSpan {
  const span: ScreenSpan = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  const strokePad = 1;
  for (const d of nodes) {
    const x = (finiteOr(d.x, 0) - cx) * scale;
    const y = (finiteOr(d.y, 0) - cy) * scale;
    const rad = finiteOr(d.r, 0) * scale + strokePad;
    includePoint(span, x - rad, y - rad);
    includePoint(span, x + rad, y + rad);
    if (!showLabels) continue;
    const top = nodeLabelTop(d, scale);
    const { labelFontSize } = labelMetrics(nodeShapeRadius(d, scale));
    const half = estimateLabelHalfWidth(d.data.name, labelFontSize);
    includePoint(span, x - half, y);
    includePoint(span, x + half, y + top + labelFontSize * 1.35);
  }
  if (!Number.isFinite(span.minX)) {
    includePoint(span, -1, -1);
    includePoint(span, 1, 1);
  }
  return span;
}

/**
 * Shrink `scale` until every focused ring and its name sits inside the
 * stage inset. The flat bottom of a circle is the first thing a clip cuts,
 * and that reads as a broken stroke.
 */
function containScale(
  nodes: SpaceHierarchyNode[],
  cx: number,
  cy: number,
  viewWidth: number,
  viewHeight: number,
  scale: number,
  showLabels: boolean,
): number {
  const pad = clusterFitPadding(viewWidth);
  const limitX = Math.max(viewWidth / 2 - pad, 1);
  const limitY = Math.max(viewHeight / 2 - pad, 1);
  let k = Math.max(scale, 0.0001);
  for (let pass = 0; pass < 4; pass += 1) {
    const span = screenSpan(nodes, cx, cy, k, showLabels);
    const fit = Math.min(
      limitX / Math.max(Math.abs(span.minX), Math.abs(span.maxX), 1),
      limitY / Math.max(Math.abs(span.minY), Math.abs(span.maxY), 1),
      1,
    );
    if (fit > 0.995) break;
    k *= fit;
  }
  return k;
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
): ClusterFrame {
  const diameter = Math.max(finiteOr(focus.r, 1) * 2, 1);
  let scale =
    Math.min(Math.max(viewWidth, 1), Math.max(viewHeight, 1)) / diameter;
  let frame = frameFromBounds(clusterBounds(focus, scale, showLabels));
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const nextScale = fitScale(frame, viewWidth, viewHeight);
    const nextFrame = frameFromBounds(
      clusterBounds(focus, nextScale, showLabels),
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
  layout = 'square',
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
      ? 'color-mix(in srgb, var(--hypha-text) 32%, var(--hypha-ink))'
      : 'color-mix(in srgb, var(--hypha-ink) 26%, var(--hypha-paper))';
    const spaceAccent = 'var(--space-accent, var(--color-accent-9))';
    const getDiagramFillColor = () => paper;
    const getLabelFillColor = () => ink;
    const getLabelStrokeColor = () => paper;
    // One hairline for every ring. The current space is the same weight in
    // the space accent — not a heavier frame, and not a stroke on the icon.
    const HAIRLINE = 1;

    const root = d3.hierarchy<SpaceNode>(data) as SpaceHierarchyNode;

    root.r = VISUALIZATION_CONFIG.BASE_RADIUS;
    root.x = 0;
    root.y = 0;
    root.eachBefore((d) => {
      placeChildRings(d as SpaceHierarchyNode);
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
      .attr('stroke-width', HAIRLINE)
      .attr('stroke-linecap', 'butt')
      .attr('stroke-linejoin', 'round')
      .attr('vector-effect', 'non-scaling-stroke')
      .attr('shape-rendering', 'geometricPrecision')
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
        .attr('aria-hidden', 'true')
        .attr('clip-path', `url(#${clipId})`);
    });

    // Names paint after every ring. A child circle otherwise covers the
    // center caption, so the visible part no longer sits under the mark.
    const labelText = g
      .append('g')
      .attr('class', 'node-labels')
      .style('pointer-events', 'none')
      .selectAll<SVGTextElement, SpaceHierarchyNode>('text.node-label')
      .data(showNodeLabels ? (root.descendants() as SpaceHierarchyNode[]) : [])
      .join('text')
      .attr('class', 'node-label')
      .attr('x', 0)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'hanging')
      .attr('fill', getLabelFillColor())
      .attr('stroke', getLabelStrokeColor())
      .attr('stroke-width', 4)
      .attr('stroke-linejoin', 'round')
      .attr('paint-order', 'stroke fill')
      .style('font-family', 'var(--font-family-text), sans-serif')
      .style('font-weight', '500')
      .style('letter-spacing', '-0.01em')
      .style('text-anchor', 'middle')
      .text((d) => truncateLabel(d.data.name));

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

    function isVisibleForFocus(
      d: SpaceHierarchyNode,
      focusNode: SpaceHierarchyNode,
    ): boolean {
      if (d === focusNode) return true;

      // Ancestors stay out of the focused view. A parent ring passes just
      // outside its children, so leaving it visible after a zoom parks a
      // cropped logo on the edge of the stage.
      return isDescendantOfOrSelf(d, focusNode);
    }

    function isVisible(d: SpaceHierarchyNode): boolean {
      if (!focus) return false;
      return isVisibleForFocus(d, focus);
    }

    // An intermediate ring's caption lands on the level below it. The focused
    // node keeps its name; a second-level name stays off while N+2 is drawn.
    function isLabelShown(d: SpaceHierarchyNode): boolean {
      if (!isVisible(d)) return false;
      if (d !== focus && d.children && d.children.length > 0) return false;
      return true;
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
    labelText.style('opacity', (d: SpaceHierarchyNode) =>
      isLabelShown(d) ? 1 : 0,
    );
    orbits.style('display', (d: SpaceHierarchyNode) =>
      isVisible(d) ? 'block' : 'none',
    );
    logos.style('display', (d: SpaceHierarchyNode) =>
      isVisible(d) ? 'block' : 'none',
    );
    labelText.style('display', (d: SpaceHierarchyNode) =>
      isLabelShown(d) ? 'block' : 'none',
    );

    logos.each(function () {
      d3.select(this)
        .select('circle.logo-disk')
        .attr('fill', getDiagramFillColor())
        .attr('stroke', 'none');
    });

    if (showNodeLabels) {
      const stage = readStageSize();
      const span = Math.max(finiteOr(root.r, 1) * 2, 1);
      let scale = stage ? Math.min(stage.width, stage.height) / span : 1;
      for (let pass = 0; pass < 3; pass += 1) {
        growRingAroundLabels(root, scale);
        if (!stage) break;
        const next = solveClusterFrame(
          root,
          stage.width,
          stage.height,
          showNodeLabels,
        );
        scale = fitScale(next, stage.width, stage.height);
      }
    }

    const initialSize = readStageSize();
    let frame = initialSize
      ? solveClusterFrame(
          focus,
          initialSize.width,
          initialSize.height,
          showNodeLabels,
        )
      : frameFromBounds(clusterBounds(focus, 1, showNodeLabels));
    if (initialSize) applyFrame(frame);
    previousVisibleSpacesRef.current = '';
    notifyVisibleSpaces(focus);

    // One named transition for the cluster frame. A second ease inside the
    // tween stacks on d3's own easing and rushes the middle of the zoom.
    // Stage resizes share this name so they retarget the same motion
    // instead of snapping a new viewBox over it.
    const DIAGRAM_MOTION = 'diagram';
    let focusMotion = false;

    function framesMatch(a: ClusterFrame, b: ClusterFrame): boolean {
      return (
        Math.abs(a.cx - b.cx) < 0.5 &&
        Math.abs(a.cy - b.cy) < 0.5 &&
        Math.abs(a.width - b.width) < 0.5 &&
        Math.abs(a.height - b.height) < 0.5
      );
    }

    function commitFrame(next: ClusterFrame) {
      frame = next;
      applyFrame(frame);
    }

    /** Glide the cluster to `next`. Reduced motion jumps. */
    function glideFrame(next: ClusterFrame) {
      const duration = prefersReducedMotion()
        ? 0
        : VISUALIZATION_CONFIG.ZOOM_DURATION;
      if (duration === 0 || framesMatch(frame, next)) {
        svg.interrupt(DIAGRAM_MOTION);
        commitFrame(next);
        return;
      }
      const size = readStageSize();
      const startScale = size
        ? containScale(
            focus.descendants() as SpaceHierarchyNode[],
            frame.cx,
            frame.cy,
            size.width,
            size.height,
            fitScale(frame, size.width, size.height),
            showNodeLabels,
          )
        : null;
      const targetScale = size
        ? containScale(
            focus.descendants() as SpaceHierarchyNode[],
            next.cx,
            next.cy,
            size.width,
            size.height,
            fitScale(next, size.width, size.height),
            showNodeLabels,
          )
        : null;
      const startFrame = {
        cx: frame.cx,
        cy: frame.cy,
        width: frame.width,
        height: frame.height,
      };
      svg.interrupt(DIAGRAM_MOTION);
      svg
        .transition(DIAGRAM_MOTION)
        .duration(duration)
        .ease(d3.easeCubicInOut)
        .tween('frame', () => (t: number) => {
          frame = {
            cx: startFrame.cx + (next.cx - startFrame.cx) * t,
            cy: startFrame.cy + (next.cy - startFrame.cy) * t,
            width: Math.max(
              startFrame.width + (next.width - startFrame.width) * t,
              1,
            ),
            height: Math.max(
              startFrame.height + (next.height - startFrame.height) * t,
              1,
            ),
          };
          const currentScale =
            startScale != null && targetScale != null
              ? startScale + (targetScale - startScale) * t
              : undefined;
          applyFrame(frame, currentScale);
        });
    }

    function zoom(
      target: SpaceHierarchyNode,
      options?: {
        onEnd?: () => void;
      },
    ) {
      const size = readStageSize();
      if (!size) return;
      const sizeKeyAtStart = stageSizeKey(size);
      // Membership row height changes with the focused space and resizes the
      // stage. Reading that live size inside the tween jumps the viewBox.
      const lockedSize = { width: size.width, height: size.height };
      const startFocus = focus;
      const startScale = containScale(
        startFocus.descendants() as SpaceHierarchyNode[],
        frame.cx,
        frame.cy,
        size.width,
        size.height,
        fitScale(frame, size.width, size.height),
        showNodeLabels,
      );

      focus = target;
      focusRef.current = focus;
      savedFocusIdRef.current = focus.data.id;

      const nextFrame = solveClusterFrame(
        focus,
        size.width,
        size.height,
        showNodeLabels,
      );
      const targetScale = containScale(
        focus.descendants() as SpaceHierarchyNode[],
        nextFrame.cx,
        nextFrame.cy,
        size.width,
        size.height,
        fitScale(nextFrame, size.width, size.height),
        showNodeLabels,
      );

      const startFrame = frame;
      const duration = prefersReducedMotion()
        ? 0
        : VISUALIZATION_CONFIG.ZOOM_DURATION;
      focusMotion = duration > 0;

      const transition = svg
        .transition(DIAGRAM_MOTION)
        .duration(duration)
        .ease(d3.easeCubicInOut)
        .tween('zoom', () => {
          return (t) => {
            frame = {
              cx: startFrame.cx + (nextFrame.cx - startFrame.cx) * t,
              cy: startFrame.cy + (nextFrame.cy - startFrame.cy) * t,
              width: Math.max(
                startFrame.width + (nextFrame.width - startFrame.width) * t,
                1,
              ),
              height: Math.max(
                startFrame.height + (nextFrame.height - startFrame.height) * t,
                1,
              ),
            };
            const currentScale = startScale + (targetScale - startScale) * t;
            applyFrame(frame, currentScale, lockedSize);
          };
        });

      transition
        .selectAll<SVGElement, SpaceHierarchyNode>('path.orbit, g.logo')
        .style('opacity', (d: SpaceHierarchyNode) => (isVisible(d) ? 1 : 0))
        .on('start', function (d: SpaceHierarchyNode) {
          if (isVisible(d) && this instanceof SVGElement) {
            this.style.display = 'block';
          }
        })
        .on('end', function (d: SpaceHierarchyNode) {
          if (!isVisible(d) && this instanceof SVGElement) {
            this.style.display = 'none';
          }
        });

      logos.each(function () {
        d3.select(this)
          .select('circle.logo-disk')
          .transition()
          .duration(duration)
          .attr('fill', getDiagramFillColor())
          .attr('stroke', 'none');
      });

      transition.on('interrupt', () => {
        focusMotion = false;
      });

      transition.on('end', () => {
        focusMotion = false;
        const latest = readStageSize();
        const latestKey = latest ? stageSizeKey(latest) : '';
        // A stage resize during the zoom continues as one settle after the
        // focus motion, instead of a second snap on top of it.
        if (latest && latestKey !== sizeKeyAtStart) {
          fittedKey = latestKey;
          const next = solveClusterFrame(
            focus,
            latest.width,
            latest.height,
            showNodeLabels,
          );
          requestAnimationFrame(() => glideFrame(next));
        }
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

    function applyFrame(
      next: ClusterFrame,
      explicitScale?: number,
      lockedSize?: { width: number; height: number },
    ) {
      const size = lockedSize ?? readStageSize();
      if (!size) return;
      const { width: viewWidth, height: viewHeight } = size;
      // 1:1 with the stage. The cluster is placed in this box, so a tall stage
      // is usable instead of letterboxing a square view.
      svg.attr(
        'viewBox',
        `${-viewWidth / 2} ${-viewHeight / 2} ${viewWidth} ${viewHeight}`,
      );
      const fitted = fitScale(next, viewWidth, viewHeight);
      const k =
        typeof explicitScale === 'number' && Number.isFinite(explicitScale)
          ? explicitScale
          : containScale(
              focus.descendants() as SpaceHierarchyNode[],
              next.cx,
              next.cy,
              viewWidth,
              viewHeight,
              fitted,
              showNodeLabels,
            );

      const nodeTransform = (d: SpaceHierarchyNode) => {
        const tx = (finiteOr(d.x, 0) - next.cx) * k;
        const ty = (finiteOr(d.y, 0) - next.cy) * k;
        return `translate(${tx}, ${ty})`;
      };

      // The focused cluster's outer ring is a quiet disc. Names sit on it.
      // Smaller rings stay hairlines, with the accent only on the current space.
      const enclosureFill = dark ? 'var(--hypha-mid)' : 'var(--hypha-panel)';
      const isEnclosure = (d: SpaceHierarchyNode) =>
        d === focus && Boolean(d.children && d.children.length > 0);

      orbits
        .attr('transform', nodeTransform)
        .attr('d', (d: SpaceHierarchyNode) =>
          smoothClosedCirclePath(finiteOr(d.r, 0) * k),
        )
        .attr('fill', (d: SpaceHierarchyNode) =>
          isEnclosure(d) ? enclosureFill : 'none',
        )
        .attr('stroke', (d: SpaceHierarchyNode) => {
          if (isEnclosure(d)) return 'none';
          const isCurrent =
            typeof currentSpaceId === 'number' && d.data.id === currentSpaceId;
          return isCurrent ? spaceAccent : hairline;
        })
        .attr('stroke-width', (d: SpaceHierarchyNode) =>
          isEnclosure(d) ? 0 : HAIRLINE,
        )
        .attr('stroke-linecap', 'butt')
        .attr('stroke-linejoin', 'round');

      logos
        .attr('transform', nodeTransform)
        .each(function (d: SpaceHierarchyNode) {
          const r = clampSvgLength(finiteOr(d.r, 0) * k * logoRatio(d));
          const clipId = `clip-${d.data.id}`;
          const diameter = clampSvgLength(r * 2);
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
        });

      if (showNodeLabels) {
        labelText
          .attr('transform', nodeTransform)
          .attr('x', 0)
          .attr('y', (d: SpaceHierarchyNode) => {
            return nodeLabelTop(d, k);
          })
          .attr('font-size', `${VISUALIZATION_CONFIG.LABEL_FONT}px`)
          .attr('fill', getLabelFillColor())
          .attr('stroke', getLabelStrokeColor())
          .style('display', (d: SpaceHierarchyNode) =>
            isLabelShown(d) ? 'block' : 'none',
          )
          .style('opacity', (d: SpaceHierarchyNode) =>
            isLabelShown(d) ? 1 : 0,
          )
          .text((d: SpaceHierarchyNode) => truncateLabel(d.data.name));
      }
    }

    let fittedKey = initialSize ? stageSizeKey(initialSize) : '';
    let fittedOnce = Boolean(initialSize);
    let settleRaf = 0;
    const stageObserver = new ResizeObserver(() => {
      // The focus tween already reads the live stage each tick. A parallel
      // viewBox write here is the extra jump in the middle of the zoom.
      if (focusMotion) return;
      if (settleRaf) cancelAnimationFrame(settleRaf);
      settleRaf = requestAnimationFrame(() => {
        settleRaf = 0;
        if (focusMotion) return;
        const size = readStageSize();
        if (!size) return;
        const key = stageSizeKey(size);
        if (key === fittedKey) return;
        fittedKey = key;
        const next = solveClusterFrame(
          focus,
          size.width,
          size.height,
          showNodeLabels,
        );
        // First measurement paints in place. Later passes — banner, scroll
        // hold, row height — share one glide to the latest box.
        if (!fittedOnce || prefersReducedMotion()) {
          fittedOnce = true;
          commitFrame(next);
          return;
        }
        fittedOnce = true;
        glideFrame(next);
      });
    });
    if (containerRef.current) stageObserver.observe(containerRef.current);

    return () => {
      if (settleRaf) cancelAnimationFrame(settleRaf);
      stageObserver.disconnect();
      svg.interrupt(DIAGRAM_MOTION);
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
      className={cn(
        layout === 'fill'
          ? 'absolute inset-0 h-full w-full overflow-hidden'
          : 'relative aspect-square w-full overflow-hidden',
        className,
      )}
    >
      <svg
        ref={svgRef}
        className="absolute inset-0 block h-full w-full"
        width="100%"
        height="100%"
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

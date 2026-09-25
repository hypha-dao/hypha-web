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
  WIDTH: 900,
  HEIGHT: 900,
  LOGO_STROKE_WIDTH: 20,
  STROKE_WIDTH_SCALE: 0.7,
  MIN_LABEL_RADIUS: 14,
  MAX_LABEL_CHARS: 18,
} as const;

function labelFitsNode(
  name: string,
  fontSize: number,
  radius: number,
): boolean {
  const text = truncateLabel(name);
  return text.length * fontSize * 0.56 <= Math.max(radius * 2.6, 1);
}

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

function finiteOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? (value as number) : fallback;
}

function sanitizeZoomView(
  view: [number, number, number],
  fallbackDiameter = VISUALIZATION_CONFIG.BASE_RADIUS * 2,
): [number, number, number] {
  const diameter = finiteOr(view[2], fallbackDiameter);
  return [finiteOr(view[0], 0), finiteOr(view[1], 0), Math.max(diameter, 1)];
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
    const hairline = dark
      ? 'color-mix(in srgb, var(--hypha-text) 38%, transparent)'
      : 'color-mix(in srgb, var(--hypha-ink) 34%, transparent)';
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

    const { WIDTH: width, HEIGHT: height } = VISUALIZATION_CONFIG;

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
    let view = sanitizeZoomView([
      finiteOr(focus.x, 0),
      finiteOr(focus.y, 0),
      finiteOr(focus.r, VISUALIZATION_CONFIG.BASE_RADIUS) * 2,
    ]);

    const svg = d3
      .select(svgRef.current)
      .attr('viewBox', `-${width / 2} -${height / 2} ${width} ${height}`)
      .style('shape-rendering', 'geometricPrecision')
      .style('cursor', 'pointer');

    svg.selectAll('*').remove();

    const g = svg.append('g');

    const defs = svg.append('defs');
    const orbits = g
      .selectAll<SVGCircleElement, SpaceHierarchyNode>('circle.orbit')
      .data(root.descendants() as SpaceHierarchyNode[])
      .join('circle')
      .attr('class', 'orbit')
      .style('fill', 'none')
      .attr('stroke', hairline)
      .attr('stroke-width', ORBIT_STROKE_WIDTH)
      .attr('stroke-linecap', 'round')
      .attr('stroke-dasharray', 'none')
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
        .attr('alt', `${d.data.name} logo`)
        .attr('clip-path', `url(#${clipId})`);

      logoGroup
        .append('circle')
        .attr('class', 'logo-ring')
        .attr('fill', 'none')
        .attr('stroke', getLogoRingColor())
        .attr('stroke-width', 1.25)
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('shape-rendering', 'geometricPrecision')
        .style('pointer-events', 'none');

      logoGroup
        .append('circle')
        .attr('class', 'focus-ring')
        .attr('fill', 'none')
        .attr('stroke', ink)
        .attr('stroke-width', 1.15)
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('shape-rendering', 'geometricPrecision')
        .attr('opacity', 0)
        .style('pointer-events', 'none');

      logoGroup
        .append('circle')
        .attr('class', 'current-ring')
        .attr('fill', 'none')
        .attr('stroke', spaceAccent)
        .attr('stroke-width', 1.25)
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('shape-rendering', 'geometricPrecision')
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

    zoomTo(view);
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

      const transition = svg
        .transition()
        .duration(VISUALIZATION_CONFIG.ZOOM_DURATION)
        .tween('zoom', () => {
          const targetView = sanitizeZoomView([
            finiteOr(focus.x, 0),
            finiteOr(focus.y, 0),
            finiteOr(focus.r, VISUALIZATION_CONFIG.BASE_RADIUS) * 2,
          ]);
          const startView = sanitizeZoomView(view);
          const interpolator = d3.interpolateZoom(startView, targetView);
          return (t) => {
            const next = sanitizeZoomView(interpolator(t), targetView[2]);
            zoomTo(next);
          };
        });

      transition
        .selectAll<SVGElement, SpaceHierarchyNode>('circle.orbit, g.logo')
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

    function zoomTo(v: [number, number, number]) {
      const safeView = sanitizeZoomView(v, view[2]);
      const k = width / safeView[2];
      view = safeView;

      const nodeTransform = (d: SpaceHierarchyNode) => {
        const tx = (finiteOr(d.x, 0) - safeView[0]) * k;
        const ty = (finiteOr(d.y, 0) - safeView[1]) * k;
        return `translate(${tx}, ${ty})`;
      };

      orbits
        .attr('transform', nodeTransform)
        .attr('r', (d: SpaceHierarchyNode) =>
          clampSvgLength(finiteOr(d.r, 0) * k),
        )
        .style('fill', 'none')
        .attr('stroke', hairline)
        .attr('stroke-width', ORBIT_STROKE_WIDTH)
        .attr('stroke-dasharray', 'none');

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
          const labelFontSize = clampSvgLength(
            Math.min(15, Math.max(10, r * 0.42)),
          );
          const showLabel =
            showNodeLabels &&
            r >= VISUALIZATION_CONFIG.MIN_LABEL_RADIUS &&
            labelFitsNode(d.data.name, labelFontSize, r);
          const labelY = r + Math.max(10, labelFontSize * 0.35);
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
            .select('circle.logo-ring')
            .attr('r', r)
            .attr('stroke', getLogoRingColor())
            .attr('stroke-width', isFocused ? 1.5 : 1.15);

          selection
            .select('circle.focus-ring')
            .attr('r', clampSvgLength(r + Math.max(3.5, r * 0.12)))
            .attr('stroke', ink)
            .attr('opacity', isFocused && !isCurrent ? 0.9 : 0);

          selection
            .select('circle.current-ring')
            .attr('r', clampSvgLength(r + Math.max(4, r * 0.14)))
            .attr('stroke', spaceAccent)
            .attr('opacity', isCurrent ? 1 : 0);

          if (showNodeLabels) {
            selection
              .select('text.node-label')
              .attr('y', labelY)
              .attr('font-size', `${labelFontSize}px`)
              .attr('fill', getLabelFillColor())
              .attr('stroke', getLabelStrokeColor())
              .attr('opacity', showLabel && isVisible(d) ? 1 : 0)
              .text(truncateLabel(d.data.name));
          }
        });
    }
    return () => {
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
      className={cn('relative aspect-square w-full', className)}
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

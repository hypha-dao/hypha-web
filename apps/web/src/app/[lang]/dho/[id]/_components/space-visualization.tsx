'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useTheme } from 'next-themes';
import { DEFAULT_SPACE_AVATAR_IMAGE } from '@hypha-platform/core/client';
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

type Props = {
  data: SpaceNode;
  currentSpaceId?: number;
  onVisibleSpacesChange?: (spaces: VisibleSpace[]) => void;
  enableHoverActions?: boolean;
};

const SPACE_ACCENT_FALLBACK = '#14b8a6';

const VISUALIZATION_CONFIG = {
  BASE_RADIUS: 420,
  DEPTH_SCALE: 0.45,
  ORBIT_RATIO: 0.9,
  LOGO_RATIO: 0.25,
  ZOOM_DURATION: 800,
  WIDTH: 900,
  HEIGHT: 900,
  LOGO_STROKE_WIDTH: 20,
  STROKE_WIDTH_SCALE: 0.7,
} as const;

function parseHex(hex: string): [number, number, number] | null {
  const normalized = hex.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return null;
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return [r, g, b];
}

function toSampleableImageSrc(src?: string | null): string | null {
  if (!src) return null;
  const candidate = src.trim();
  if (!candidate) return null;
  if (candidate.startsWith('/')) {
    return candidate.startsWith('//') ? null : candidate;
  }
  try {
    const url = new URL(candidate);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return `/_next/image?url=${encodeURIComponent(candidate)}&w=96&q=75`;
    }
  } catch {
    return null;
  }
  return null;
}

async function sampleAccentHex(src?: string | null): Promise<string | null> {
  const imageSrc = toSampleableImageSrc(src);
  if (!imageSrc) return null;
  return await new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const maxSide = 96;
        const scale = Math.min(
          maxSide / image.width,
          maxSide / image.height,
          1,
        );
        const width = Math.max(8, Math.round(image.width * scale));
        const height = Math.max(8, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(null);
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height).data;
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let count = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          const alpha = pixels[i + 3] ?? 0;
          if (alpha < 40) continue;
          const r = pixels[i] ?? 0;
          const g = pixels[i + 1] ?? 0;
          const b = pixels[i + 2] ?? 0;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;
          if (saturation < 0.12) continue;
          rSum += r;
          gSum += g;
          bSum += b;
          count++;
        }
        if (count < 6) {
          resolve(null);
          return;
        }
        const r = Math.round(rSum / count)
          .toString(16)
          .padStart(2, '0');
        const g = Math.round(gSum / count)
          .toString(16)
          .padStart(2, '0');
        const b = Math.round(bSum / count)
          .toString(16)
          .padStart(2, '0');
        resolve(`#${r}${g}${b}`);
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = imageSrc;
  });
}

function withAlpha(hex: string, alpha: number) {
  const rgb = parseHex(hex);
  if (!rgb) return `rgba(20, 184, 166, ${alpha})`;
  const [r, g, b] = rgb;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function SpaceVisualization({
  data,
  currentSpaceId,
  onVisibleSpacesChange,
  enableHoverActions = false,
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
  const introToRootTimeoutRef = useRef<number | null>(null);
  const introSequenceActiveRef = useRef(false);
  const introRanRef = useRef(false);
  const accentSampleCacheRef = useRef<Map<string, Promise<string | null>>>(
    new Map(),
  );

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

  const clearIntroTimeout = () => {
    if (introToRootTimeoutRef.current == null) return;
    window.clearTimeout(introToRootTimeoutRef.current);
    introToRootTimeoutRef.current = null;
  };

  const cancelIntroSequence = () => {
    introSequenceActiveRef.current = false;
    clearIntroTimeout();
  };

  useEffect(() => {
    themeRef.current = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    onVisibleSpacesChangeRef.current = onVisibleSpacesChange;
  }, [onVisibleSpacesChange]);

  useEffect(() => {
    previousVisibleSpacesRef.current = '';
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
    if (!svgRef.current || !focusRef.current) return;

    const getSelectedSpaceFillColor = () =>
      themeRef.current === 'dark' ? '#1a1a1a' : '#ffffff';

    const svg = d3.select(svgRef.current);
    const orbits = svg.selectAll<SVGCircleElement, SpaceHierarchyNode>(
      'circle.orbit',
    );

    orbits.each(function (d: SpaceHierarchyNode) {
      if (d === focusRef.current) {
        d3.select(this).style('fill', getSelectedSpaceFillColor());
      }
    });

    const getStrokeWidth = (depth: number): number => {
      return (
        VISUALIZATION_CONFIG.LOGO_STROKE_WIDTH *
        Math.pow(VISUALIZATION_CONFIG.STROKE_WIDTH_SCALE, depth)
      );
    };

    const logos = svg.selectAll<SVGGElement, SpaceHierarchyNode>('g.logo');
    logos.each(function (d: SpaceHierarchyNode) {
      const circle = d3.select(this).select('circle');
      if (d === focusRef.current) {
        circle.attr('fill', getSelectedSpaceFillColor());
      }
      circle
        .attr('stroke', getSelectedSpaceFillColor())
        .attr('stroke-width', getStrokeWidth(d.depth));
    });
  }, [resolvedTheme]);

  useEffect(() => {
    if (!svgRef.current) return;

    const getSelectedSpaceFillColor = () =>
      themeRef.current === 'dark' ? '#1a1a1a' : '#ffffff';

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
          childNode.r = (node.r! - parentLogoRadiusWithStroke) / 2;
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
          childNode.r = bestChildRadius;
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
      children.forEach((childNode, i) => {
        const angle = i * step;
        childNode.x = d.x! + Math.cos(angle) * orbitRadius;
        childNode.y = d.y! + Math.sin(angle) * orbitRadius;
      });
    });

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

    let focus = root;

    if (currentSpaceId && currentSpaceId !== savedFocusIdRef.current) {
      const currentSpaceNode = findNodeById(root, currentSpaceId);
      if (currentSpaceNode) {
        focus = currentSpaceNode;
        savedFocusIdRef.current = null;
      }
    } else if (savedFocusIdRef.current) {
      const savedNode = findNodeById(root, savedFocusIdRef.current);
      if (savedNode) {
        focus = savedNode;
      } else {
        savedFocusIdRef.current = null;
        if (currentSpaceId) {
          const currentSpaceNode = findNodeById(root, currentSpaceId);
          if (currentSpaceNode) {
            focus = currentSpaceNode;
          }
        }
      }
    } else if (currentSpaceId) {
      const currentSpaceNode = findNodeById(root, currentSpaceId);
      if (currentSpaceNode) {
        focus = currentSpaceNode;
      }
    }

    focusRef.current = focus;
    savedFocusIdRef.current = focus.data.id;
    let view: [number, number, number] = [focus.x!, focus.y!, focus.r! * 2];

    const svg = d3
      .select(svgRef.current)
      .attr('viewBox', `-${width / 2} -${height / 2} ${width} ${height}`)
      .style('cursor', 'pointer');

    svg.selectAll('*').remove();

    const g = svg.append('g');

    const orbits = g
      .selectAll<SVGCircleElement, SpaceHierarchyNode>('circle.orbit')
      .data(root.descendants() as SpaceHierarchyNode[])
      .join('circle')
      .attr('class', 'orbit')
      .style('fill', (d: SpaceHierarchyNode) =>
        d === focus ? getSelectedSpaceFillColor() : 'transparent',
      )
      .attr('stroke', '#8F8F8F')
      .attr('stroke-width', 1.2)
      .style('pointer-events', 'all')
      .on('click', (event, d) => {
        if (focus !== d) {
          event.stopPropagation();
          cancelIntroSequence();
          zoom(d);
        }
      });

    const defs = svg.append('defs');
    const nodeAccents = new Map<number, string>();
    const getNodeAccent = (d: SpaceHierarchyNode) =>
      nodeAccents.get(d.data.id) ?? SPACE_ACCENT_FALLBACK;
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
          cancelIntroSequence();
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
        .attr('fill', d === focus ? getSelectedSpaceFillColor() : '#000')
        .attr('stroke', getSelectedSpaceFillColor())
        .attr('stroke-width', getStrokeWidth(d.depth));

      logoGroup
        .append('image')
        .attr('href', d.data.logoUrl || DEFAULT_SPACE_AVATAR_IMAGE)
        .attr('preserveAspectRatio', 'xMidYMid slice')
        .attr('alt', `${d.data.name} logo`)
        .attr('clip-path', `url(#${clipId})`);
    });

    const ripples = g
      .selectAll<SVGGElement, SpaceHierarchyNode>('g.ripples')
      .data(root.descendants() as SpaceHierarchyNode[])
      .join('g')
      .attr('class', 'ripples')
      .style('pointer-events', 'none');

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    ripples.each(function (d: SpaceHierarchyNode) {
      const rippleGroup = d3.select(this);
      const delays = ['0s', '0.35s', '0.7s'];
      const scales = [0.56, 0.74, 0.9];

      scales.forEach((scale, index) => {
        const opacity = d.depth === 0 ? 0.24 : 0.18 - index * 0.03;
        const circle = rippleGroup
          .append('circle')
          .attr('class', 'ripple-ring')
          .attr('fill', 'none')
          .attr('stroke', withAlpha(getNodeAccent(d), opacity))
          .attr('stroke-width', 1)
          .attr('data-scale', scale.toString());

        if (!prefersReducedMotion) {
          circle
            .append('animate')
            .attr('attributeName', 'opacity')
            .attr(
              'values',
              `${Math.max(0.08, opacity - 0.08)};${opacity};${Math.max(
                0.08,
                opacity - 0.08,
              )}`,
            )
            .attr('dur', '3.2s')
            .attr('begin', delays[index] ?? '0s')
            .attr('repeatCount', 'indefinite');
        }
      });
    });

    svg.on('click', () => {
      if (focus.parent) {
        cancelIntroSequence();
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
    ripples.style('opacity', (d: SpaceHierarchyNode) => (isVisible(d) ? 1 : 0));
    orbits.style('display', (d: SpaceHierarchyNode) =>
      isVisible(d) ? 'block' : 'none',
    );
    logos.style('display', (d: SpaceHierarchyNode) =>
      isVisible(d) ? 'block' : 'none',
    );
    ripples.style('display', (d: SpaceHierarchyNode) =>
      isVisible(d) ? 'block' : 'none',
    );

    logos.each(function (d: SpaceHierarchyNode) {
      d3.select(this)
        .select('circle')
        .attr('fill', d === focus ? getSelectedSpaceFillColor() : '#000')
        .attr('stroke', getSelectedSpaceFillColor())
        .attr('stroke-width', getStrokeWidth(d.depth));
    });

    zoomTo(view);
    previousVisibleSpacesRef.current = '';
    notifyVisibleSpaces(focus);

    if (!introRanRef.current && focus !== root) {
      introRanRef.current = true;
      const introTargets: SpaceHierarchyNode[] = [];
      let current = focus.parent as SpaceHierarchyNode | undefined;
      while (current) {
        introTargets.push(current);
        if (current === root) break;
        current = current.parent as SpaceHierarchyNode | undefined;
      }
      introSequenceActiveRef.current = introTargets.length > 0;

      const runIntroStep = (index: number) => {
        if (!introSequenceActiveRef.current) return;
        const target = introTargets[index];
        if (!target) {
          introSequenceActiveRef.current = false;
          return;
        }
        zoom(target, {
          onEnd: () => {
            if (!introSequenceActiveRef.current) return;
            const nextIndex = index + 1;
            if (nextIndex >= introTargets.length) {
              introSequenceActiveRef.current = false;
              return;
            }
            introToRootTimeoutRef.current = window.setTimeout(() => {
              runIntroStep(nextIndex);
            }, 120);
          },
        });
      };

      introToRootTimeoutRef.current = window.setTimeout(() => {
        runIntroStep(0);
      }, 1400);
    }

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
          const i = d3.interpolateZoom(view, [
            focus.x!,
            focus.y!,
            focus.r! * 2,
          ]);
          return (t) => zoomTo(i(t));
        });

      transition
        .selectAll<SVGElement, SpaceHierarchyNode>(
          'circle.orbit, g.logo, g.ripples',
        )
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

      orbits
        .transition()
        .duration(VISUALIZATION_CONFIG.ZOOM_DURATION)
        .style('fill', (d: SpaceHierarchyNode) =>
          d === focus ? getSelectedSpaceFillColor() : 'transparent',
        );

      logos.each(function (d: SpaceHierarchyNode) {
        d3.select(this)
          .select('circle')
          .transition()
          .duration(VISUALIZATION_CONFIG.ZOOM_DURATION)
          .attr('fill', d === focus ? getSelectedSpaceFillColor() : '#000')
          .attr('stroke', getSelectedSpaceFillColor())
          .attr('stroke-width', getStrokeWidth(d.depth));
      });

      transition.on('end', () => {
        notifyVisibleSpaces(focus);
        options?.onEnd?.();
      });
    }

    function zoomTo(v: [number, number, number]) {
      const k = width / v[2];
      view = v;

      orbits
        .attr(
          'transform',
          (d: SpaceHierarchyNode) =>
            `translate(${(d.x! - v[0]) * k}, ${(d.y! - v[1]) * k})`,
        )
        .attr('r', (d: SpaceHierarchyNode) => d.r! * k)
        .style('fill', (d: SpaceHierarchyNode) =>
          d === focus ? getSelectedSpaceFillColor() : 'transparent',
        );

      logos
        .attr(
          'transform',
          (d: SpaceHierarchyNode) =>
            `translate(${(d.x! - v[0]) * k}, ${(d.y! - v[1]) * k})`,
        )
        .each(function (d: SpaceHierarchyNode) {
          const r = d.r! * k * VISUALIZATION_CONFIG.LOGO_RATIO;
          const clipId = `clip-${d.data.id}`;

          d3.select(this)
            .select('circle')
            .attr('r', r)
            .attr('fill', d === focus ? getSelectedSpaceFillColor() : '#000')
            .attr('stroke', getSelectedSpaceFillColor())
            .attr('stroke-width', getStrokeWidth(d.depth));

          defs.select(`#${clipId} circle`).attr('r', r);

          d3.select(this)
            .select('image')
            .attr('x', -r)
            .attr('y', -r)
            .attr('width', r * 2)
            .attr('height', r * 2);
        });

      ripples
        .attr(
          'transform',
          (d: SpaceHierarchyNode) =>
            `translate(${(d.x! - v[0]) * k}, ${(d.y! - v[1]) * k})`,
        )
        .each(function (d: SpaceHierarchyNode) {
          const accent = getNodeAccent(d);
          d3.select(this)
            .selectAll<SVGCircleElement, unknown>('circle.ripple-ring')
            .each(function (_, i) {
              const scale = Number.parseFloat(
                d3.select(this).attr('data-scale') || '0.7',
              );
              const baseOpacity = d.depth === 0 ? 0.24 : 0.18 - i * 0.03;
              d3.select(this)
                .attr('r', d.r! * k * scale)
                .attr('stroke', withAlpha(accent, Math.max(0.08, baseOpacity)));
            });
        });
    }

    let isCancelled = false;
    root.each((node) => {
      void (async () => {
        const cacheKey = (node.data.logoUrl ?? '').trim();
        let accentPromise = accentSampleCacheRef.current.get(cacheKey);
        if (!accentPromise) {
          accentPromise = sampleAccentHex(node.data.logoUrl);
          accentSampleCacheRef.current.set(cacheKey, accentPromise);
        }
        const accent = await accentPromise;
        if (isCancelled) return;
        const resolvedAccent = accent ?? SPACE_ACCENT_FALLBACK;
        nodeAccents.set(node.data.id, resolvedAccent);
        ripples
          .filter((d) => d.data.id === node.data.id)
          .selectAll<SVGCircleElement, unknown>('circle.ripple-ring')
          .each(function (_, i) {
            const baseOpacity = node.depth === 0 ? 0.24 : 0.18 - i * 0.03;
            d3.select(this).attr(
              'stroke',
              withAlpha(resolvedAccent, Math.max(0.08, baseOpacity)),
            );
          });
      })();
    });
    return () => {
      isCancelled = true;
      cancelIntroSequence();
    };
  }, [data, currentSpaceId, resolvedTheme, enableHoverActions]);

  useEffect(() => {
    return () => {
      clearTooltipHideTimeout();
      cancelIntroSequence();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        ref={svgRef}
        className="h-auto w-full"
        role="img"
        aria-label="Space hierarchy visualization"
      />
      {enableHoverActions && tooltip.visible && (
        <div
          ref={tooltipRef}
          onMouseEnter={clearTooltipHideTimeout}
          onMouseLeave={scheduleTooltipHide}
          className="absolute z-50 rounded-lg border border-border/70 bg-popover px-2 py-1.5 shadow-lg"
          style={{
            left: `${tooltip.x + 10}px`,
            top: `${tooltip.y + 10}px`,
            transform: 'translate(0, -50%)',
          }}
        >
          <div className="rounded-md border border-border/60 bg-background-3/80 px-2.5 py-1 text-xs font-semibold text-foreground">
            {tooltip.text}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useTheme } from 'next-themes';
import { DEFAULT_SPACE_AVATAR_IMAGE } from '@hypha-platform/core/client';
import {
  parseHex,
  sampleAccentHex,
  toSampleableImageSrc,
} from './space-accent-utils';
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
  const accentSampleCacheRef = useRef(
    new Map<string, Promise<string | null>>(),
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

    const grooveScales = Array.from(
      { length: 12 },
      (_, index) => 0.34 + index * 0.05,
    );
    const sweepStrokeColor =
      resolvedTheme === 'dark'
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(15,23,42,0.08)';

    ripples.each(function (d: SpaceHierarchyNode) {
      const rippleGroup = d3.select(this);

      const baseOpacity = d.depth === 0 ? 0.14 : 0.11;
      rippleGroup
        .append('circle')
        .attr('class', 'vinyl-base')
        .attr('fill', withAlpha(getNodeAccent(d), baseOpacity))
        .attr('data-scale', '0.98')
        .attr('opacity', 1);

      rippleGroup
        .append('circle')
        .attr('class', 'vinyl-outer-halo')
        .attr('fill', 'none')
        .attr('stroke', withAlpha(getNodeAccent(d), d.depth === 0 ? 0.24 : 0.2))
        .attr('stroke-width', 1.1)
        .attr('data-scale', '0.98')
        .append('animate')
        .attr('attributeName', 'opacity')
        .attr(
          'values',
          `${d.depth === 0 ? 0.18 : 0.14};${d.depth === 0 ? 0.3 : 0.24};${
            d.depth === 0 ? 0.18 : 0.14
          }`,
        )
        .attr('dur', '6.5s')
        .attr('begin', '0s')
        .attr('repeatCount', 'indefinite');

      grooveScales.forEach((scale, index) => {
        const opacity =
          d.depth === 0 ? 0.12 - index * 0.005 : 0.1 - index * 0.004;
        rippleGroup
          .append('circle')
          .attr('class', 'vinyl-groove')
          .attr('fill', 'none')
          .attr('stroke', withAlpha(getNodeAccent(d), Math.max(0.04, opacity)))
          .attr('stroke-width', 0.65)
          .attr('data-scale', scale.toString());
      });

      rippleGroup
        .append('circle')
        .attr('class', 'vinyl-sweep')
        .attr('fill', 'none')
        .attr('stroke', sweepStrokeColor)
        .attr('stroke-width', 1)
        .attr('stroke-linecap', 'round')
        .attr('stroke-dasharray', '22 260')
        .attr('data-scale', '0.82')
        .append('animateTransform')
        .attr('attributeName', 'transform')
        .attr('type', 'rotate')
        .attr('from', '0 0 0')
        .attr('to', '360 0 0')
        .attr('dur', '11s')
        .attr('repeatCount', 'indefinite');
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
        sampleVisibleNodeAccents(focus);
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
          const orbitRadius = d.r! * k;

          d3.select(this)
            .select<SVGCircleElement>('circle.vinyl-base')
            .attr('r', orbitRadius * 0.98)
            .attr('fill', withAlpha(accent, d.depth === 0 ? 0.14 : 0.11));

          d3.select(this)
            .select<SVGCircleElement>('circle.vinyl-outer-halo')
            .attr('r', orbitRadius * 0.98)
            .attr('stroke', withAlpha(accent, d.depth === 0 ? 0.24 : 0.2))
            .attr('stroke-width', Math.max(0.9, orbitRadius * 0.004));

          d3.select(this)
            .selectAll<SVGCircleElement, unknown>('circle.vinyl-groove')
            .each(function (_, i) {
              const scale = Number.parseFloat(
                d3.select(this).attr('data-scale') || '0.7',
              );
              const baseOpacity =
                d.depth === 0 ? 0.12 - i * 0.005 : 0.1 - i * 0.004;
              d3.select(this)
                .attr('r', orbitRadius * scale)
                .attr('stroke-width', Math.max(0.45, orbitRadius * 0.0018))
                .attr('stroke', withAlpha(accent, Math.max(0.08, baseOpacity)));
            });

          d3.select(this)
            .select<SVGCircleElement>('circle.vinyl-sweep')
            .attr('r', orbitRadius * 0.82)
            .attr('stroke-width', Math.max(0.65, orbitRadius * 0.0024))
            .attr('stroke', sweepStrokeColor);
        });
    }

    const setNodeRippleAccent = (node: SpaceHierarchyNode, accent: string) => {
      nodeAccents.set(node.data.id, accent);
      ripples
        .filter((d) => d.data.id === node.data.id)
        .select<SVGCircleElement>('circle.vinyl-base')
        .attr('fill', withAlpha(accent, node.depth === 0 ? 0.14 : 0.11));

      ripples
        .filter((d) => d.data.id === node.data.id)
        .select<SVGCircleElement>('circle.vinyl-outer-halo')
        .attr('stroke', withAlpha(accent, node.depth === 0 ? 0.24 : 0.2));

      ripples
        .filter((d) => d.data.id === node.data.id)
        .selectAll<SVGCircleElement, unknown>('circle.vinyl-groove')
        .each(function (_, i) {
          const baseOpacity =
            node.depth === 0 ? 0.12 - i * 0.005 : 0.1 - i * 0.004;
          d3.select(this).attr(
            'stroke',
            withAlpha(accent, Math.max(0.04, baseOpacity)),
          );
        });
    };

    const getCachedAccentPromise = (logoUrl?: string | null) => {
      const src = toSampleableImageSrc(logoUrl);
      if (!src) return Promise.resolve<string | null>(null);
      const existing = accentSampleCacheRef.current.get(src);
      if (existing) return existing;
      const promise = sampleAccentHex(logoUrl).catch(() => null);
      accentSampleCacheRef.current.set(src, promise);
      return promise;
    };

    let isCancelled = false;
    let accentSampleRunId = 0;

    function sampleVisibleNodeAccents(focusNode: SpaceHierarchyNode) {
      accentSampleRunId += 1;
      const runId = accentSampleRunId;
      const visibleNodes = (root.descendants() as SpaceHierarchyNode[]).filter(
        (node) =>
          isVisibleForFocus(node, focusNode) &&
          (node.depth <= 2 || node === focusNode),
      );
      const queue = visibleNodes.slice();
      const maxConcurrentSamples = 4;
      const runSampleWorker = async () => {
        while (!isCancelled && runId === accentSampleRunId) {
          const node = queue.shift();
          if (!node) return;
          const accent = await getCachedAccentPromise(node.data.logoUrl);
          if (isCancelled || runId !== accentSampleRunId) return;
          setNodeRippleAccent(node, accent ?? SPACE_ACCENT_FALLBACK);
        }
      };

      void Promise.all(
        Array.from(
          { length: Math.min(maxConcurrentSamples, queue.length) },
          runSampleWorker,
        ),
      );
    }

    sampleVisibleNodeAccents(focus);

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

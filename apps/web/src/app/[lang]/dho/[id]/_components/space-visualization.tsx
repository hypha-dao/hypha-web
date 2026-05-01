'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useTheme } from 'next-themes';
import { DEFAULT_SPACE_AVATAR_IMAGE } from '@hypha-platform/core/client';
import type { VisibleSpace } from './types';
import Link from 'next/link';

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
  lang?: string;
  enableHoverActions?: boolean;
  actionLabels?: {
    addSpace: string;
    visitSpace: string;
  };
};

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
const HOVER_PANEL_HIDE_DELAY_MS = 320;
const SIGNAL_FLOW_BASE_DURATION_MS = 18000;
const FOCUS_PULSE_DURATION_MS = 1850;

export function SpaceVisualization({
  data,
  currentSpaceId,
  onVisibleSpacesChange,
  lang,
  enableHoverActions = false,
  actionLabels,
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
    }, HOVER_PANEL_HIDE_DELAY_MS);
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
        d3.select(this).style('fill', 'transparent');
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
    const getSignalColor = (spaceId: number): string => {
      const hue = (spaceId * 47) % 360;
      return `hsl(${hue} 84% ${themeRef.current === 'dark' ? '64%' : '48%'})`;
    };

    const orbits = g
      .selectAll<SVGCircleElement, SpaceHierarchyNode>('circle.orbit')
      .data(root.descendants() as SpaceHierarchyNode[])
      .join('circle')
      .attr('class', 'orbit')
      .style('fill', 'transparent')
      .attr('stroke', (d: SpaceHierarchyNode) => getSignalColor(d.data.id))
      .attr('stroke-width', (d: SpaceHierarchyNode) =>
        d === focus ? 1.45 : 1.1,
      )
      .attr('stroke-opacity', (d: SpaceHierarchyNode) =>
        d === focus ? 0.72 : 0.38,
      )
      .attr('stroke-dasharray', (d: SpaceHierarchyNode) =>
        d.depth === 0 ? 'none' : '11 13',
      )
      .attr('stroke-dashoffset', 0)
      .style('pointer-events', 'all')
      .on('click', (event, d) => {
        if (focus !== d) {
          event.stopPropagation();
          zoom(d);
        }
      });

    const defs = svg.append('defs');

    const logos = g
      .selectAll<SVGGElement, SpaceHierarchyNode>('g.logo')
      .data(root.descendants() as SpaceHierarchyNode[])
      .join('g')
      .attr('class', 'logo')
      .style('pointer-events', 'all')
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d: SpaceHierarchyNode) {
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
      .on('mousemove', function (event) {
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
      })
      .on('click', (event, d) => {
        if (focus !== d) {
          event.stopPropagation();
          zoom(d);
        }
      });

    logos.each(function (d: SpaceHierarchyNode) {
      const logoGroup = d3.select(this);
      const clipId = `clip-${d.data.id}`;
      const glowClipId = `clip-glow-${d.data.id}`;
      const glowFilterId = `glow-filter-${d.data.id}`;

      const clipPath = defs.append('clipPath').attr('id', clipId);
      clipPath.append('circle').attr('r', 1);
      const glowClipPath = defs.append('clipPath').attr('id', glowClipId);
      glowClipPath.append('circle').attr('r', 1);
      const glowFilter = defs
        .append('filter')
        .attr('id', glowFilterId)
        .attr('x', '-80%')
        .attr('y', '-80%')
        .attr('width', '260%')
        .attr('height', '260%');
      glowFilter.append('feGaussianBlur').attr('stdDeviation', 6.5);

      logoGroup
        .append('image')
        .attr('class', 'logo-glow')
        .attr('href', d.data.logoUrl || DEFAULT_SPACE_AVATAR_IMAGE)
        .attr('preserveAspectRatio', 'xMidYMid slice')
        .attr('clip-path', `url(#${glowClipId})`)
        .attr('filter', `url(#${glowFilterId})`)
        .style('opacity', d === focus ? 0.52 : 0.22)
        .style('mix-blend-mode', 'screen');

      logoGroup
        .append('circle')
        .attr('fill', d === focus ? getSelectedSpaceFillColor() : '#000')
        .attr('stroke', getSelectedSpaceFillColor())
        .attr('stroke-width', getStrokeWidth(d.depth));

      logoGroup
        .append('circle')
        .attr('class', 'focus-pulse-ring')
        .attr('fill', 'none')
        .attr('stroke', getSignalColor(d.data.id))
        .attr('stroke-width', 1.4)
        .style('opacity', 0);

      logoGroup
        .append('image')
        .attr('href', d.data.logoUrl || DEFAULT_SPACE_AVATAR_IMAGE)
        .attr('preserveAspectRatio', 'xMidYMid slice')
        .attr('alt', `${d.data.name} logo`)
        .attr('clip-path', `url(#${clipId})`);
    });

    const runOrbitSignalFlow = () => {
      orbits.each(function (d: SpaceHierarchyNode, index: number) {
        if (d.depth === 0) return;
        const orbit = d3.select(this);
        const animate = () => {
          orbit.interrupt('signal-flow');
          orbit
            .transition('signal-flow')
            .duration(
              SIGNAL_FLOW_BASE_DURATION_MS + d.depth * 2200 + (index % 7) * 350,
            )
            .ease(d3.easeLinear)
            .attr('stroke-dashoffset', -48)
            .on('end', () => {
              orbit.attr('stroke-dashoffset', 0);
              animate();
            });
        };
        animate();
      });
    };

    const runFocusPulse = () => {
      const rings = logos.selectAll<SVGCircleElement, SpaceHierarchyNode>(
        'circle.focus-pulse-ring',
      );
      rings.interrupt('focus-pulse').style('opacity', 0);
      const selectedRing = logos
        .filter((d: SpaceHierarchyNode) => d === focus)
        .select<SVGCircleElement>('circle.focus-pulse-ring');
      const baseRadius = Number.parseFloat(selectedRing.attr('data-base-r'));
      if (!Number.isFinite(baseRadius) || baseRadius <= 0) return;
      const animate = () => {
        selectedRing.interrupt('focus-pulse');
        selectedRing
          .attr('r', baseRadius * 1.16)
          .style('opacity', 0.52)
          .transition('focus-pulse')
          .duration(FOCUS_PULSE_DURATION_MS)
          .ease(d3.easeCubicOut)
          .attr('r', baseRadius * 1.56)
          .style('opacity', 0)
          .on('end', animate);
      };
      animate();
    };

    svg.on('click', () => {
      if (focus.parent) zoom(focus.parent);
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

    function isVisible(d: SpaceHierarchyNode): boolean {
      if (!focus) return false;

      if (d === focus) return true;

      if (isDescendantOfOrSelf(d, focus)) {
        return true;
      }

      if (isAncestorOf(d, focus)) {
        return true;
      }

      let currentAncestor = focus.parent;
      while (currentAncestor) {
        if (isDescendantOfOrSelf(d, currentAncestor)) {
          return true;
        }
        currentAncestor = currentAncestor.parent;
      }

      return false;
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

    logos.each(function (d: SpaceHierarchyNode) {
      d3.select(this)
        .select('circle')
        .attr('fill', d === focus ? getSelectedSpaceFillColor() : '#000')
        .attr('stroke', getSelectedSpaceFillColor())
        .attr('stroke-width', getStrokeWidth(d.depth));
    });

    runOrbitSignalFlow();
    zoomTo(view);
    runFocusPulse();
    previousVisibleSpacesRef.current = '';
    notifyVisibleSpaces(focus);

    function zoom(target: SpaceHierarchyNode) {
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

      orbits
        .transition()
        .duration(VISUALIZATION_CONFIG.ZOOM_DURATION)
        .attr('stroke-opacity', (d: SpaceHierarchyNode) =>
          d === focus ? 0.72 : 0.38,
        )
        .attr('stroke-width', (d: SpaceHierarchyNode) =>
          d === focus ? 1.45 : 1.1,
        )
        .style('fill', 'transparent');

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
        runFocusPulse();
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
        .style('fill', 'transparent');

      logos
        .attr(
          'transform',
          (d: SpaceHierarchyNode) =>
            `translate(${(d.x! - v[0]) * k}, ${(d.y! - v[1]) * k})`,
        )
        .each(function (d: SpaceHierarchyNode) {
          const r = d.r! * k * VISUALIZATION_CONFIG.LOGO_RATIO;
          const clipId = `clip-${d.data.id}`;
          const glowClipId = `clip-glow-${d.data.id}`;

          d3.select(this)
            .select('circle')
            .attr('r', r)
            .attr('fill', d === focus ? getSelectedSpaceFillColor() : '#000')
            .attr('stroke', getSelectedSpaceFillColor())
            .attr('stroke-width', getStrokeWidth(d.depth));

          defs.select(`#${clipId} circle`).attr('r', r);
          defs.select(`#${glowClipId} circle`).attr('r', r * 1.35);

          d3.select(this)
            .select('image')
            .attr('x', -r)
            .attr('y', -r)
            .attr('width', r * 2)
            .attr('height', r * 2);

          d3.select(this)
            .select<SVGImageElement>('image.logo-glow')
            .attr('x', -(r * 1.35))
            .attr('y', -(r * 1.35))
            .attr('width', r * 2.7)
            .attr('height', r * 2.7)
            .style('opacity', d === focus ? 0.56 : 0.24);

          d3.select(this)
            .select<SVGCircleElement>('circle.focus-pulse-ring')
            .attr('r', r * 1.16)
            .attr('data-base-r', `${r}`);
        });
    }
  }, [data, currentSpaceId, resolvedTheme]);

  useEffect(() => {
    return () => {
      clearTooltipHideTimeout();
    };
  }, []);

  const canVisitSpace =
    Boolean(tooltip.spaceSlug) && tooltip.spaceId !== currentSpaceId;
  const canAddSpace = Boolean(tooltip.spaceSlug);
  const isHoveredSelectedSpace =
    tooltip.spaceId != null && tooltip.spaceId === focusRef.current?.data.id;
  const showHoverActions =
    enableHoverActions && Boolean(lang) && isHoveredSelectedSpace;
  const visitSpacePath = tooltip.spaceSlug
    ? `/${lang}/dho/${tooltip.spaceSlug}/agreements`
    : '#';
  const addSpacePath = tooltip.spaceSlug
    ? `/${lang}/dho/${tooltip.spaceSlug}/space/create`
    : '#';

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        ref={svgRef}
        className="h-auto w-full"
        role="img"
        aria-label="Space hierarchy visualization"
      />
      {tooltip.visible && (
        <div
          ref={tooltipRef}
          onMouseEnter={showHoverActions ? clearTooltipHideTimeout : undefined}
          onMouseLeave={showHoverActions ? scheduleTooltipHide : undefined}
          className={`absolute z-50 overflow-hidden border border-border/60 bg-background-2 shadow-xl ${
            showHoverActions
              ? 'w-52 rounded-xl p-0'
              : 'pointer-events-none rounded-lg px-2 py-1'
          }`}
          style={{
            left: `${tooltip.x + 6}px`,
            top: `${tooltip.y}px`,
            transform: 'translate(0, -50%)',
          }}
        >
          <div
            className={`bg-background-3 text-foreground ${
              showHoverActions
                ? 'border-b border-border/70 px-3 py-2 text-sm font-semibold'
                : 'rounded-md border border-border/60 px-2.5 py-1 text-xs font-semibold'
            }`}
          >
            {tooltip.text}
          </div>
          {showHoverActions ? (
            <div className="grid gap-1 p-1.5">
              <Link
                href={canVisitSpace ? visitSpacePath : '#'}
                aria-disabled={!canVisitSpace}
                className={`inline-flex min-h-9 items-center rounded-md border px-2.5 text-sm font-medium transition-colors ${
                  canVisitSpace
                    ? 'border-border/70 bg-background-2 text-foreground hover:border-border hover:bg-background-3 hover:text-accent-11'
                    : 'pointer-events-none cursor-not-allowed border-border/50 bg-background-2 text-muted-foreground/80'
                }`}
              >
                {actionLabels?.visitSpace ?? 'Visit Space'}
              </Link>
              <Link
                href={canAddSpace ? addSpacePath : '#'}
                aria-disabled={!canAddSpace}
                className={`inline-flex min-h-9 items-center rounded-md border px-2.5 text-sm font-medium transition-colors ${
                  canAddSpace
                    ? 'border-border/70 bg-background-2 text-foreground hover:border-border hover:bg-background-3 hover:text-accent-11'
                    : 'pointer-events-none cursor-not-allowed border-border/50 bg-background-2 text-muted-foreground/80'
                }`}
              >
                {actionLabels?.addSpace ?? 'Add Space'}
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

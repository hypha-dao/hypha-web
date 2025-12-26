'use client';

import { useEffect, useRef } from 'react';
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
};

const VISUALIZATION_CONFIG = {
  BASE_RADIUS: 420,
  DEPTH_SCALE: 0.45,
  ORBIT_RATIO: 0.9,
  LOGO_RATIO: 0.25,
  ZOOM_DURATION: 800,
  WIDTH: 900,
  HEIGHT: 900,
} as const;

export function SpaceVisualization({
  data,
  currentSpaceId,
  onVisibleSpacesChange,
}: Props) {
  const { resolvedTheme } = useTheme();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const previousVisibleSpacesRef = useRef<string>('');
  const onVisibleSpacesChangeRef = useRef(onVisibleSpacesChange);
  const focusRef = useRef<d3.HierarchyNode<SpaceNode> | null>(null);
  const themeRef = useRef(resolvedTheme);
  const savedFocusIdRef = useRef<number | null>(null);

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
    if (!svgRef.current || !focusRef.current) return;

    const getOrbitFillColor = () =>
      themeRef.current === 'dark' ? '#2A2A2A' : '#E5E5E5';

    const svg = d3.select(svgRef.current);
    const orbits = svg.selectAll<SVGCircleElement, SpaceHierarchyNode>(
      'circle.orbit',
    );

    orbits.each(function (d: SpaceHierarchyNode) {
      if (d === focusRef.current) {
        d3.select(this).style('fill', getOrbitFillColor());
      }
    });
  }, [resolvedTheme]);

  useEffect(() => {
    if (!svgRef.current) return;

    const getOrbitFillColor = () =>
      themeRef.current === 'dark' ? '#2A2A2A' : '#E5E5E5';

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
      const children = d.children.map((child) => child as SpaceHierarchyNode);
      const n = children.length;

      const calculateMinOrbitRadius = (childRadii: number[]): number => {
        const maxChildRadius = Math.max(...childRadii);
        const baseMinOrbitRadius = parentLogoRadius + maxChildRadius;

        if (n <= 1) {
          return baseMinOrbitRadius;
        }

        const minOrbitRadiusForSpacing = maxChildRadius / Math.sin(Math.PI / n);

        return Math.max(baseMinOrbitRadius, minOrbitRadiusForSpacing);
      };

      children.forEach((childNode) => {
        const minOrbitRadius = parentLogoRadius + childNode.r!;
        const maxOrbit = node.r! - childNode.r!;

        if (minOrbitRadius > maxOrbit) {
          childNode.r = (node.r! - parentLogoRadius) / 2;
        }
      });

      const childRadii = children.map((c) => c.r!);
      let minOrbitRadius = calculateMinOrbitRadius(childRadii);
      let maxOrbit = node.r! - Math.max(...childRadii);

      if (minOrbitRadius > maxOrbit) {
        let minChildRadius = 0;
        let maxChildRadius = Math.max(...childRadii);
        let bestChildRadius = maxChildRadius;
        const tolerance = 0.1;

        while (maxChildRadius - minChildRadius > tolerance) {
          const testChildRadius = (minChildRadius + maxChildRadius) / 2;
          const testRadii = children.map(() => testChildRadius);
          const testMinOrbitRadius = calculateMinOrbitRadius(testRadii);
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
        minOrbitRadius = calculateMinOrbitRadius(adjustedRadii);
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
          const safeOrbitRadius = maxChildRadius / Math.sin(Math.PI / n);
          orbitRadius = Math.max(
            safeOrbitRadius,
            parentLogoRadius + maxChildRadius,
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
        d === focus ? getOrbitFillColor() : 'transparent',
      )
      .attr('stroke', '#8F8F8F')
      .attr('stroke-width', 1.2)
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
      .style('pointer-events', 'none');

    logos
      .append('circle')
      .attr('fill', (d: SpaceHierarchyNode) =>
        d === focus ? '#808080' : '#000',
      );

    logos
      .append('image')
      .attr('href', (d) => d.data.logoUrl || DEFAULT_SPACE_AVATAR_IMAGE)
      .attr('preserveAspectRatio', 'xMidYMid slice')
      .attr('alt', (d) => `${d.data.name} logo`)
      .style('filter', (d: SpaceHierarchyNode) =>
        d === focus ? 'none' : 'grayscale(100%)',
      );

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

    function isVisible(d: SpaceHierarchyNode): boolean {
      return d === focus || isDescendantOf(d, focus);
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
        .attr('fill', d === focus ? '#808080' : '#000');
      d3.select(this)
        .select('image')
        .style('filter', d === focus ? 'none' : 'grayscale(100%)');
    });

    zoomTo(view);
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
        .style('fill', (d: SpaceHierarchyNode) =>
          d === focus ? getOrbitFillColor() : 'transparent',
        );

      logos.each(function (d: SpaceHierarchyNode) {
        d3.select(this)
          .select('circle')
          .transition()
          .duration(VISUALIZATION_CONFIG.ZOOM_DURATION)
          .attr('fill', d === focus ? '#808080' : '#000');
        d3.select(this)
          .select('image')
          .transition()
          .duration(VISUALIZATION_CONFIG.ZOOM_DURATION)
          .style('filter', d === focus ? 'none' : 'grayscale(100%)');
      });

      transition.on('end', () => {
        notifyVisibleSpaces(focus);
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
          d === focus ? getOrbitFillColor() : 'transparent',
        );

      logos
        .attr(
          'transform',
          (d: SpaceHierarchyNode) =>
            `translate(${(d.x! - v[0]) * k}, ${(d.y! - v[1]) * k})`,
        )
        .each(function (d: SpaceHierarchyNode) {
          const r = d.r! * k * VISUALIZATION_CONFIG.LOGO_RATIO;

          d3.select(this)
            .select('circle')
            .attr('r', r)
            .attr('fill', d === focus ? '#808080' : '#000');

          d3.select(this)
            .select('image')
            .attr('x', -r)
            .attr('y', -r)
            .attr('width', r * 2)
            .attr('height', r * 2)
            .style('clip-path', `circle(${r}px at ${r}px ${r}px)`)
            .style('filter', d === focus ? 'none' : 'grayscale(100%)');
        });
    }
  }, [data, currentSpaceId, resolvedTheme]);

  return (
    <svg
      ref={svgRef}
      className="w-full h-auto"
      role="img"
      aria-label="Space hierarchy visualization"
    />
  );
}

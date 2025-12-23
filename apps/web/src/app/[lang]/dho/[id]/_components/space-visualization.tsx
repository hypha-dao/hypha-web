'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

type SpaceNode = {
  id: number;
  name: string;
  logoUrl?: string | null;
  children?: SpaceNode[];
};

type SpaceHierarchyNode = d3.HierarchyNode<SpaceNode> & {
  r?: number;
};

type Props = {
  data: SpaceNode;
};

const DEFAULT_LOGO = '/placeholder/space-avatar-image.svg';

const BASE_RADIUS = 420;
const DEPTH_SCALE = 0.45;
const ORBIT_RATIO = 0.9;
const LOGO_RATIO = 0.25;
const ZOOM_DURATION = 800;

export function SpaceVisualization({ data }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 900;
    const height = 900;

    const root = d3.hierarchy<SpaceNode>(data) as SpaceHierarchyNode;

    root.each((d) => {
      (d as SpaceHierarchyNode).r =
        BASE_RADIUS * Math.pow(DEPTH_SCALE, d.depth);
    });

    root.x = 0;
    root.y = 0;

    root.eachBefore((d) => {
      if (!d.children) return;

      const step = (2 * Math.PI) / d.children.length;
      const node = d as SpaceHierarchyNode;

      const parentLogoRadius = node.r! * LOGO_RATIO;

      d.children.forEach((child, i) => {
        const angle = i * step;
        const childNode = child as SpaceHierarchyNode;

        let minOrbitRadius = parentLogoRadius + childNode.r!;
        let maxOrbit = node.r! - childNode.r!;

        if (minOrbitRadius > maxOrbit) {
          childNode.r = (node.r! - parentLogoRadius) / 2;
          minOrbitRadius = parentLogoRadius + childNode.r!;
          maxOrbit = node.r! - childNode.r!;
        }

        const availableOrbit = maxOrbit - minOrbitRadius;
        const orbitRadius = minOrbitRadius + availableOrbit * ORBIT_RATIO;

        child.x = d.x! + Math.cos(angle) * orbitRadius;
        child.y = d.y! + Math.sin(angle) * orbitRadius;
      });
    });

    let focus = root;
    let view: [number, number, number] = [0, 0, root.r! * 2];

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
      .attr('fill', 'transparent')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.2)
      .style('pointer-events', (d) => (d.children ? 'all' : 'none'))
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

    logos.append('circle').attr('fill', '#000');

    logos
      .append('image')
      .attr('href', (d) => d.data.logoUrl || DEFAULT_LOGO)
      .attr('preserveAspectRatio', 'xMidYMid slice');

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

    orbits.style('opacity', (d: SpaceHierarchyNode) => (isVisible(d) ? 1 : 0));
    logos.style('opacity', (d: SpaceHierarchyNode) => (isVisible(d) ? 1 : 0));
    orbits.style('display', (d: SpaceHierarchyNode) =>
      isVisible(d) ? 'block' : 'none',
    );
    logos.style('display', (d: SpaceHierarchyNode) =>
      isVisible(d) ? 'block' : 'none',
    );

    zoomTo(view);

    function zoom(target: SpaceHierarchyNode) {
      focus = target;

      const transition = svg
        .transition()
        .duration(ZOOM_DURATION)
        .tween('zoom', () => {
          const i = d3.interpolateZoom(view, [
            focus.x!,
            focus.y!,
            focus.r! * 2,
          ]);
          return (t) => zoomTo(i(t));
        });

      transition
        .selectAll<SVGElement, SpaceHierarchyNode>('circle, g.logo')
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
        .attr('r', (d: SpaceHierarchyNode) => d.r! * k);

      logos
        .attr(
          'transform',
          (d: SpaceHierarchyNode) =>
            `translate(${(d.x! - v[0]) * k}, ${(d.y! - v[1]) * k})`,
        )
        .each(function (d: SpaceHierarchyNode) {
          const r = d.r! * k * LOGO_RATIO;

          d3.select(this).select('circle').attr('r', r);

          d3.select(this)
            .select('image')
            .attr('x', -r)
            .attr('y', -r)
            .attr('width', r * 2)
            .attr('height', r * 2)
            .style('clip-path', `circle(${r}px at ${r}px ${r}px)`);
        });
    }
  }, [data]);

  return <svg ref={svgRef} className="w-full h-auto" />;
}

'use client';

import { useEffect, useId, useRef, useState } from 'react';
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
  /** Extra classes on the outer container (e.g. full-bleed map in Ecosystem layout). */
  className?: string;
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

const FALLBACK_ACCENT_RGB: [number, number, number] = [99, 102, 241];

function rgbFromCssColor(css: string): [number, number, number] | null {
  const m = css.match(
    /^rgba?\(\s*([\d.]+)\s*(?:,|\s)\s*([\d.]+)\s*(?:,|\s)\s*([\d.]+)/,
  );
  if (!m) return null;
  return [
    Math.round(Number(m[1])),
    Math.round(Number(m[2])),
    Math.round(Number(m[3])),
  ];
}

/** Resolves `--space-accent` from the layout (banner-driven) for map tints and halos. */
function readSpaceAccentRgb(): [number, number, number] {
  if (typeof window === 'undefined') return FALLBACK_ACCENT_RGB;
  const probe = document.createElement('span');
  probe.hidden = true;
  probe.style.color = 'var(--space-accent, rgb(99, 102, 241))';
  document.documentElement.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  return rgbFromCssColor(computed) ?? FALLBACK_ACCENT_RGB;
}

function mixRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  const u = Math.min(1, Math.max(0, t));
  return [
    Math.round(a[0] * (1 - u) + b[0] * u),
    Math.round(a[1] * (1 - u) + b[1] * u),
    Math.round(a[2] * (1 - u) + b[2] * u),
  ];
}

function rgbCs(...parts: [number, number, number]): string {
  return `${parts[0]} ${parts[1]} ${parts[2]}`;
}

function rgbA(parts: [number, number, number], alpha: number): string {
  return `rgb(${rgbCs(...parts)} / ${alpha})`;
}

export function SpaceVisualization({
  data,
  currentSpaceId,
  onVisibleSpacesChange,
  className,
}: Props) {
  const { resolvedTheme } = useTheme();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState<number>(
    VISUALIZATION_CONFIG.WIDTH,
  );
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
  }>({ visible: false, x: 0, y: 0, text: '' });
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const reactId = useId().replace(/:/g, '');
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setPrefersReducedMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

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
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0) return;
      // In flex layouts `clientHeight` can be 0 on the first pass; use width so the
      // first paint matches the square map region, then correct when height arrives.
      const hEff = h > 0 ? h : w;
      const inner = Math.min(w, hEff);
      const s = Math.round(Math.max(280, Math.min(1200, inner)));
      setCanvasSize(s);
    };
    measure();
    const ro = new ResizeObserver(() => {
      measure();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

    const accentRgb = readSpaceAccentRgb();
    const getSelectedSpaceFillColor = () =>
      themeRef.current === 'dark' ? '#1a1a1a' : '#ffffff';
    const getLogoFaceFill = (isFocus: boolean) => {
      if (isFocus) return getSelectedSpaceFillColor();
      return themeRef.current === 'dark' ? 'rgb(22 24 28)' : 'rgb(246 246 249)';
    };
    const isDark = themeRef.current === 'dark';
    const orbitLineMuted = isDark
      ? 'rgb(175 180 200 / 0.36)'
      : 'rgb(100 100 120 / 0.28)';
    const orbitLineActive = rgbA(accentRgb, isDark ? 0.52 : 0.42);
    const focusFill = rgbA(accentRgb, isDark ? 0.14 : 0.09);
    const parentFill = isDark ? 'rgb(255 255 255 / 0.04)' : 'rgb(0 0 0 / 0.03)';

    const svg = d3.select(svgRef.current);
    const f = focusRef.current;
    const fParent = f?.parent;
    const orbits = svg.selectAll<SVGCircleElement, SpaceHierarchyNode>(
      'circle.orbit',
    );

    orbits.each(function (d: SpaceHierarchyNode) {
      const isFocus = d === f;
      d3.select(this)
        .attr('stroke', isFocus ? orbitLineActive : orbitLineMuted)
        .attr('stroke-width', isFocus ? 1.7 : 1.15);
      d3.select(this).style(
        'fill',
        d === f ? focusFill : d === fParent ? parentFill : 'transparent',
      );
    });

    const getStrokeWidth = (depth: number): number => {
      return (
        VISUALIZATION_CONFIG.LOGO_STROKE_WIDTH *
        Math.pow(VISUALIZATION_CONFIG.STROKE_WIDTH_SCALE, depth)
      );
    };

    const logos = svg.selectAll<SVGGElement, SpaceHierarchyNode>('g.logo');
    logos.each(function (d: SpaceHierarchyNode) {
      const sw = getStrokeWidth(d.depth);
      d3.select(this)
        .select('circle.logo-face-fill')
        .attr('fill', getLogoFaceFill(d === f))
        .attr('stroke', 'none');
      d3.select(this)
        .select('circle.logo-face-stroke')
        .attr('fill', 'none')
        .attr('stroke', getSelectedSpaceFillColor())
        .attr('stroke-width', sw);
    });
  }, [resolvedTheme]);

  useEffect(() => {
    if (!svgRef.current) return;

    const accentRgb = readSpaceAccentRgb();
    const getSelectedSpaceFillColor = () =>
      themeRef.current === 'dark' ? '#1a1a1a' : '#ffffff';
    const getLogoFaceFill = (isFocus: boolean) => {
      if (isFocus) return getSelectedSpaceFillColor();
      return themeRef.current === 'dark' ? 'rgb(22 24 28)' : 'rgb(246 246 249)';
    };
    const isDark = themeRef.current === 'dark';
    const accentStroke = rgbA(accentRgb, isDark ? 0.45 : 0.5);
    const orbitLineMuted = isDark
      ? 'rgb(175 180 200 / 0.36)'
      : 'rgb(100 100 120 / 0.28)';
    const orbitLineActive = rgbA(accentRgb, isDark ? 0.52 : 0.42);

    const getStrokeWidth = (depth: number): number => {
      return (
        VISUALIZATION_CONFIG.LOGO_STROKE_WIDTH *
        Math.pow(VISUALIZATION_CONFIG.STROKE_WIDTH_SCALE, depth)
      );
    };

    const width = canvasSize;
    const height = canvasSize;
    const maxR = (Math.sqrt(2) / 2) * Math.min(width, height);
    const idPrefix = `sv-${reactId}`;

    const getOrbitStroke = (d: SpaceHierarchyNode) =>
      d === focus ? orbitLineActive : orbitLineMuted;
    const getOrbitStrokeW = (d: SpaceHierarchyNode) =>
      d === focus ? 1.7 : 1.15;

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

    const defs = svg.append('defs').attr('class', 'map-filters');

    const bgGrad = defs
      .append('radialGradient')
      .attr('id', `${idPrefix}-field`)
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '58%');
    /* Field fill stays neutral so saturated space accents do not wash the canvas magenta/pink */
    const bgInnerDark: [number, number, number] = [32, 33, 42];
    const bgMidDark: [number, number, number] = [18, 19, 28];
    const bgOuterDark: [number, number, number] = [10, 11, 18];
    const bgInnerLight: [number, number, number] = [255, 255, 255];
    const bgMidLight: [number, number, number] = [245, 246, 250];
    const bgOuterLight: [number, number, number] = [232, 234, 242];

    if (isDark) {
      bgGrad
        .append('stop')
        .attr('offset', '0%')
        .attr('stop-color', `rgb(${rgbCs(...bgInnerDark)})`);
      bgGrad
        .append('stop')
        .attr('offset', '55%')
        .attr('stop-color', `rgb(${rgbCs(...bgMidDark)})`);
      bgGrad
        .append('stop')
        .attr('offset', '100%')
        .attr('stop-color', `rgb(${rgbCs(...bgOuterDark)})`);
    } else {
      bgGrad
        .append('stop')
        .attr('offset', '0%')
        .attr('stop-color', `rgb(${rgbCs(...bgInnerLight)})`);
      bgGrad
        .append('stop')
        .attr('offset', '45%')
        .attr('stop-color', `rgb(${rgbCs(...bgMidLight)})`);
      bgGrad
        .append('stop')
        .attr('offset', '100%')
        .attr('stop-color', `rgb(${rgbCs(...bgOuterLight)})`);
    }

    const fLogo = defs
      .append('filter')
      .attr('id', `${idPrefix}-logoCard`)
      .attr('x', '-80%')
      .attr('y', '-80%')
      .attr('width', '260%')
      .attr('height', '260%');
    fLogo
      .append('feDropShadow')
      .attr('in', 'SourceGraphic')
      .attr('dx', 0)
      .attr('dy', 3.5)
      .attr('stdDeviation', 5.5)
      .attr('flood-color', isDark ? 'rgb(0 0 0 / 0.55)' : 'rgb(0 0 0 / 0.2)')
      .attr('flood-opacity', 1)
      .attr('result', 'sDrop');
    fLogo
      .append('feDropShadow')
      .attr('in', 'SourceGraphic')
      .attr('dx', 0)
      .attr('dy', 0)
      .attr('stdDeviation', 9)
      .attr('flood-color', rgbA(accentRgb, isDark ? 0.38 : 0.22))
      .attr('flood-opacity', 0.9)
      .attr('result', 'sGlow');
    fLogo
      .append('feMerge')
      .selectAll('feMergeNode')
      .data(['sDrop', 'sGlow', 'SourceGraphic'])
      .enter()
      .append('feMergeNode')
      .attr('in', (n) => n);

    const vGrad = defs
      .append('radialGradient')
      .attr('id', `${idPrefix}-vignette`)
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '65%');
    vGrad
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', isDark ? 'rgb(0 0 0 / 0)' : 'rgb(0 0 0 / 0)');
    vGrad
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', isDark ? 'rgb(0 0 0 / 0.2)' : 'rgb(0 0 0 / 0.06)');

    const focusTintA = rgbA(accentRgb, isDark ? 0.13 : 0.08);
    const orbitParentTint = isDark
      ? 'rgb(255 255 255 / 0.04)'
      : 'rgb(0 0 0 / 0.03)';

    const orbitFillForNode = (d: SpaceHierarchyNode, f: SpaceHierarchyNode) => {
      if (d === f) return focusTintA;
      if (d === f.parent) return orbitParentTint;
      return 'transparent';
    };

    const ringGrad = defs
      .append('linearGradient')
      .attr('id', `${idPrefix}-ring`)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '100%');
    ringGrad
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', rgbA(accentRgb, isDark ? 0.48 : 0.45));
    ringGrad
      .append('stop')
      .attr('offset', '100%')
      .attr(
        'stop-color',
        rgbA(mixRgb(accentRgb, [255, 255, 255], 0.35), isDark ? 0.22 : 0.28),
      );

    const bgLayer = svg
      .append('g')
      .attr('class', 'map-bg')
      .style('pointer-events', 'none');
    bgLayer
      .append('rect')
      .attr('x', -width / 2)
      .attr('y', -height / 2)
      .attr('width', width)
      .attr('height', height)
      .attr('fill', `url(#${idPrefix}-field)`);
    /* Very subtle specular + vignette so the field reads "premium" not flat */
    bgLayer
      .append('circle')
      .attr('cx', 0)
      .attr('cy', -height * 0.04)
      .attr('r', maxR * 0.5)
      .attr('fill', rgbA(accentRgb, isDark ? 0.06 : 0.12));
    bgLayer
      .append('rect')
      .attr('x', -width / 2)
      .attr('y', -height / 2)
      .attr('width', width)
      .attr('height', height)
      .attr('fill', `url(#${idPrefix}-vignette)`)
      .style('pointer-events', 'none');

    const ringRadii = [0.18, 0.34, 0.5, 0.66, 0.85].map((t) => maxR * t);
    bgLayer
      .selectAll('circle.map-ring')
      .data(ringRadii)
      .join('circle')
      .attr('class', 'map-ring')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', (r) => r)
      .attr('fill', 'none')
      .attr('stroke', isDark ? rgbA(accentRgb, 0.09) : 'rgb(0 0 0 / 0.055)')
      .attr('stroke-width', 0.75)
      .attr('vector-effect', 'non-scaling-stroke');

    if (!prefersReducedMotion) {
      const pulseR = [0.22, 0.5, 0.78] as const;
      bgLayer
        .selectAll('circle.pulse')
        .data(pulseR)
        .join('circle')
        .attr('class', 'pulse')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', (d) => maxR * d)
        .attr('fill', 'none')
        .attr('stroke', accentStroke)
        .attr('stroke-width', 0.5)
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('opacity', 0.35)
        .each(function (_d, i) {
          const el = this;
          d3.select(el)
            .append('animate')
            .attr('attributeName', 'opacity')
            .attr('values', '0.1;0.4;0.1')
            .attr('keyTimes', '0;0.5;1')
            .attr('dur', i === 0 ? '4.5s' : i === 1 ? '5.8s' : '6.6s')
            .attr('repeatCount', 'indefinite');
        });
    } else {
      const guideCount = 6;
      for (let i = 0; i < guideCount; i += 1) {
        const angle = (i * 2 * Math.PI) / guideCount;
        const x1 = 0.1 * maxR * Math.cos(angle);
        const y1 = 0.1 * maxR * Math.sin(angle);
        const x2 = maxR * 0.94 * Math.cos(angle);
        const y2 = maxR * 0.94 * Math.sin(angle);
        bgLayer
          .append('line')
          .attr('x1', x1)
          .attr('y1', y1)
          .attr('x2', x2)
          .attr('y2', y2)
          .attr('stroke', isDark ? rgbA(accentRgb, 0.05) : 'rgb(0 0 0 / 0.035)')
          .attr('stroke-width', 0.35);
      }
    }

    const g = svg.append('g').attr('class', 'map-graph');
    const focusRingG = g
      .append('g')
      .attr('class', 'map-focus-orbit-halo')
      .style('pointer-events', 'none');
    const focusOrbitRing = focusRingG
      .append('circle')
      .attr('class', 'map-focus-orbit-ring')
      .attr('fill', 'none')
      .attr('stroke', `url(#${idPrefix}-ring)`)
      .attr('stroke-width', 1.1)
      .attr('vector-effect', 'non-scaling-stroke')
      .attr('opacity', 0.85);

    const orbits = g
      .selectAll<SVGCircleElement, SpaceHierarchyNode>('circle.orbit')
      .data(root.descendants() as SpaceHierarchyNode[])
      .join('circle')
      .attr('class', 'orbit')
      .style('fill', (d: SpaceHierarchyNode) => orbitFillForNode(d, focus))
      .attr('stroke', getOrbitStroke)
      .attr('stroke-width', getOrbitStrokeW)
      .attr('vector-effect', 'non-scaling-stroke')
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
      .on('mouseenter', function (event, d: SpaceHierarchyNode) {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setTooltip((prev) => ({
          ...prev,
          visible: true,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          text: d.data.name,
        }));
      })
      .on('mousemove', function (event) {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setTooltip((prev) => ({
          ...prev,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }));
      })
      .on('mouseleave', function () {
        setTooltip((prev) => ({ ...prev, visible: false }));
      })
      .on('click', (event, d) => {
        if (focus !== d) {
          event.stopPropagation();
          zoom(d);
        }
      });

    logos.each(function (d: SpaceHierarchyNode) {
      const logoGroup = d3.select(this);
      const clipId = `clip-${idPrefix}-${d.data.id}`;

      const clipPath = defs.append('clipPath').attr('id', clipId);

      clipPath.append('circle').attr('r', 1);

      const sw0 = getStrokeWidth(d.depth);
      /* Outer radius (stroke centerline); inner fill radius so fill meets stroke inner edge */
      const rOuter0 =
        d.r! * (width / view[2]) * VISUALIZATION_CONFIG.LOGO_RATIO;
      const rInner0 = Math.max(0, rOuter0 - sw0 / 2);

      const logoBody = logoGroup
        .append('g')
        .attr('class', 'logo-body')
        .attr('filter', `url(#${idPrefix}-logoCard)`);

      logoBody
        .append('circle')
        .attr('class', 'logo-face-fill')
        .attr('fill', getLogoFaceFill(d === focus))
        .attr('stroke', 'none')
        .attr('r', rInner0);

      logoBody
        .append('image')
        .attr('href', d.data.logoUrl || DEFAULT_SPACE_AVATAR_IMAGE)
        .attr('preserveAspectRatio', 'xMidYMid slice')
        .attr('alt', `${d.data.name} logo`)
        .attr('clip-path', `url(#${clipId})`)
        .attr('x', -rInner0)
        .attr('y', -rInner0)
        .attr('width', rInner0 * 2)
        .attr('height', rInner0 * 2);

      logoGroup
        .append('circle')
        .attr('class', 'logo-face-stroke')
        .attr('fill', 'none')
        .attr('stroke', getSelectedSpaceFillColor())
        .attr('stroke-width', sw0)
        .attr('r', rOuter0);
    });

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
      const swU = getStrokeWidth(d.depth);
      d3.select(this)
        .select('circle.logo-face-fill')
        .attr('fill', getLogoFaceFill(d === focus))
        .attr('stroke', 'none');
      d3.select(this)
        .select('circle.logo-face-stroke')
        .attr('fill', 'none')
        .attr('stroke', getSelectedSpaceFillColor())
        .attr('stroke-width', swU);
    });

    zoomTo(view);
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
        .style('fill', (d: SpaceHierarchyNode) => orbitFillForNode(d, focus));

      logos.each(function (d: SpaceHierarchyNode) {
        const swT = getStrokeWidth(d.depth);
        d3.select(this)
          .select('circle.logo-face-fill')
          .transition()
          .duration(VISUALIZATION_CONFIG.ZOOM_DURATION)
          .attr('fill', getLogoFaceFill(d === focus));
        d3.select(this)
          .select('circle.logo-face-stroke')
          .transition()
          .duration(VISUALIZATION_CONFIG.ZOOM_DURATION)
          .attr('fill', 'none')
          .attr('stroke', getSelectedSpaceFillColor())
          .attr('stroke-width', swT);
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
        .style('fill', (d: SpaceHierarchyNode) => orbitFillForNode(d, focus));

      const fOrbitR = focus.r! * k;
      const px = (focus.x! - v[0]) * k;
      const py = (focus.y! - v[1]) * k;
      focusOrbitRing
        .attr('transform', `translate(${px},${py})`)
        .attr('r', fOrbitR + 2.5);

      logos
        .attr(
          'transform',
          (d: SpaceHierarchyNode) =>
            `translate(${(d.x! - v[0]) * k}, ${(d.y! - v[1]) * k})`,
        )
        .each(function (d: SpaceHierarchyNode) {
          const rOuter = d.r! * k * VISUALIZATION_CONFIG.LOGO_RATIO;
          const swZ = getStrokeWidth(d.depth);
          const rInner = Math.max(0, rOuter - swZ / 2);
          const clipId = `clip-${idPrefix}-${d.data.id}`;

          d3.select(this)
            .select('circle.logo-face-fill')
            .attr('r', rInner)
            .attr('fill', getLogoFaceFill(d === focus))
            .attr('stroke', 'none');

          d3.select(this)
            .select('circle.logo-face-stroke')
            .attr('r', rOuter)
            .attr('fill', 'none')
            .attr('stroke', getSelectedSpaceFillColor())
            .attr('stroke-width', swZ);

          defs.select(`#${clipId} circle`).attr('r', rInner);

          d3.select(this)
            .select('image')
            .attr('x', -rInner)
            .attr('y', -rInner)
            .attr('width', rInner * 2)
            .attr('height', rInner * 2);
        });
    }
  }, [
    data,
    currentSpaceId,
    resolvedTheme,
    canvasSize,
    prefersReducedMotion,
    reactId,
  ]);

  return (
    <div
      ref={containerRef}
      className={`relative min-h-0 w-full max-w-full flex-1 ${className ?? ''}`}
    >
      <svg
        ref={svgRef}
        className="block h-full w-full min-h-0 max-h-full max-w-full"
        role="img"
        aria-label="Space hierarchy visualization"
      />
      {tooltip.visible && (
        <div
          ref={tooltipRef}
          className="absolute z-50 px-3 py-2 text-sm font-medium text-card-foreground bg-popover border-2 border-border rounded-lg shadow-lg pointer-events-none whitespace-nowrap"
          style={{
            left: `${tooltip.x + 10}px`,
            top: `${tooltip.y + 10}px`,
            transform: 'translate(0, -50%)',
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

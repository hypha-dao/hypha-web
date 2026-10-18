'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import * as d3 from 'd3';
import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  type Person,
  type Space,
} from '@hypha-platform/core/client';
import {
  getAgentAvatarInitials,
  useMobilizedAiAgents,
  useTransfers,
  type TransferWithEntity,
} from '@hypha-platform/epics';
import { cn } from '@hypha-platform/ui-utils';

import { useMembers } from '@web/hooks/use-members';

import type { VisibleSpace } from './types';
import './mycelium-ecosystem.css';

export type MyceliumHierarchyNode = {
  name: string;
  logoUrl?: string | null;
  id: number;
  slug?: string;
  children?: MyceliumHierarchyNode[];
};

type SpaceNode = {
  id: number;
  name: string;
  slug?: string;
  logoUrl?: string | null;
  children: SpaceNode[];
};

type Role = 'parent' | 'focus' | 'child' | 'deeper';

type PlacedNode = {
  id: number;
  name: string;
  slug?: string;
  logoUrl?: string | null;
  x: number;
  y: number;
  r: number;
  role: Role;
  hasHiddenChildren: boolean;
};

type PlacedLink = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  bend: number;
};

const MAX_FLOWS = 8;
/** Avatar diameter plus a little air, so member chips do not stack. */
const CHIP_SEP = 26;

function toSpaceNode(node: MyceliumHierarchyNode): SpaceNode {
  return {
    id: node.id,
    name: node.name,
    slug: node.slug,
    logoUrl: node.logoUrl,
    children: (node.children ?? []).map(toSpaceNode),
  };
}

function findNode(node: SpaceNode, id: number): SpaceNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function findByTitle(node: SpaceNode, title: string): SpaceNode | null {
  if (node.name.trim().toLowerCase() === title.trim().toLowerCase()) {
    return node;
  }
  for (const child of node.children) {
    const found = findByTitle(child, title);
    if (found) return found;
  }
  return null;
}

function pathTo(node: SpaceNode, id: number): SpaceNode[] | null {
  if (node.id === id) return [node];
  for (const child of node.children) {
    const path = pathTo(child, id);
    if (path) return [node, ...path];
  }
  return null;
}

function prune(node: SpaceNode, depth: number): SpaceNode {
  if (depth <= 0) return { ...node, children: [] };
  return {
    ...node,
    children: node.children.map((child) => prune(child, depth - 1)),
  };
}

function shorten(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  trimStart: number,
  trimEnd: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x1: x1 + (dx / len) * trimStart,
    y1: y1 + (dy / len) * trimStart,
    x2: x2 - (dx / len) * trimEnd,
    y2: y2 - (dy / len) * trimEnd,
  };
}

function arrowHead(x1: number, y1: number, x2: number, y2: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 12;
  const spread = 0.42;
  const leftX = x2 - Math.cos(angle - spread) * size;
  const leftY = y2 - Math.sin(angle - spread) * size;
  const rightX = x2 - Math.cos(angle + spread) * size;
  const rightY = y2 - Math.sin(angle + spread) * size;
  return `M${x2} ${y2} L${leftX} ${leftY} L${rightX} ${rightY} Z`;
}

/** Filled arrow sitting on the curve, pointing from the start toward the end. */
function arrowOnCurve(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bend: number,
) {
  const control = curveControl(x1, y1, x2, y2, bend);
  const t = 0.68;
  const u = 1 - t;
  const x = u * u * x1 + 2 * u * t * control.x + t * t * x2;
  const y = u * u * y1 + 2 * u * t * control.y + t * t * y2;
  const dx = 2 * u * (control.x - x1) + 2 * t * (x2 - control.x);
  const dy = 2 * u * (control.y - y1) + 2 * t * (y2 - control.y);
  const len = Math.hypot(dx, dy) || 1;
  return arrowHead(x - dx / len, y - dy / len, x, y);
}

function useFrameSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 480, height: 360 });
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const apply = () => {
      const next = {
        width: Math.max(240, Math.round(node.clientWidth)),
        height: Math.max(220, Math.round(node.clientHeight)),
      };
      setSize((current) =>
        current.width === next.width && current.height === next.height
          ? current
          : next,
      );
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, size };
}

function curveControl(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bend: number,
) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: mx + (-dy / len) * bend,
    y: my + (dx / len) * bend,
  };
}

function hyphaPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bend: number,
) {
  const control = curveControl(x1, y1, x2, y2, bend);
  return `M${x1},${y1} Q${control.x},${control.y} ${x2},${y2}`;
}

function separateNodes(nodes: PlacedNode[], width: number, height: number) {
  for (let pass = 0; pass < 28; pass += 1) {
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        if (!a || !b) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        const min = a.r + b.r + 20;
        if (dist >= min) continue;
        if (dist < 0.01) {
          dx = 1;
          dy = 0;
          dist = 1;
        }
        const push = (min - dist) / 2;
        const ux = dx / dist;
        const uy = dy / dist;
        const aFixed = a.role === 'focus';
        const bFixed = b.role === 'focus';
        if (!aFixed) {
          a.x -= ux * (bFixed ? push * 2 : push);
          a.y -= uy * (bFixed ? push * 2 : push);
        }
        if (!bFixed) {
          b.x += ux * (aFixed ? push * 2 : push);
          b.y += uy * (aFixed ? push * 2 : push);
        }
      }
    }
    for (const node of nodes) {
      if (node.role === 'focus') continue;
      const marginX = node.r + 64;
      const marginY = node.r + 28;
      node.x = Math.min(width - marginX, Math.max(marginX, node.x));
      node.y = Math.min(height - marginY, Math.max(node.r + 10, node.y));
    }
  }
}

function retargetLinks(nodes: PlacedNode[], links: PlacedLink[]): PlacedLink[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const focus = nodes.find((node) => node.role === 'focus');
  return links.flatMap((link) => {
    const sourceId = link.id.startsWith('parent-')
      ? focus?.id
      : Number(link.id.split('-')[0]);
    const targetId = link.id.startsWith('parent-')
      ? Number(link.id.slice('parent-'.length))
      : Number(link.id.split('-')[1]);
    const source = sourceId != null ? byId.get(sourceId) : undefined;
    const target = targetId != null ? byId.get(targetId) : undefined;
    if (!source || !target) return [];
    return [
      {
        id: link.id,
        ...shorten(
          source.x,
          source.y,
          target.x,
          target.y,
          source.r + 2,
          target.r + 2,
        ),
        bend: link.bend,
      },
    ];
  });
}

function clearTop(angles: number[]) {
  if (angles.length === 0) return 0;
  const sorted = [...angles].sort((left, right) => left - right);
  let bestGap = 0;
  let bestMid = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    const start = sorted[index];
    const end = sorted[index + 1];
    if (start == null) continue;
    const next = end == null ? (sorted[0] ?? 0) + Math.PI * 2 : end;
    const gap = next - start;
    if (gap > bestGap) {
      bestGap = gap;
      bestMid = start + gap / 2;
    }
  }
  return -Math.PI / 2 - bestMid;
}

function layoutField(
  tree: SpaceNode,
  focusId: number,
  width: number,
  height: number,
): { nodes: PlacedNode[]; links: PlacedLink[] } {
  const focus = findNode(tree, focusId) ?? tree;
  const path = pathTo(tree, focus.id) ?? [focus];
  const parent = path.length > 1 ? path[path.length - 2] : null;
  const cx = width / 2;
  const cy = height / 2;
  // Room outside the ring so a name can sit beside its node instead of on it.
  const roomX = Math.min(cx, width - cx);
  const roomY = Math.min(cy, height - cy);
  const labelPadX = roomX > 180 ? 78 : 40;
  const labelPadY = roomY > 150 ? 36 : 22;
  const minDim = Math.max(160, Math.min(width, height) - labelPadY * 2);
  const nodeScale = Math.min(1.35, Math.max(0.85, minDim / 420));
  const maxReach = Math.max(72, Math.min(roomX - labelPadX, roomY - labelPadY));
  const reach = maxReach;
  if (parent) {
    const placed = layoutNeighborhood({
      tree,
      focus,
      parent,
      cx,
      cy,
      reach,
      nodeScale,
    });
    separateNodes(placed.nodes, width, height);
    return {
      nodes: placed.nodes,
      links: retargetLinks(placed.nodes, placed.links),
    };
  }
  const focusR = Math.round(36 * nodeScale);
  const childR = Math.round(24 * nodeScale);
  const slot = childR * 2 + 36;
  const innerRadius = focusR + childR + 48;
  const innerCapacity = Math.max(
    1,
    Math.floor((Math.PI * 2 * Math.min(innerRadius, reach)) / slot),
  );
  const grandchildCount = focus.children.reduce(
    (sum, child) => sum + child.children.length,
    0,
  );
  const showDeeper =
    grandchildCount > 0 &&
    focus.children.length > 0 &&
    focus.children.length <= innerCapacity &&
    reach - innerRadius >= childR + 32;
  const visible = prune(focus, showDeeper ? 2 : 1);
  const root = d3.hierarchy(visible);
  const laid = d3
    .tree<SpaceNode>()
    .size([Math.PI * 2, reach])
    .separation((left, right) => (left.parent === right.parent ? 1.15 : 2.1))(
    root,
  );

  const childAngles = laid
    .descendants()
    .filter((node) => node.depth === 1)
    .map((node) => node.x ?? 0);
  // Rotate so the largest open arc is at the top (parent band / label room).
  const rotation = clearTop(childAngles);
  const maxDepth = laid.height;
  const point = (node: d3.HierarchyPointNode<SpaceNode>) => {
    const angle = (node.x ?? 0) + rotation - Math.PI / 2;
    const depth = node.depth;
    const dist =
      depth <= 0
        ? 0
        : !showDeeper || maxDepth <= 1
        ? reach
        : innerRadius +
          ((depth - 1) / Math.max(1, maxDepth - 1)) * (reach - innerRadius);
    return {
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
    };
  };

  const radiusFor = (depth: number) =>
    Math.round((depth === 0 ? 36 : depth === 1 ? 24 : 15) * nodeScale);

  const nodes: PlacedNode[] = laid.descendants().map((node) => {
    const at = node.depth === 0 ? { x: cx, y: cy } : point(node);
    const original = findNode(tree, node.data.id);
    const shownChildren = node.children?.length ?? 0;
    return {
      id: node.data.id,
      name: node.data.name,
      slug: node.data.slug,
      logoUrl: node.data.logoUrl,
      x: at.x,
      y: at.y,
      r: radiusFor(node.depth),
      role: node.depth === 0 ? 'focus' : node.depth === 1 ? 'child' : 'deeper',
      hasHiddenChildren:
        (original?.children.length ?? 0) > 0 && shownChildren === 0,
    };
  });

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const links: PlacedLink[] = [];
  laid.links().forEach((link, index) => {
    const source = byId.get(link.source.data.id);
    const target = byId.get(link.target.data.id);
    if (!source || !target) return;
    const ends = shorten(
      source.x,
      source.y,
      target.x,
      target.y,
      source.r,
      target.r,
    );
    links.push({
      id: `${source.id}-${target.id}`,
      ...ends,
      bend: index % 2 === 0 ? 14 : -14,
    });
  });

  separateNodes(nodes, width, height);
  return { nodes, links: retargetLinks(nodes, links) };
}

/**
 * Nested space: the focus sits in the middle, like the root diagram.
 * Parent, siblings, and children share one ring, with a gap up-left for members.
 */
function layoutNeighborhood({
  tree,
  focus,
  parent,
  cx,
  cy,
  reach,
  nodeScale,
}: {
  tree: SpaceNode;
  focus: SpaceNode;
  parent: SpaceNode;
  cx: number;
  cy: number;
  reach: number;
  nodeScale: number;
}): { nodes: PlacedNode[]; links: PlacedLink[] } {
  const focusR = Math.round(36 * nodeScale);
  const satelliteR = Math.round(24 * nodeScale);
  const children = prune(focus, 1).children;
  const siblings = (findNode(tree, parent.id)?.children ?? []).filter(
    (child) => child.id !== focus.id,
  );
  const satellites: Array<{
    node: SpaceNode;
    role: Role;
    hidden: boolean;
  }> = [
    { node: parent, role: 'parent', hidden: false },
    ...siblings.map((node) => ({
      node,
      role: 'child' as const,
      hidden: node.children.length > 0,
    })),
    ...children.map((node) => ({
      node,
      role: 'child' as const,
      hidden: node.children.length > 0,
    })),
  ];

  // Up-left, clear of the name that hangs under the focus.
  const gapCenter = -Math.PI * 0.72;
  const gapSize = Math.PI * 0.95;
  const span = Math.PI * 2 - gapSize;
  const edge = gapCenter + gapSize / 2;

  const nodes: PlacedNode[] = [
    {
      id: focus.id,
      name: focus.name,
      slug: focus.slug,
      logoUrl: focus.logoUrl,
      x: cx,
      y: cy,
      r: focusR,
      role: 'focus',
      hasHiddenChildren: false,
    },
  ];
  const links: PlacedLink[] = [];

  satellites.forEach((satellite, index) => {
    const angle =
      satellites.length <= 1
        ? gapCenter + Math.PI
        : edge + (span * index) / (satellites.length - 1);
    const at = {
      x: cx + Math.cos(angle) * reach,
      y: cy + Math.sin(angle) * reach,
    };
    const radius = satellite.role === 'parent' ? satelliteR + 2 : satelliteR;
    nodes.push({
      id: satellite.node.id,
      name: satellite.node.name,
      slug: satellite.node.slug,
      logoUrl: satellite.node.logoUrl,
      x: at.x,
      y: at.y,
      r: radius,
      role: satellite.role,
      hasHiddenChildren: satellite.hidden,
    });
    const ends = shorten(cx, cy, at.x, at.y, focusR, radius);
    links.push({
      id:
        satellite.role === 'parent'
          ? `parent-${satellite.node.id}`
          : `${focus.id}-${satellite.node.id}`,
      ...ends,
      bend: index % 2 === 0 ? 12 : -12,
    });
  });

  return { nodes, links };
}

function personLabel(person: Person, fallback: string) {
  return (
    [person.name, person.surname].filter(Boolean).join(' ').trim() ||
    person.nickname?.trim() ||
    person.slug?.trim() ||
    fallback
  );
}

function flowEndLabel(transfer: TransferWithEntity) {
  const spaceTitle = transfer.space?.title?.trim();
  if (spaceTitle) return spaceTitle;
  const person = [transfer.person?.name, transfer.person?.surname]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (person) return person;
  const raw = transfer.direction === 'outgoing' ? transfer.to : transfer.from;
  if (raw.length > 12) return `${raw.slice(0, 6)}…${raw.slice(-4)}`;
  return raw;
}

function arcSlots(count: number, center: number, spread: number) {
  if (count <= 1) return [center];
  const start = center - spread / 2;
  return Array.from(
    { length: count },
    (_, index) => start + (spread * index) / (count - 1),
  );
}

/** Fill an open arc with as many chips as fit, one ring at a time. */
function packArc(
  count: number,
  center: number,
  spread: number,
  inner: number,
  outer: number,
) {
  const rings: Array<{ radius: number; angles: number[] }> = [];
  let left = count;
  let radius = inner;
  const limit = Math.max(inner, outer);
  while (left > 0 && radius <= limit + 0.5) {
    const arc = Math.max(CHIP_SEP, spread * radius);
    const fit = Math.max(1, Math.floor(arc / CHIP_SEP));
    const n = Math.min(left, fit);
    const used = n <= 1 ? 0 : Math.min(spread, ((n - 1) * CHIP_SEP) / radius);
    rings.push({ radius, angles: arcSlots(n, center, used) });
    left -= n;
    radius += CHIP_SEP;
  }
  return { rings, hidden: left };
}

export function MyceliumEcosystem({
  data,
  currentSpaceId,
  ariaLabel,
  onVisibleSpacesChange,
  className,
}: {
  data: MyceliumHierarchyNode;
  currentSpaceId?: number;
  ariaLabel: string;
  onVisibleSpacesChange?: (spaces: VisibleSpace[]) => void;
  className?: string;
}) {
  const t = useTranslations('SelectNavigationAction');
  const tCoherence = useTranslations('CoherenceTab');
  const format = useFormatter();
  const { lang } = useParams<{ lang: string }>();
  const clipPrefix = useId().replace(/:/g, '');
  const tree = useMemo(() => toSpaceNode(data), [data]);
  const [focusId, setFocusId] = useState(currentSpaceId ?? data.id);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  /** Counterparty key in the Flows lens — amount labels only show for this peer. */
  const [hoveredFlowKey, setHoveredFlowKey] = useState<string | null>(null);
  const structureFrame = useFrameSize();
  const flowsFrame = useFrameSize();

  useEffect(() => {
    if (currentSpaceId != null) setFocusId(currentSpaceId);
  }, [currentSpaceId]);

  const focus = findNode(tree, focusId) ?? tree;
  const path = pathTo(tree, focus.id) ?? [focus];
  const {
    persons,
    spaces: memberSpaces,
    isLoading: membersLoading,
  } = useMembers({
    spaceSlug: focus.slug,
    paginationDisabled: true,
  });
  const agents = useMobilizedAiAgents(focus.slug);
  const {
    transfers,
    isLoading: flowsLoading,
    error: flowsError,
  } = useTransfers({
    spaceSlug: focus.slug,
    refreshInterval: 0,
  });

  const parentNode = path.length > 1 ? path[path.length - 2] : undefined;

  useEffect(() => {
    onVisibleSpacesChange?.([
      {
        id: focus.id,
        name: focus.name,
        slug: focus.slug,
        logoUrl: focus.logoUrl,
        parentId: parentNode?.id ?? null,
        root: true,
      },
    ]);
  }, [
    focus.id,
    focus.logoUrl,
    focus.name,
    focus.slug,
    onVisibleSpacesChange,
    parentNode?.id,
  ]);

  const structureField = useMemo(
    () =>
      layoutField(
        tree,
        focus.id,
        structureFrame.size.width,
        structureFrame.size.height,
      ),
    [focus.id, structureFrame.size.height, structureFrame.size.width, tree],
  );
  const flowsField = useMemo(
    () =>
      layoutField(
        tree,
        focus.id,
        flowsFrame.size.width,
        flowsFrame.size.height,
      ),
    [flowsFrame.size.height, flowsFrame.size.width, focus.id, tree],
  );
  const flowsPlacedById = useMemo(
    () => new Map(flowsField.nodes.map((node) => [node.id, node])),
    [flowsField.nodes],
  );
  const structurePlacedById = useMemo(
    () => new Map(structureField.nodes.map((node) => [node.id, node])),
    [structureField.nodes],
  );

  const people = persons.data ?? [];
  const joinedSpaces = memberSpaces.data ?? [];

  const flows = useMemo(() => {
    const totals = new Map<
      string,
      {
        label: string;
        imageUrl?: string | null;
        legs: Map<string, { symbol: string; out: number; inn: number }>;
      }
    >();
    for (const transfer of transfers) {
      const label = flowEndLabel(transfer);
      const symbol = transfer.symbol || '';
      const key = label.toLowerCase();
      const current = totals.get(key) ?? {
        label,
        imageUrl:
          transfer.space?.avatarUrl || transfer.person?.avatarUrl || null,
        legs: new Map(),
      };
      const leg = current.legs.get(symbol) ?? { symbol, out: 0, inn: 0 };
      const parsed = Number(transfer.value);
      const amount = Number.isFinite(parsed) ? parsed : 0;
      if (transfer.direction === 'outgoing') leg.out += amount;
      else leg.inn += amount;
      current.legs.set(symbol, leg);
      if (!current.imageUrl) {
        current.imageUrl =
          transfer.space?.avatarUrl || transfer.person?.avatarUrl || null;
      }
      totals.set(key, current);
    }
    return [...totals.values()]
      .map((flow) => {
        const legs = [...flow.legs.values()];
        return {
          ...flow,
          out: legs.reduce((sum, leg) => sum + leg.out, 0),
          inn: legs.reduce((sum, leg) => sum + leg.inn, 0),
        };
      })
      .sort((left, right) => right.out + right.inn - (left.out + left.inn))
      .slice(0, MAX_FLOWS);
  }, [transfers]);

  const flowView = useMemo(() => {
    const focusNode = flowsPlacedById.get(focus.id);
    if (!focusNode || flows.length === 0) {
      return {
        nodes: [] as Array<{
          key: string;
          label: string;
          x: number;
          y: number;
          imageUrl?: string | null;
        }>,
        threads: [] as Array<{
          key: string;
          peerKey: string;
          label: string;
          incoming: boolean;
          x: number;
          y: number;
          bend: number;
        }>,
      };
    }
    const dist = Math.max(
      108,
      Math.min(flowsFrame.size.width, flowsFrame.size.height) * 0.34,
    );
    const nodes = flows.map((flow, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / flows.length;
      const match = findByTitle(tree, flow.label);
      return {
        key: flow.label.toLowerCase(),
        label: flow.label,
        x: focusNode.x + Math.cos(angle) * dist,
        y: focusNode.y + Math.sin(angle) * dist,
        imageUrl: flow.imageUrl || match?.logoUrl,
      };
    });
    const describe = (flow: (typeof flows)[number], pick: 'out' | 'inn') =>
      [...flow.legs.values()]
        .filter((leg) => leg[pick] > 0)
        .map((leg) =>
          `${format.number(leg[pick], { maximumFractionDigits: 2 })} ${
            leg.symbol
          }`.trim(),
        )
        .join(' · ');
    const threads = flows.flatMap((flow, index) => {
      const node = nodes[index];
      if (!node) return [];
      const next: Array<{
        key: string;
        peerKey: string;
        label: string;
        incoming: boolean;
        x: number;
        y: number;
        bend: number;
      }> = [];
      const outgoing = describe(flow, 'out');
      const incoming = describe(flow, 'inn');
      if (outgoing) {
        next.push({
          key: `${node.key}-out`,
          peerKey: node.key,
          label: outgoing,
          incoming: false,
          x: node.x,
          y: node.y,
          bend: 18,
        });
      }
      if (incoming) {
        next.push({
          key: `${node.key}-in`,
          peerKey: node.key,
          label: incoming,
          incoming: true,
          x: node.x,
          y: node.y,
          bend: -18,
        });
      }
      return next;
    });
    return { nodes, threads };
  }, [
    flows,
    flowsFrame.size.height,
    flowsFrame.size.width,
    flowsPlacedById,
    focus.id,
    format,
    tree,
  ]);

  const showMembers =
    Math.min(structureFrame.size.width, structureFrame.size.height) >= 280;
  const focusNode = structurePlacedById.get(focus.id);

  const membershipMarks = useMemo(() => {
    const empty = {
      chips: [] as Array<{
        key: string;
        label: string;
        x: number;
        y: number;
        href?: string;
        focusSpaceId?: number;
        initials?: string;
        imageUrl?: string | null;
      }>,
      peopleMore: 0,
      spacesMore: 0,
      agentsMore: 0,
    };
    if (!showMembers || !focusNode) return empty;
    const structureNodes = structureField.nodes.filter(
      (node) => node.id !== focus.id,
    );
    const spokes = structureNodes
      .map((node) => Math.atan2(node.y - focusNode.y, node.x - focusNode.x))
      .sort((left, right) => left - right);
    let openAngle = -Math.PI * 0.72;
    let openGap = Math.PI;
    if (spokes.length > 0) {
      let bestGap = 0;
      let bestMid = openAngle;
      for (let index = 0; index < spokes.length; index += 1) {
        const start = spokes[index] ?? 0;
        const end = spokes[index + 1] ?? (spokes[0] ?? 0) + Math.PI * 2;
        const gap = end - start;
        const mid = start + gap / 2;
        if (gap > bestGap) {
          bestGap = gap;
          bestMid = mid;
        }
      }
      if (bestGap > 0) {
        openGap = bestGap;
        openAngle = bestMid;
      }
    }
    const spread = Math.min(Math.PI * 0.95, Math.max(0.4, openGap * 0.78));
    const nearest = structureNodes.reduce((min, node) => {
      const clear =
        Math.hypot(node.x - focusNode.x, node.y - focusNode.y) - node.r;
      return Math.min(min, clear);
    }, Infinity);
    const inner = focusNode.r + 34;
    const outer = Number.isFinite(nearest)
      ? Math.max(inner, nearest - 16)
      : inner + CHIP_SEP * 3;
    type Chip = (typeof empty.chips)[number];
    const groups: Array<{
      kind: 'people' | 'spaces' | 'agents';
      items: Chip[];
    }> = [
      {
        kind: 'people',
        items: people.map((person) => ({
          key: `person-${person.id}`,
          label: personLabel(person, t('navigation.unnamedMember')),
          href:
            person.slug && focus.slug
              ? `/${lang}/dho/${focus.slug}/members/person/${person.slug}`
              : undefined,
          initials: personLabel(person, t('navigation.unnamedMember')).slice(
            0,
            2,
          ),
          imageUrl: person.avatarUrl,
          x: 0,
          y: 0,
        })),
      },
      {
        kind: 'spaces',
        items: joinedSpaces.map((space: Space) => {
          const inTree = findNode(tree, space.id);
          return {
            key: `space-${space.id}`,
            label: space.title,
            href:
              !inTree && space.slug
                ? `/${lang}/dho/${space.slug}/overview`
                : undefined,
            focusSpaceId: inTree ? space.id : undefined,
            imageUrl: space.logoUrl,
            x: 0,
            y: 0,
          };
        }),
      },
      {
        kind: 'agents',
        items: agents.map((agent) => {
          const label = tCoherence(agent.role);
          return {
            key: `agent-${agent.id}`,
            label,
            initials: getAgentAvatarInitials(label),
            x: 0,
            y: 0,
          };
        }),
      },
    ];
    const chips: Chip[] = [];
    const hidden = { people: 0, spaces: 0, agents: 0 };
    let radius = inner;
    for (const group of groups) {
      const packed = packArc(
        group.items.length,
        openAngle,
        spread,
        radius,
        outer,
      );
      let used = 0;
      for (const ring of packed.rings) {
        ring.angles.forEach((angle, index) => {
          const item = group.items[used + index];
          if (!item) return;
          chips.push({
            ...item,
            x: focusNode.x + Math.cos(angle) * ring.radius,
            y: focusNode.y + Math.sin(angle) * ring.radius,
          });
        });
        used += ring.angles.length;
      }
      hidden[group.kind] = packed.hidden;
      const last = packed.rings[packed.rings.length - 1];
      radius = last ? last.radius + CHIP_SEP : radius;
    }
    return {
      chips,
      peopleMore: hidden.people,
      spacesMore: hidden.spaces,
      agentsMore: hidden.agents,
    };
  }, [
    agents,
    focus.id,
    focus.slug,
    focusNode,
    joinedSpaces,
    lang,
    people,
    showMembers,
    t,
    tCoherence,
    tree,
  ]);
  const memberChips = membershipMarks.chips;
  const peopleMore = membershipMarks.peopleMore;
  const spacesMore = membershipMarks.spacesMore;
  const agentsMore = membershipMarks.agentsMore;

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      {path.length > 1 ? (
        <div className="flex flex-wrap items-center justify-end gap-3 px-1 pb-2">
          <nav
            aria-label={ariaLabel}
            className="flex min-w-0 items-center gap-1"
          >
            {path.map((node, index) => {
              const last = index === path.length - 1;
              return (
                <span key={node.id} className="flex min-w-0 items-center gap-1">
                  {index > 0 ? (
                    <span className="text-1 text-neutral-8">/</span>
                  ) : null}
                  {last ? (
                    <span className="truncate text-1 text-foreground">
                      {node.name}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="truncate text-1 text-neutral-11 hover:text-foreground hover:underline"
                      onClick={() => setFocusId(node.id)}
                    >
                      {node.name}
                    </button>
                  )}
                </span>
              );
            })}
          </nav>
        </div>
      ) : null}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
        {(
          [
            {
              lens: 'structure' as const,
              title: t('diagram.lensStructure'),
              frame: structureFrame,
              field: structureField,
              node: structurePlacedById.get(focus.id),
            },
            {
              lens: 'flows' as const,
              title: t('diagram.lensFlows'),
              frame: flowsFrame,
              field: flowsField,
              node: flowsPlacedById.get(focus.id),
            },
          ] as const
        ).map((pane) => {
          const lens = pane.lens;
          const field = pane.field;
          const size = pane.frame.size;
          const focusNode = pane.node;
          const showMembers =
            lens === 'structure' && Math.min(size.width, size.height) >= 280;
          return (
            <section
              key={lens}
              className="craft-card flex min-h-0 flex-col overflow-hidden p-3"
            >
              <h3 className="px-1 pb-2 text-1 tracking-[0.12em] text-neutral-11 uppercase">
                {pane.title}
              </h3>
              <div
                ref={pane.frame.ref}
                className="relative min-h-[14rem] flex-1"
              >
                <svg
                  role="img"
                  aria-label={ariaLabel}
                  viewBox={`0 0 ${size.width} ${size.height}`}
                  className="h-full w-full"
                >
                  <g>
                    {lens === 'structure'
                      ? field.links.map((link) => {
                          const hot =
                            hoveredId != null &&
                            (link.id.startsWith(`${hoveredId}-`) ||
                              link.id.endsWith(`-${hoveredId}`) ||
                              link.id === `parent-${hoveredId}`);
                          const towardParent = link.id.startsWith('parent-');
                          const from = towardParent
                            ? { x: link.x2, y: link.y2 }
                            : { x: link.x1, y: link.y1 };
                          const to = towardParent
                            ? { x: link.x1, y: link.y1 }
                            : { x: link.x2, y: link.y2 };
                          return (
                            <g key={link.id}>
                              <path
                                d={hyphaPath(
                                  link.x1,
                                  link.y1,
                                  link.x2,
                                  link.y2,
                                  link.bend,
                                )}
                                className="mycelium-thread"
                                strokeWidth={towardParent ? 1.25 : 1}
                                strokeOpacity={hot ? 0.85 : 0.28}
                              />
                              <path
                                d={arrowOnCurve(
                                  from.x,
                                  from.y,
                                  to.x,
                                  to.y,
                                  towardParent ? -link.bend : link.bend,
                                )}
                                fill="var(--neutral-12)"
                                fillOpacity={hot ? 0.9 : 0.45}
                              />
                            </g>
                          );
                        })
                      : null}
                    {showMembers && focusNode
                      ? memberChips.map((chip) => {
                          const ends = shorten(
                            focusNode.x,
                            focusNode.y,
                            chip.x,
                            chip.y,
                            focusNode.r,
                            12,
                          );
                          return (
                            <path
                              key={`chip-thread-${chip.key}`}
                              d={hyphaPath(
                                ends.x1,
                                ends.y1,
                                ends.x2,
                                ends.y2,
                                8,
                              )}
                              className="mycelium-thread"
                              strokeWidth={0.75}
                              strokeOpacity={0.4}
                            />
                          );
                        })
                      : null}
                    {lens === 'flows'
                      ? flowView.threads.map((thread) => {
                          const ends = shorten(
                            focusNode?.x ?? size.width / 2,
                            focusNode?.y ?? size.height / 2,
                            thread.x,
                            thread.y,
                            (focusNode?.r ?? 36) + 4,
                            16,
                          );
                          const start = thread.incoming
                            ? { x: ends.x2, y: ends.y2 }
                            : { x: ends.x1, y: ends.y1 };
                          const end = thread.incoming
                            ? { x: ends.x1, y: ends.y1 }
                            : { x: ends.x2, y: ends.y2 };
                          const midX = (start.x + end.x) / 2;
                          const midY = (start.y + end.y) / 2;
                          const dx = end.x - start.x;
                          const dy = end.y - start.y;
                          const length = Math.hypot(dx, dy) || 1;
                          const labelX = midX + (-dy / length) * 18;
                          const labelY = midY + (dx / length) * 18;
                          const active = hoveredFlowKey === thread.peerKey;
                          const amountLabel = `${
                            thread.incoming ? '← ' : '→ '
                          }${thread.label}`;
                          const path = hyphaPath(
                            start.x,
                            start.y,
                            end.x,
                            end.y,
                            thread.bend,
                          );
                          return (
                            <g
                              key={thread.key}
                              className="text-foreground"
                              onMouseEnter={() =>
                                setHoveredFlowKey(thread.peerKey)
                              }
                              onMouseLeave={() => setHoveredFlowKey(null)}
                            >
                              <title>{amountLabel}</title>
                              {/* Wide invisible stroke so the thin flow is easy to hover. */}
                              <path
                                d={path}
                                fill="none"
                                stroke="transparent"
                                strokeWidth={14}
                                strokeLinecap="round"
                                className="cursor-pointer"
                              />
                              <path
                                d={path}
                                className="mycelium-thread mycelium-flow pointer-events-none"
                                strokeWidth={
                                  active
                                    ? thread.incoming
                                      ? 1.75
                                      : 2.25
                                    : thread.incoming
                                    ? 1.25
                                    : 1.75
                                }
                                strokeOpacity={
                                  active
                                    ? 1
                                    : hoveredFlowKey
                                    ? 0.22
                                    : thread.incoming
                                    ? 0.55
                                    : 0.9
                                }
                              />
                              <path
                                d={arrowOnCurve(
                                  start.x,
                                  start.y,
                                  end.x,
                                  end.y,
                                  thread.bend,
                                )}
                                className="pointer-events-none"
                                fill="var(--neutral-12)"
                                fillOpacity={
                                  active
                                    ? 1
                                    : hoveredFlowKey
                                    ? 0.25
                                    : thread.incoming
                                    ? 0.55
                                    : 1
                                }
                              />
                              {active ? (
                                <text
                                  x={labelX}
                                  y={labelY}
                                  textAnchor="middle"
                                  className="pointer-events-none fill-foreground text-[10px]"
                                  style={{
                                    paintOrder: 'stroke',
                                    stroke: 'var(--background)',
                                    strokeWidth: 4,
                                  }}
                                >
                                  {amountLabel}
                                </text>
                              ) : null}
                            </g>
                          );
                        })
                      : null}
                    {(lens === 'flows'
                      ? field.nodes.filter((node) => node.id === focus.id)
                      : field.nodes
                    ).map((node) => {
                      const clip = `${clipPrefix}-${lens}-${node.id}`;
                      const logo =
                        node.logoUrl?.trim() || DEFAULT_SPACE_AVATAR_IMAGE;
                      return (
                        <g
                          key={node.id}
                          role="button"
                          tabIndex={0}
                          aria-label={t('diagram.openSpace', {
                            name: node.name,
                          })}
                          className="mycelium-node cursor-pointer"
                          onMouseEnter={() => setHoveredId(node.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          onClick={() => setFocusId(node.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setFocusId(node.id);
                            }
                          }}
                        >
                          <title>{node.name}</title>
                          <defs>
                            <clipPath id={clip}>
                              <circle cx={node.x} cy={node.y} r={node.r - 1} />
                            </clipPath>
                          </defs>
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={node.r + 2}
                            fill="none"
                            stroke="var(--neutral-12)"
                            strokeOpacity={0.28}
                            strokeWidth={1}
                          />
                          <image
                            href={logo}
                            x={node.x - node.r}
                            y={node.y - node.r}
                            width={node.r * 2}
                            height={node.r * 2}
                            clipPath={`url(#${clip})`}
                            preserveAspectRatio="xMidYMid slice"
                          />
                          {(() => {
                            const originX = focusNode?.x ?? size.width / 2;
                            const originY = focusNode?.y ?? size.height / 2;
                            const dx = node.x - originX;
                            const dy = node.y - originY;
                            const len = Math.hypot(dx, dy) || 1;
                            const outward = node.role !== 'focus';
                            const labelDistance = node.r + 16;
                            const labelX = outward
                              ? node.x + (dx / len) * labelDistance
                              : node.x;
                            const labelY = outward
                              ? node.y + (dy / len) * labelDistance + 4
                              : node.y + node.r + 18;
                            const anchor = !outward
                              ? 'middle'
                              : dx > node.r * 0.45
                              ? 'start'
                              : dx < -node.r * 0.45
                              ? 'end'
                              : 'middle';
                            const name =
                              node.name.length > 22
                                ? `${node.name.slice(0, 21).trimEnd()}…`
                                : node.name;
                            return (
                              <text
                                x={labelX}
                                y={labelY}
                                textAnchor={anchor}
                                className="fill-foreground text-[11px]"
                              >
                                {name}
                              </text>
                            );
                          })()}
                          {node.hasHiddenChildren ? (
                            <circle
                              cx={node.x + node.r * 0.7}
                              cy={node.y - node.r * 0.7}
                              r={3.5}
                              fill="var(--neutral-12)"
                            />
                          ) : null}
                        </g>
                      );
                    })}
                    {lens === 'flows'
                      ? flowView.nodes.map((node) => {
                          const clip = `${clipPrefix}-flow-${node.key.replace(
                            /[^a-zA-Z0-9]/g,
                            '',
                          )}`;
                          const logo = node.imageUrl?.trim();
                          const active = hoveredFlowKey === node.key;
                          const peerThreads = flowView.threads.filter(
                            (thread) => thread.peerKey === node.key,
                          );
                          const hoverSummary = peerThreads
                            .map(
                              (thread) =>
                                `${thread.incoming ? '←' : '→'} ${
                                  thread.label
                                }`,
                            )
                            .join('\n');
                          return (
                            <g
                              key={node.key}
                              className="cursor-pointer"
                              onMouseEnter={() => setHoveredFlowKey(node.key)}
                              onMouseLeave={() => setHoveredFlowKey(null)}
                            >
                              <title>
                                {hoverSummary
                                  ? `${node.label}\n${hoverSummary}`
                                  : node.label}
                              </title>
                              <circle
                                cx={node.x}
                                cy={node.y}
                                r={18}
                                fill="var(--background)"
                                stroke="var(--neutral-12)"
                                strokeOpacity={active ? 0.85 : 0.45}
                                strokeWidth={active ? 1.5 : 1}
                              />
                              {logo ? (
                                <>
                                  <defs>
                                    <clipPath id={clip}>
                                      <circle cx={node.x} cy={node.y} r={16} />
                                    </clipPath>
                                  </defs>
                                  <image
                                    href={logo}
                                    x={node.x - 16}
                                    y={node.y - 16}
                                    width={32}
                                    height={32}
                                    clipPath={`url(#${clip})`}
                                    preserveAspectRatio="xMidYMid slice"
                                  />
                                </>
                              ) : (
                                <text
                                  x={node.x}
                                  y={node.y + 4}
                                  textAnchor="middle"
                                  className="fill-foreground text-[9px]"
                                >
                                  {node.label.slice(0, 2)}
                                </text>
                              )}
                              <text
                                x={node.x}
                                y={node.y + 34}
                                textAnchor="middle"
                                className="fill-foreground text-[11px]"
                              >
                                {node.label.length > 18
                                  ? `${node.label.slice(0, 17).trimEnd()}…`
                                  : node.label}
                              </text>
                            </g>
                          );
                        })
                      : null}
                    {showMembers
                      ? memberChips.map((chip, index) => {
                          const portrait = chip.imageUrl?.trim();
                          const chipClip = `${clipPrefix}-chip-${index}`;
                          const body = (
                            <>
                              <title>{chip.label}</title>
                              <defs>
                                <clipPath id={chipClip}>
                                  <circle cx={chip.x} cy={chip.y} r={10} />
                                </clipPath>
                              </defs>
                              <circle
                                cx={chip.x}
                                cy={chip.y}
                                r={11}
                                fill="var(--background)"
                                stroke="var(--neutral-12)"
                                strokeOpacity={0.35}
                              />
                              {portrait ? (
                                <image
                                  href={portrait}
                                  x={chip.x - 10}
                                  y={chip.y - 10}
                                  width={20}
                                  height={20}
                                  clipPath={`url(#${chipClip})`}
                                  preserveAspectRatio="xMidYMid slice"
                                />
                              ) : (
                                <text
                                  x={chip.x}
                                  y={chip.y + 3}
                                  textAnchor="middle"
                                  className="fill-foreground text-[8px]"
                                >
                                  {(chip.initials ?? chip.label).slice(0, 2)}
                                </text>
                              )}
                            </>
                          );
                          if (chip.href) {
                            return (
                              <a
                                key={chip.key}
                                href={chip.href}
                                aria-label={chip.label}
                              >
                                {body}
                              </a>
                            );
                          }
                          return (
                            <g
                              key={chip.key}
                              role={chip.focusSpaceId ? 'button' : undefined}
                              tabIndex={chip.focusSpaceId ? 0 : undefined}
                              className={
                                chip.focusSpaceId ? 'cursor-pointer' : undefined
                              }
                              onClick={() => {
                                if (chip.focusSpaceId)
                                  setFocusId(chip.focusSpaceId);
                              }}
                            >
                              {body}
                            </g>
                          );
                        })
                      : null}
                  </g>
                </svg>
                {lens === 'flows' && !flowsLoading && flows.length === 0 ? (
                  <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-1 text-neutral-11">
                    {flowsError
                      ? t('diagram.flowsError')
                      : t('diagram.flowsEmpty')}
                  </p>
                ) : null}
                {lens === 'structure' && showMembers && !membersLoading
                  ? (() => {
                      const overflow = [
                        peopleMore > 0
                          ? `${t('navigation.individuals')} +${peopleMore}`
                          : null,
                        spacesMore > 0
                          ? `${t('navigation.memberSpaces')} +${spacesMore}`
                          : null,
                        agentsMore > 0
                          ? `${t('navigation.agents')} +${agentsMore}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ');
                      return overflow ? (
                        <p className="pointer-events-none absolute bottom-2 left-2 text-1 text-neutral-11">
                          {overflow}
                        </p>
                      ) : null;
                    })()
                  : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

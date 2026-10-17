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
  const size = 9;
  const spread = 0.5;
  const leftX = x2 - Math.cos(angle - spread) * size;
  const leftY = y2 - Math.sin(angle - spread) * size;
  const rightX = x2 - Math.cos(angle + spread) * size;
  const rightY = y2 - Math.sin(angle + spread) * size;
  return `M${leftX} ${leftY} L${x2} ${y2} L${rightX} ${rightY}`;
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

function hyphaPath(
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
  const ox = (-dy / len) * bend;
  const oy = (dx / len) * bend;
  return `M${x1},${y1} Q${mx + ox},${my + oy} ${x2},${y2}`;
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
  // Leave room under each node so the name is not clipped by the frame.
  const labelPad = 28;
  const minDim = Math.max(160, Math.min(width, height) - labelPad * 2);
  const nodeScale = Math.min(1.45, Math.max(1, minDim / 380));
  // Same reach as the root diagram: a ring around a centered focus.
  const pad = Math.round(24 * nodeScale) + labelPad + 8;
  const maxReach = Math.max(
    96,
    Math.min(cx, cy, width - cx, height - cy) - pad,
  );
  const reach = Math.min(Math.max(140, minDim * 0.4), maxReach);
  if (parent) {
    return layoutNeighborhood({
      tree,
      focus,
      parent,
      cx,
      cy,
      reach,
      nodeScale,
    });
  }
  const visible = prune(focus, 2);
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
  const point = (node: d3.HierarchyPointNode<SpaceNode>) => {
    const angle = (node.x ?? 0) + rotation - Math.PI / 2;
    const dist = node.y ?? 0;
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

  return { nodes, links };
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
        symbol: string;
        out: number;
        inn: number;
        imageUrl?: string | null;
      }
    >();
    for (const transfer of transfers) {
      const label = flowEndLabel(transfer);
      const symbol = transfer.symbol || '';
      const key = `${symbol}|${label.toLowerCase()}`;
      const current = totals.get(key) ?? {
        label,
        symbol,
        out: 0,
        inn: 0,
        imageUrl:
          transfer.space?.avatarUrl || transfer.person?.avatarUrl || null,
      };
      const amount = Number.isFinite(transfer.value) ? transfer.value : 0;
      if (transfer.direction === 'outgoing') current.out += amount;
      else current.inn += amount;
      if (!current.imageUrl) {
        current.imageUrl =
          transfer.space?.avatarUrl || transfer.person?.avatarUrl || null;
      }
      totals.set(key, current);
    }
    return [...totals.values()]
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
        key: `${flow.symbol}|${flow.label}`,
        label: flow.label,
        x: focusNode.x + Math.cos(angle) * dist,
        y: focusNode.y + Math.sin(angle) * dist,
        imageUrl: flow.imageUrl || match?.logoUrl,
      };
    });
    const threads = flows.flatMap((flow, index) => {
      const node = nodes[index];
      if (!node) return [];
      const amount = (value: number) =>
        `${format.number(value, { maximumFractionDigits: 2 })} ${
          flow.symbol
        }`.trim();
      const next: Array<{
        key: string;
        label: string;
        incoming: boolean;
        x: number;
        y: number;
        bend: number;
      }> = [];
      if (flow.out > 0) {
        next.push({
          key: `${node.key}-out`,
          label: amount(flow.out),
          incoming: false,
          x: node.x,
          y: node.y,
          bend: 16,
        });
      }
      if (flow.inn > 0) {
        next.push({
          key: `${node.key}-in`,
          label: amount(flow.inn),
          incoming: true,
          x: node.x,
          y: node.y,
          bend: -16,
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
    const spread = Math.min(Math.PI * 1.15, Math.max(0.7, openGap * 0.72));
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
              <h3 className="px-1 pb-2 text-1 uppercase tracking-[0.12em] text-neutral-11">
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
                          return (
                            <path
                              key={link.id}
                              d={hyphaPath(
                                link.x1,
                                link.y1,
                                link.x2,
                                link.y2,
                                link.bend,
                              )}
                              className="mycelium-thread"
                              strokeWidth={
                                link.id.startsWith('parent-') ? 1.25 : 1
                              }
                              strokeOpacity={hot ? 0.85 : 0.28}
                            />
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
                          const controlX = midX + (-dy / length) * thread.bend;
                          const controlY = midY + (dx / length) * thread.bend;
                          const labelX = midX + (-dy / length) * 14;
                          const labelY = midY + (dx / length) * 14;
                          return (
                            <g key={thread.key} className="text-foreground">
                              <path
                                d={hyphaPath(
                                  start.x,
                                  start.y,
                                  end.x,
                                  end.y,
                                  thread.bend,
                                )}
                                className="mycelium-thread mycelium-flow"
                                strokeWidth={thread.incoming ? 1.25 : 1.75}
                                strokeOpacity={thread.incoming ? 0.55 : 0.9}
                              />
                              <path
                                d={arrowHead(controlX, controlY, end.x, end.y)}
                                fill="none"
                                stroke="var(--neutral-12)"
                                strokeWidth={1.6}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <text
                                x={labelX}
                                y={labelY}
                                textAnchor="middle"
                                className="fill-foreground text-[10px]"
                                style={{
                                  paintOrder: 'stroke',
                                  stroke: 'var(--background)',
                                  strokeWidth: 4,
                                }}
                              >
                                {thread.incoming ? '← ' : '→ '}
                                {thread.label}
                              </text>
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
                          {node.role !== 'deeper' || size.width >= 520 ? (
                            <text
                              x={node.x}
                              y={node.y + node.r + 20}
                              textAnchor="middle"
                              className="fill-foreground text-[11px]"
                            >
                              {node.name.length > 18
                                ? `${node.name.slice(0, 17).trimEnd()}…`
                                : node.name}
                            </text>
                          ) : null}
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
                          return (
                            <g key={node.key}>
                              <title>{node.label}</title>
                              <circle
                                cx={node.x}
                                cy={node.y}
                                r={18}
                                fill="var(--background)"
                                stroke="var(--neutral-12)"
                                strokeOpacity={0.45}
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

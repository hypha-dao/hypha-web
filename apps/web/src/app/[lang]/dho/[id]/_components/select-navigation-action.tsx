'use client';

import { SelectAction } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { SpaceVisualization } from './space-visualization';
import { VisibleSpacesList } from './visible-spaces-list';
import {
  useOrganisationSpacesBySingleSlug,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { Space } from '@hypha-platform/core/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@hypha-platform/ui';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Separator } from '@hypha-platform/ui';

type SelectNavigationActionProps = {
  daoSlug: string;
  lang: Locale;
  children?: React.ReactNode;
};

type HierarchyNode = {
  name: string;
  logoUrl?: string | null;
  id: number;
  slug?: string;
  value?: number;
  children?: HierarchyNode[];
};

function findRootSpace(space: Space, allSpaces: Space[]): Space {
  let current = space;

  while (current.parentId) {
    const parent = allSpaces.find((s) => s.id === current.parentId);
    if (!parent) break;
    current = parent;
  }

  return current;
}

function buildHierarchy(
  currentSpace: Space,
  allSpaces: Space[],
): HierarchyNode {
  const children = allSpaces.filter(
    (space) => space.parentId === currentSpace.id,
  );

  const childrenNodes: HierarchyNode[] = children.map((child) =>
    buildHierarchy(child, allSpaces),
  );

  const value = currentSpace.memberCount || currentSpace.documentCount || 1;

  return {
    name: currentSpace.title,
    logoUrl: currentSpace.logoUrl,
    id: currentSpace.id,
    slug: currentSpace.slug,
    value: value,
    children: childrenNodes.length > 0 ? childrenNodes : undefined,
  };
}

type VisibleSpace = {
  id: number;
  name: string;
  slug?: string;
  logoUrl?: string | null;
  parentId?: number | null;
  root: boolean;
};

export const SelectNavigationAction = ({
  daoSlug,
  lang,
  children,
}: SelectNavigationActionProps) => {
  const [activeTab, setActiveTab] = useState('nested-spaces');
  const [visibleSpaces, setVisibleSpaces] = useState<VisibleSpace[]>([]);
  const previousSpacesRef = useRef<string>('');
  const { space: currentSpace, isLoading: isLoadingSpace } =
    useSpaceBySlug(daoSlug);
  const { spaces: allSpaces, isLoading: isLoadingSpaces } =
    useOrganisationSpacesBySingleSlug(daoSlug);

  const isLoading = isLoadingSpace || isLoadingSpaces;

  const hierarchyData: HierarchyNode | null = useMemo(() => {
    if (!currentSpace || !allSpaces) return null;

    const rootSpace = findRootSpace(currentSpace, allSpaces);
    return buildHierarchy(rootSpace, allSpaces);
  }, [currentSpace, allSpaces]);

  const handleVisibleSpacesChange = useCallback((spaces: VisibleSpace[]) => {
    const spacesKey = JSON.stringify(spaces.map((s) => s.id).sort());
    if (previousSpacesRef.current !== spacesKey) {
      previousSpacesRef.current = spacesKey;
      setVisibleSpaces(spaces);
    }
  }, []);

  const currentSpaceId = currentSpace?.id;
  const allSpacesLength = allSpaces?.length;
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    previousSpacesRef.current = '';
  }, [currentSpaceId, allSpacesLength]);

  return (
    <SelectAction
      title="Space Visualization"
      content="Explore how your spaces relate to each other in a single interactive view. Use the map to zoom into nested spaces, see connections between spaces, and follow value flows across your organisation."
      actions={[]}
      isLoading={isLoading}
    >
      <Separator />
      {children}
      <div className="mt-2">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full bg-primary-foreground p-4 rounded-[6px]"
        >
          <div className="w-full flex justify-center">
            <TabsList triggerVariant="switch">
              <TabsTrigger variant="switch" value="nested-spaces">
                Nested spaces
              </TabsTrigger>
              <TabsTrigger variant="switch" value="space-to-space">
                Space-to-Space
              </TabsTrigger>
              <TabsTrigger variant="switch" value="values-flows">
                Values Flows
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="nested-spaces" className="mt-4">
            <div className="flex flex-col gap-6">
              {hierarchyData && (
                <SpaceVisualization
                  data={hierarchyData}
                  currentSpaceId={currentSpace?.id}
                  onVisibleSpacesChange={handleVisibleSpacesChange}
                />
              )}
              {visibleSpaces.length > 0 && allSpaces && (
                <VisibleSpacesList
                  visibleSpaces={visibleSpaces}
                  allSpaces={allSpaces}
                  lang={lang}
                  entrySpaceId={currentSpace?.id}
                />
              )}
            </div>
          </TabsContent>
          <TabsContent value="space-to-space" className="mt-4">
            <div className="text-center text-neutral-11 py-8">
              Space-to-Space visualization coming soon
            </div>
          </TabsContent>
          <TabsContent value="values-flows" className="mt-4">
            <div className="text-center text-neutral-11 py-8">
              Values Flows visualization coming soon
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </SelectAction>
  );
};

'use client';

import { SelectAction } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { SpaceVisualization } from './space-visualization';
import {
  useOrganisationSpacesBySingleSlug,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { Space } from '@hypha-platform/core/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@hypha-platform/ui';
import { useState } from 'react';

type SelectNavigationActionProps = {
  daoSlug: string;
  lang: Locale;
  children?: React.ReactNode;
};

type HierarchyNode = {
  name: string;
  logoUrl?: string | null;
  id: number;
  value?: number;
  children?: HierarchyNode[];
};

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
    value: value,
    children: childrenNodes.length > 0 ? childrenNodes : undefined,
  };
}

export const SelectNavigationAction = ({
  daoSlug,
  lang,
  children,
}: SelectNavigationActionProps) => {
  const [activeTab, setActiveTab] = useState('nested-spaces');
  const { space: currentSpace, isLoading: isLoadingSpace } =
    useSpaceBySlug(daoSlug);
  const { spaces: allSpaces, isLoading: isLoadingSpaces } =
    useOrganisationSpacesBySingleSlug(daoSlug);

  const isLoading = isLoadingSpace || isLoadingSpaces;

  const hierarchyData: HierarchyNode | null =
    currentSpace && allSpaces ? buildHierarchy(currentSpace, allSpaces) : null;

  return (
    <SelectAction
      title="Space Visualization"
      content="Explore how your spaces relate to each other in a single interactive view. Use the map to zoom into nested spaces, see connections between spaces, and follow value flows across your organisation."
      actions={[]}
      isLoading={isLoading}
    >
      {children}
      <div className="mt-2">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full bg-primary-foreground py-4 rounded-lg"
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
            {hierarchyData && <SpaceVisualization data={hierarchyData} />}
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

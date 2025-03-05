'use client';
import { EditPersonHead, EditPersonHeadProps } from './edit-person-head';
import {
  Button,
  Skeleton,
  Textarea,
  Input,
  Switch,
  Image,
} from '@hypha-platform/ui';
import { RxCross1, RxPencil1 } from 'react-icons/rx';
import { useState, useEffect } from 'react';
import { Text } from '@radix-ui/themes';
import { cn } from '@hypha-platform/lib/utils';
import { Separator } from '@hypha-platform/ui';

import Link from 'next/link';
import React from 'react';
import { useEditProfile } from '../../../../../apps/web/src/hooks/use-edit-profile';

export type EditPersonSectionProps = EditPersonHeadProps & {
  avatar: string;
  name: string;
  surname: string;
  id: number | null;
  nickname: string;
  closeUrl: string;
  description: string;
  leadImageUrl: string;
};

export const EditPersonSection = ({
  isLoading,
  closeUrl,
  avatar,
  name,
  surname,
  id,
  description,
  leadImageUrl,
  nickname
}: EditPersonSectionProps) => {
  const [descriptionValue, setDescriptionValue] = useState(description || '');
  const [isEditingLeadImage, setIsEditingLeadImage] = useState(false);
  const [newLeadImageUrl, setNewLeadImageUrl] = useState(leadImageUrl || '');

  const { editProfile } = useEditProfile()

  useEffect(() => {
    setDescriptionValue(description || '');
  }, [description]);

  const [activeLinks, setActiveLinks] = useState({
    website: false,
    linkedin: false,
    x: false,
  });

  const handleLinkToggle = React.useCallback(
    (field: keyof typeof activeLinks) => (isActive: boolean) => {
      setActiveLinks({ ...activeLinks, [field]: isActive });
    },
    [activeLinks, setActiveLinks],
  );

  const handleEditLeadImage = () => {
    setIsEditingLeadImage(!isEditingLeadImage);
  };

  const handleSaveLeadImageUrl = () => {
    setIsEditingLeadImage(false);
  };

  const saveChanges = async () => {
    try {
      const updatedProfile = await editProfile({
        leadImageUrl: newLeadImageUrl,
        description: descriptionValue,
        id: id
      });
      console.log('Profile updated:', updatedProfile);
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error editing profile:', error);
      alert('Failed to edit profile');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-5 justify-between">
        <EditPersonHead
          avatar={avatar}
          name={name}
          surname={surname}
          nickname={nickname}
          isLoading={isLoading}
        />
        <Link href={closeUrl} scroll={false}>
          <Button
            variant="ghost"
            colorVariant="neutral"
            className="flex items-center"
          >
            Close
            <RxCross1 className="ml-2" />
          </Button>
        </Link>
      </div>
      <Separator />
      <Skeleton
        width="100%"
        height="100px"
        loading={isLoading}
        className="rounded-lg"
      >
        {leadImageUrl && !isEditingLeadImage ? (
          <div className="relative">
            <Image
              className="rounded-xl max-h-[130px] min-h-[130px] w-full object-cover"
              width={400}
              height={130}
              src={newLeadImageUrl}
              alt={`Profile Lead Image: ${name} ${surname}`}
            />
            <Button
              variant="ghost"
              colorVariant="neutral"
              className="absolute top-2 right-2 p-2 rounded-xl"
              onClick={handleEditLeadImage}
            >
              <RxPencil1 className="w-5 h-5" />
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={newLeadImageUrl}
              onChange={(e) => setNewLeadImageUrl(e.target.value)}
              placeholder="New lead image URL"
              className="w-full min-w-full"
            />
            <Button
              variant="default"
              onClick={handleSaveLeadImageUrl}
            >
              Save
            </Button>
          </div>
        )}
      </Skeleton>
      <Skeleton
        width="100%"
        height="100px"
        loading={isLoading}
        className="rounded-lg"
      >
        <Textarea
          value={descriptionValue}
          onChange={(e) => setDescriptionValue(e.target.value)}
        />
      </Skeleton>
      <div className="flex gap-6 flex-col">
        <div className="flex justify-between">
          <Text
            className={cn(
              'text-2',
              activeLinks.website ? 'text-neutral-11' : 'text-neutral-8',
            )}
          >
            Website
          </Text>
          <span className="flex items-center">
            <Input
              placeholder="Add your URL"
              disabled={!activeLinks.website}
              className={cn(
                'text-2 mr-3',
                !activeLinks.website ? 'bg-neutral-6' : '',
              )}
            />
            <Switch
              checked={activeLinks.website}
              onCheckedChange={handleLinkToggle('website')}
            />
          </span>
        </div>
        <div className="flex justify-between">
          <Text
            className={cn(
              'text-2',
              activeLinks.website ? 'text-neutral-11' : 'text-neutral-8',
            )}
          >
            LinkedIn
          </Text>
          <span className="flex items-center">
            <Input
              placeholder="Add your URL"
              disabled={!activeLinks.linkedin}
              className={cn(
                'text-2 mr-3',
                !activeLinks.linkedin ? 'bg-neutral-6' : '',
              )}
            />
            <Switch
              checked={activeLinks.linkedin}
              onCheckedChange={handleLinkToggle('linkedin')}
            />
          </span>
        </div>
        <div className="flex justify-between">
          <Text
            className={cn(
              'text-2',
              activeLinks.x ? 'text-neutral-11' : 'text-neutral-8',
            )}
          >
            X
          </Text>
          <span className="flex items-center">
            <Input
              placeholder="Add your URL"
              disabled={!activeLinks.x}
              className={cn(
                'text-2 mr-3',
                !activeLinks.x ? 'bg-neutral-6' : '',
              )}
            />
            <Switch
              checked={activeLinks.x}
              onCheckedChange={handleLinkToggle('x')}
            />
          </span>
        </div>
      </div>
      <div className="flex justify-end w-full">
        <Skeleton
          width="72px"
          height="35px"
          loading={isLoading}
          className="rounded-lg"
        >
          <Button
            variant="default"
            className="rounded-lg justify-start text-white w-fit"
            onClick={saveChanges}
          >
            Save
          </Button>
        </Skeleton>
      </div>
    </div>
  );
};

'use client';
import { CreateFormHead, CreateFormHeadProps } from './create-form-head';
import {
  Button,
  Skeleton,
  FileUploader,
  Textarea,
  Input,
  Switch,
} from '@hypha-platform/ui';
import { RxCross1 } from 'react-icons/rx';
import { SelectItem, SelectMenu } from '@hypha-platform/ui/server';
import { useState } from 'react';
import { Text } from '@radix-ui/themes';
import { cn } from '@hypha-platform/lib/utils';

import Link from 'next/link';
import React from 'react';

export type CreateFormProps = CreateFormHeadProps & {
  closeUrl: string;
};

export const CreateForm = ({
  creator,
  isLoading,
  closeUrl,
  type,
}: CreateFormProps) => {
  const [files, setFiles] = React.useState<File[]>([]);

  const isSpaceForm = type?.toLowerCase() === 'space';

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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-5 justify-between">
        <CreateFormHead creator={creator} isLoading={isLoading} type={type} />
        <Link href={closeUrl}>
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
      <Skeleton
        width="100%"
        height="100px"
        loading={isLoading}
        className="rounded-lg"
      >
        <FileUploader
          value={files}
          onValueChange={setFiles}
          onUpload={() => Promise.resolve()}
        />
      </Skeleton>
      <Skeleton
        width="100%"
        height="100px"
        loading={isLoading}
        className="rounded-lg"
      >
        <Textarea placeholder="Type a brief description here..." />
      </Skeleton>
      {isSpaceForm ? null : (
        <div className="row mt-1 flex justify-between w-full">
          <Skeleton
            width="62px"
            height="20px"
            loading={isLoading}
            className="rounded-lg"
          >
            <span className="text-2 text-neutral-11 font-medium">Outcome</span>
          </Skeleton>
          <Skeleton
            width="62px"
            height="32px"
            loading={isLoading}
            className="rounded-lg"
          >
            <SelectMenu variant="default" value={'select-one'}>
              <SelectItem value="select-one">Select one</SelectItem>
            </SelectMenu>
          </Skeleton>
        </div>
      )}
      {isSpaceForm ? (
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
      ) : null}
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
          >
            {isSpaceForm ? 'Create' : 'Publish'}
          </Button>
        </Skeleton>
      </div>
    </div>
  );
};

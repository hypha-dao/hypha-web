'use client';

import { CreateFormHead, CreateFormHeadProps } from './create-form-head';
import { Button, Skeleton, FileUploader, Textarea } from '@hypha-platform/ui';
import { RxCross1 } from 'react-icons/rx';
import { SelectItem, SelectMenu } from '@hypha-platform/ui/server';

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
            Publish
          </Button>
        </Skeleton>
      </div>
    </div>
  );
};

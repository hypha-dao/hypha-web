'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { schemaEditPersonWeb2 } from '@hypha-platform/core/client';

import {
  Button,
  Skeleton,
  Textarea,
  Input,
  Switch,
  Separator,
  ImageUploader,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@hypha-platform/ui';
import { RxCross1 } from 'react-icons/rx';
import { Text } from '@radix-ui/themes';
import { cn } from '@hypha-platform/lib/utils';

import React, { useState, useEffect } from 'react';

import { EditPersonHead } from './edit-person-head';
import { UseUploadThingFileUploader } from '../hooks/types';

import Link from 'next/link';

interface Person {
  avatarUrl?: string | undefined;
  name?: string;
  surname?: string;
  id?: number;
  nickname?: string;
  description?: string;
  leadImageUrl?: string;
}

export type EditPersonSectionProps = {
  person?: Person;
  closeUrl: string;
  isLoading?: boolean;
  useUploadThingFileUploader?: UseUploadThingFileUploader;
  successfulEditCallback?: () => void;
  onEdit?: (values: z.infer<typeof schemaEditPersonWeb2>) => Promise<void>;
};

export const EditPersonSection = ({
  isLoading,
  closeUrl,
  person,
  useUploadThingFileUploader,
  successfulEditCallback,
  onEdit
}: EditPersonSectionProps) => {
  const {
    id = undefined,
    avatarUrl = '', 
    name = '', 
    surname = '', 
    nickname = '', 
    description = '', 
    leadImageUrl = '' 
  } = person || {};

  if (!useUploadThingFileUploader) {
    throw new Error('useUploadThingFileUploader hook is not defined');
  }
  const { isUploading, uploadedFile, setUploadedFile, handleDrop } =
    useUploadThingFileUploader({
      onUploadComplete: (url: string) => {
        setUploadedFile(url);
        form.setValue('leadImageUrl', url);
      },
    });

  const form = useForm<z.infer<typeof schemaEditPersonWeb2>>({
    resolver: zodResolver(schemaEditPersonWeb2),
    defaultValues: {
      name: name,
      surname: surname,
      nickname: nickname,
      description: description,
      leadImageUrl: uploadedFile ?? '',
      id: id
    },
    mode: 'onChange'
  });
  const { watch, formState } = form;

  const watchedValues = watch();

  useEffect(() => {
    if (leadImageUrl) {
      setUploadedFile(leadImageUrl);
      form.setValue('leadImageUrl', leadImageUrl);
    }
  }, [leadImageUrl]);

  useEffect(() => {
    form.setValue('leadImageUrl', uploadedFile || '');
  }, [uploadedFile]);

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

  const onSubmit = async (values: z.infer<typeof schemaEditPersonWeb2>) => {
    try {
      if (onEdit) {
        await onEdit(values);
        successfulEditCallback?.();
      }
    } catch (error) {
      console.error('Error editing profile:', error);
      alert('Failed to edit profile');
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex flex-col gap-5">
          <div className="flex gap-5 justify-between">
            <EditPersonHead
              avatar={avatarUrl}
              name={watchedValues.name}
              surname={watchedValues.surname}
              nickname={watchedValues.nickname}
              isLoading={isLoading}
              form={form as UseFormReturn<Person>}
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
            <FormField
              control={form.control}
              name="leadImageUrl"
              render={() => (
                <FormItem>
                  <FormControl>
                    <ImageUploader
                      isUploading={isUploading}
                      uploadedFile={uploadedFile}
                      onReset={() => {
                        setUploadedFile(null);
                        form.setValue('leadImageUrl', '');
                      }}
                      onUpload={handleDrop}
                      defaultImageUrl={leadImageUrl}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Skeleton>
          <Skeleton
            width="100%"
            height="100px"
            loading={isLoading}
            className="rounded-lg"
          >
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Enter description"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
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
                type="submit"
                variant="default"
                className="rounded-lg justify-start text-white w-fit"
                disabled={!formState.isValid}
              >
                Save
              </Button>
            </Skeleton>
          </div>
        </div>
      </form>
    </Form>
  );
};
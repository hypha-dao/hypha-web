'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { CreateSpaceFormHeadProps } from './create-space-form-head';
import {
  Button,
  Skeleton,
  FileUploader,
  Textarea,
  Input,
  Switch,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Slider,
} from '@hypha-platform/ui';
import { RxCross1 } from 'react-icons/rx';
import { useState } from 'react';
import { Text } from '@radix-ui/themes';
import { cn } from '@hypha-platform/lib/utils';

import Link from 'next/link';
import React from 'react';

import { z } from 'zod';
import { Pencil1Icon } from '@radix-ui/react-icons';

export const createSpaceSchema = z.object({
  title: z.string().min(1).max(50),
  description: z.string().min(1).max(300),
  quorum: z.number().min(1).max(100),
  unity: z.number().min(1).max(100),
  votingPowerSource: z.number().min(0).max(100),
  joinMethod: z.number().min(0).max(100),
  exitMethod: z.number().min(0).max(100),
});

export type CreateSpaceFormProps = CreateSpaceFormHeadProps & {
  closeUrl: string;
  onCreate: (values: z.infer<typeof createSpaceSchema>) => void;
};

export const CreateSpaceForm = ({
  creator,
  isLoading,
  closeUrl,
  onCreate,
}: CreateSpaceFormProps) => {
  const form = useForm<z.infer<typeof createSpaceSchema>>({
    resolver: zodResolver(createSpaceSchema),
    defaultValues: {
      title: '',
      description: '',
      quorum: 50,
      unity: 20,
      votingPowerSource: 0,
      joinMethod: 0,
      exitMethod: 0,
    },
  });
  const quorum = useWatch({ control: form.control, name: 'quorum' });
  const unity = useWatch({ control: form.control, name: 'quorum' });
  console.debug('CreateSpaceForm', { quorum, unity });
  const [files, setFiles] = React.useState<File[]>([]);

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
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onCreate)}
        className="flex flex-col gap-5"
      >
        <div className="flex gap-5 justify-between">
          <div className="flex items-center">
            <div className="mr-3 min-w-[64px] h-[64px] rounded-xl bg-accent-9 justify-center items-center flex">
              <Pencil1Icon className="h-5 w-5" />
            </div>

            <div className="flex justify-between items-center w-full">
              <div className="flex flex-col">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Type a title..."
                          className="border-0 text-4 p-0 placeholder:text-4 bg-inherit"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <span className="flex items-center">
                  <Text className="text-1 text-foreground mr-1">
                    Created by
                  </Text>
                  <Text className="text-1 text-neutral-11">
                    {creator?.name} {creator?.surname}
                  </Text>
                </span>
              </div>
            </div>
          </div>
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
        <FileUploader
          value={files}
          onValueChange={setFiles}
          onUpload={() => Promise.resolve()}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Type a brief description here..."
                  {...field}
                />
              </FormControl>
              <FormDescription>
                This is the description of your space
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="unity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Unity</FormLabel>
              <FormControl>
                <Slider
                  onValueCommit={([unity]) => field.onChange(unity)}
                  displayValue
                  defaultValue={[field.value]}
                />
              </FormControl>
              <FormDescription>
                This is the required unity of your space
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="quorum"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quorum</FormLabel>
              <FormControl>
                <Slider
                  onValueCommit={([quorum]) => field.onChange(quorum)}
                  displayValue
                  defaultValue={[field.value]}
                />
              </FormControl>
              <FormDescription>
                This is the required quorum of your space
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="votingPowerSource"
          render={({ field }) => (
            <FormItem>
              <FormLabel>VotingPowerSource</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>
                This is the required votingPowerSource of your space
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="joinMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>JoinMethod</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>This is the JoinMethod</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="exitMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ExitMethod</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>This is the ExitMethod</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
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
            >
              Create
            </Button>
          </Skeleton>
        </div>
      </form>
    </Form>
  );
};

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Combobox,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  LoadingBackdrop,
  MultiSelect,
  RequirementMark,
  RichTextEditor,
} from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  COHERENCE_TAGS,
  COHERENCE_TYPES,
  CoherenceTag,
  CoherenceType,
  schemaCreateCoherenceForm,
  useCreateCoherenceOrchestrator,
  useJwt,
  useMe,
} from '@hypha-platform/core/client';
import React from 'react';
import { useConfig } from 'wagmi';
import { useScrollToErrors } from '../../hooks';
import { ButtonClose } from '../../common';
import { useRouter } from 'next/navigation';

type FormValues = z.infer<typeof schemaCreateCoherenceForm>;

interface CreateSignalFormProps {
  spaceId: number;
  successfulUrl: string;
  closeUrl?: string;
}

export const CreateSignalForm = ({
  spaceId,
  successfulUrl,
  closeUrl,
}: CreateSignalFormProps) => {
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();
  const router = useRouter();
  const {
    createCoherence,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
  } = useCreateCoherenceOrchestrator({ authToken: jwt, config });

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schemaCreateCoherenceForm),
    defaultValues: {
      title: '',
      description: '',
      creatorId: person?.id,
      spaceId,
      status: 'signal',
      archived: false,
    },
  });

  useScrollToErrors(form, formRef);

  const typeOptions = React.useMemo(() => {
    return COHERENCE_TYPES.map((type) => ({
      value: type,
      label: type,
    }));
  }, []);

  const tagOptions = React.useMemo(() => {
    const initial: Record<string, CoherenceTag[]> = {};
    const grouped: Record<string, CoherenceTag[]> = COHERENCE_TAGS.reduce(
      (tree, tag) => {
        const [group] = tag.split('/');
        if (group) {
          tree[group] = tree[group] ? [...tree[group], tag] : [tag];
        }
        return tree;
      },
      initial,
    );
    const tags: { value: string; label: string }[] = [];
    for (const [group, values] of Object.entries(grouped)) {
      tags.push(
        {
          label: '---',
          value: '---',
        },
        {
          label: group,
          value: '===',
        },
      );
      tags.push(
        ...values.map((value) => ({
          label: value.split('/')[1] ?? '',
          value: value,
        })),
      );
    }
    return tags;
  }, []);

  React.useEffect(() => {
    const { isDirty } = form.getFieldState('creatorId');
    if (!isDirty && person?.id) {
      form.setValue('creatorId', person.id, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: true,
      });
    }
  }, [person, form]);

  React.useEffect(() => {
    const { isDirty } = form.getFieldState('spaceId');
    if (!isDirty && spaceId) {
      form.setValue('spaceId', spaceId, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: true,
      });
    }
  }, [spaceId, form]);

  React.useEffect(() => {
    if (progress < 100) {
      return;
    }
    router.push(successfulUrl);
  }, [successfulUrl, progress]);

  const handleCreate = async (data: FormValues) => {
    await createCoherence({
      ...data,
    });
  };

  const handleInvalid = async (err?: any) => {
    console.log('form errors:', err);
  };

  return (
    <LoadingBackdrop
      showKeepWindowOpenMessage={true}
      progress={progress}
      isLoading={isPending}
      fullHeight={true}
      message={
        isError ? (
          <div className="flex flex-col">
            <div>Ouh Snap. There was an error</div>
            <Button onClick={reset}>Reset</Button>
          </div>
        ) : (
          <div>{currentAction}</div>
        )
      }
    >
      <Form {...form}>
        <form
          ref={formRef}
          onSubmit={form.handleSubmit(handleCreate, handleInvalid)}
          className="flex flex-col gap-5"
        >
          <div className="flex w-full">
            <div className="flex flex-col w-full justify-between gap-4">
              <div className="flex flex-row w-full">
                <div className="flex grow"></div>
                <ButtonClose
                  closeUrl={closeUrl}
                  className="px-0 md:px-3 align-top"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-between w-full gap-4">
            <div className="flex flex-col gap-4 w-full">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder="Signal title..."
                        className="border-0 text-4 p-0 placeholder:text-4 bg-inherit"
                        rightIcon={<RequirementMark className="text-4" />}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <div className="w-full flex flex-row gap-1">
                      <FormLabel className="text-foreground">
                        Type <RequirementMark />
                      </FormLabel>
                      <span className="flex grow"></span>
                      <span className="flex flex-row gap-1">
                        <FormControl>
                          <Combobox
                            options={typeOptions ?? []}
                            initialValue={field.value}
                            onChange={(value: string) => {
                              form.setValue('type', value as CoherenceType, {
                                shouldDirty: true,
                              });
                            }}
                            allowEmptyChoice={false}
                          />
                        </FormControl>
                      </span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">
                      Tags <RequirementMark />
                    </FormLabel>
                    <FormControl>
                      <MultiSelect
                        placeholder={'Select one or more'}
                        options={tagOptions}
                        value={field.value}
                        allowToggleAll={false}
                        onValueChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground gap-1">
                      Description <RequirementMark />
                    </FormLabel>
                    <FormControl>
                      <RichTextEditor
                        editorRef={null}
                        markdown={field.value}
                        placeholder="Type your description here..."
                        {...field}
                      />
                    </FormControl>
                    <FormDescription />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          <div className="flex justify-end w-full">
            <Button type="submit">Publish</Button>
          </div>
        </form>
      </Form>
    </LoadingBackdrop>
  );
};

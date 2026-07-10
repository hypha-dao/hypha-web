'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import {
  type Person as SavedPerson,
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  resolveSupportedCurrency,
  schemaEditPersonWeb2,
  editPersonFiles,
} from '@hypha-platform/core/client';
import {
  Button,
  Textarea,
  Input,
  Separator,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  UploadLeadImage,
  UploadAvatar,
  RequirementMark,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { cn } from '@hypha-platform/ui-utils';
import { Links } from '../../common';
import { ModalStickyNavigation } from '../../common/modal-sticky-navigation';
import { useScrollToErrors } from '../../hooks';
import { useCallback, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';

/** Subset of person fields used to seed the edit form (not the full domain `Person`). */
interface EditPersonSectionInput {
  avatarUrl?: string;
  name?: string;
  surname?: string;
  id?: number;
  nickname?: string;
  description?: string;
  leadImageUrl?: string;
  location?: string;
  currency?: string;
  email?: string;
  links?: string[];
}

const schemaEditPersonForm = schemaEditPersonWeb2.extend(editPersonFiles.shape);

export type EditPersonSectionProps = {
  person?: EditPersonSectionInput;
  closeUrl: string;
  isLoading?: boolean;
  onEdit: (
    values: z.infer<typeof schemaEditPersonForm>,
  ) => Promise<SavedPerson | void | null | undefined>;
  /** Optional; e.g. merge saved `Person` into SWR after `onEdit` resolves. */
  onUpdate?: (saved?: SavedPerson) => void | Promise<void>;
  error?: string | null;
};

type FormData = z.infer<typeof schemaEditPersonForm>;

export const EditPersonSection = ({
  isLoading,
  closeUrl,
  person,
  onEdit,
  onUpdate,
  error,
}: EditPersonSectionProps) => {
  const tProfile = useTranslations('Profile');
  const tSpaces = useTranslations('Spaces');
  const tModalAside = useTranslations('ModalAside');
  const tCommon = useTranslations('Common');
  const baseResolver = useMemo(() => zodResolver(schemaEditPersonForm), []);

  const translateEditProfileError = useCallback(
    (message: string) => {
      const map: Record<string, string> = {
        'Please enter your first name': 'editForm.errors.firstNameRequired',
        'Please enter your last name': 'editForm.errors.lastNameRequired',
        'Please choose a nickname': 'editForm.errors.nicknameRequired',
        'Nickname length should not exceed 12 characters':
          'editForm.errors.nicknameMaxLength',
        'Description length should not exceed 300 characters':
          'editForm.errors.descriptionMaxLength',
        'Please enter a valid email address': 'editForm.errors.emailInvalid',
        'Email must be at most 100 characters long':
          'editForm.errors.emailMaxLength',
        'Location must be at most 100 characters long':
          'editForm.errors.locationMaxLength',
        'Please enter a valid URL (e.g., https://example.com)':
          'editForm.errors.urlInvalid',
        'Avatar URL must be a valid URL': 'editForm.errors.avatarUrlInvalid',
        'Lead Image URL must be a valid URL':
          'editForm.errors.leadImageUrlInvalid',
        'Your file is too large and exceeds the 16 MB limit. Please upload a smaller file':
          'editForm.errors.fileTooLarge',
        'File size must be less than 16 MB': 'editForm.errors.fileTooLarge',
        'Your file is too large and exceeds the 4MB limit. Please upload a smaller file':
          'editForm.errors.fileTooLarge',
        'File size must be less than 4MB': 'editForm.errors.fileTooLarge',
        'File must be an image (JPEG, PNG, GIF, WEBP)':
          'editForm.errors.fileMustBeImage',
      };
      const key = map[message];
      return key ? tProfile(key as Parameters<typeof tProfile>[0]) : message;
    },
    [tProfile],
  );

  const localizeErrorsRef = useRef<(errors: unknown) => unknown>(
    () => undefined,
  );
  localizeErrorsRef.current = (errors: unknown): unknown => {
    if (!errors || typeof errors !== 'object') return errors;
    if (Array.isArray(errors)) {
      const localizedArray = errors.map((entry) =>
        localizeErrorsRef.current(entry),
      );
      const localizedArrayWithMeta = localizedArray as unknown as Record<
        string,
        unknown
      >;

      for (const [key, value] of Object.entries(errors)) {
        if (!/^\d+$/.test(key)) {
          localizedArrayWithMeta[key] =
            typeof value === 'string'
              ? translateEditProfileError(value)
              : value && typeof value === 'object'
              ? localizeErrorsRef.current(value)
              : value;
        }
      }

      return localizedArrayWithMeta;
    }

    const localized = { ...(errors as Record<string, unknown>) };

    if (typeof localized.message === 'string') {
      localized.message = translateEditProfileError(localized.message);
    }

    if (localized.types && typeof localized.types === 'object') {
      const localizedTypes: Record<string, unknown> = { ...localized.types };
      for (const [typeKey, typeValue] of Object.entries(localizedTypes)) {
        if (typeof typeValue === 'string') {
          localizedTypes[typeKey] = translateEditProfileError(typeValue);
        }
      }
      localized.types = localizedTypes;
    }

    for (const [key, value] of Object.entries(localized)) {
      if (
        key === 'message' ||
        key === 'type' ||
        key === 'ref' ||
        key === 'types'
      )
        continue;
      if (value && typeof value === 'object') {
        localized[key] = localizeErrorsRef.current(value);
      }
    }

    return localized;
  };
  const localizeErrors = useCallback(
    (errors: unknown): unknown => localizeErrorsRef.current(errors),
    [],
  );

  const resolver = useMemo(
    () =>
      async (...args: Parameters<typeof baseResolver>) => {
        const result = await baseResolver(...args);
        return {
          ...result,
          errors: localizeErrors(result.errors) as typeof result.errors,
        };
      },
    [baseResolver, localizeErrors],
  );

  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      avatarUrl: person?.avatarUrl || '',
      name: person?.name || '',
      surname: person?.surname || '',
      nickname: person?.nickname || '',
      description: person?.description || '',
      leadImageUrl: person?.leadImageUrl || '',
      id: person?.id,
      links: person?.links || [],
      email: person?.email || '',
      location: person?.location || '',
      currency: resolveSupportedCurrency(person?.currency),
    },
    mode: 'onChange',
  });

  useScrollToErrors(form, formRef);

  const handleSubmit = async (values: FormData) => {
    try {
      const saved = await onEdit(values);
      await onUpdate?.(saved ?? undefined);
    } catch (e) {
      console.log(e);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <ModalStickyNavigation
        contextTitle={tModalAside('editProfile')}
        closeUrl={closeUrl}
        showBack={false}
      />
      <Form {...form}>
        <form
          ref={formRef}
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-8"
        >
          <div className="flex flex-col gap-5">
            <div className="flex flex-col-reverse md:flex-row gap-5 justify-between">
              <div className="flex items-center space-x-2">
                <FormField
                  control={form.control}
                  name="avatarUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <UploadAvatar
                          defaultImage={
                            typeof person?.avatarUrl === 'string'
                              ? person?.avatarUrl
                              : undefined
                          }
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-between items-center w-full">
                  <div className="flex flex-col">
                    <div className="flex gap-1 mb-1">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                disabled={isLoading}
                                placeholder={tProfile(
                                  'editForm.placeholders.firstName',
                                )}
                                required
                                aria-required="true"
                                rightIcon={
                                  !field.value && (
                                    <RequirementMark className="text-4" />
                                  )
                                }
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="surname"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                disabled={isLoading}
                                placeholder={tProfile(
                                  'editForm.placeholders.lastName',
                                )}
                                rightIcon={
                                  !field.value && (
                                    <RequirementMark className="text-4" />
                                  )
                                }
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="nickname"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              placeholder={tProfile(
                                'editForm.placeholders.nickname',
                              )}
                              rightIcon={
                                !field.value && (
                                  <RequirementMark className="text-4" />
                                )
                              }
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>
            <Separator />
            <FormField
              control={form.control}
              name="leadImageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <UploadLeadImage
                      uploadText={tProfile.rich(
                        'editForm.uploadLeadImageLabel',
                        {
                          accent: (chunks) => (
                            <span className="text-accent-11">{chunks}</span>
                          ),
                        },
                      )}
                      cropDialogLabels={{
                        title: tCommon('uploadLeadImage.cropTitle'),
                        description: tCommon('uploadLeadImage.cropDescription'),
                        cancel: tCommon('uploadLeadImage.cancel'),
                        confirm: tCommon('uploadLeadImage.confirm'),
                      }}
                      messages={{
                        dropHere: tCommon('uploadLeadImage.dropHere'),
                        fileTooLarge: tCommon('uploadLeadImage.fileTooLarge'),
                        uploadFailed: tCommon('uploadLeadImage.uploadFailed'),
                      }}
                      defaultImage={
                        typeof person?.leadImageUrl === 'string'
                          ? person?.leadImageUrl
                          : undefined
                      }
                      onChange={field.onChange}
                      enableImageResizer={true}
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
                  <FormControl>
                    <Textarea
                      placeholder={tProfile(
                        'editForm.placeholders.lifePurpose',
                      )}
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-3 flex-col">
              <div className="flex justify-between">
                <Text className={cn('text-2', 'text-neutral-11')}>
                  {tProfile('editForm.labels.email')}
                </Text>
                <span className="flex items-center">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            disabled={isLoading}
                            placeholder={tProfile(
                              'editForm.placeholders.email',
                            )}
                            className="w-60"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </span>
              </div>
              <div className="flex justify-between">
                <Text className={cn('text-2', 'text-neutral-11')}>
                  {tProfile('editForm.labels.location')}
                </Text>
                <span className="flex items-center">
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            disabled={isLoading}
                            placeholder={tProfile(
                              'editForm.placeholders.location',
                            )}
                            className="w-60"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </span>
              </div>
              <div className="flex justify-between">
                <Text className={cn('text-2', 'text-neutral-11')}>
                  {tProfile('editForm.labels.currency')}
                </Text>
                <span className="flex items-center">
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Select
                            value={field.value || DEFAULT_CURRENCY}
                            onValueChange={field.onChange}
                            disabled={isLoading}
                          >
                            <SelectTrigger className="w-60">
                              <SelectValue
                                placeholder={tProfile(
                                  'editForm.placeholders.currency',
                                )}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {CURRENCY_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </span>
              </div>
              <div>
                <FormField
                  control={form.control}
                  name="links"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Links
                          links={field.value || []}
                          onChange={field.onChange}
                          errors={form.formState.errors.links}
                          placeholder={tSpaces('addYourUrl')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <div className="flex justify-end w-full">
              <div className="flex flex-col items-end gap-2">
                {error && (
                  <Text className="text-error-11 text-sm">{error}</Text>
                )}
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    variant="default"
                    className="rounded-lg justify-start text-white w-fit"
                    disabled={isLoading}
                  >
                    {error
                      ? tProfile('editForm.actions.retry')
                      : tProfile('editForm.actions.save')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};

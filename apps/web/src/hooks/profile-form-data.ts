/**
 * Shared type for profile form data used by both
 * use-create-profile and use-edit-profile hooks.
 */
export interface ProfileFormData {
  avatarUrl?: string | File;
  leadImageUrl?: string | File;
  [key: string]: unknown;
}

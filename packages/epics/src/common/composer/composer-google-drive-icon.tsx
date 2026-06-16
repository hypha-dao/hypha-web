'use client';

type ComposerGoogleDriveIconProps = {
  className?: string;
};

/** Simplified Google Drive mark for composer menus. */
export function ComposerGoogleDriveIcon({
  className = 'h-4 w-4 shrink-0',
}: ComposerGoogleDriveIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path fill="#0F9D58" d="M7.71 3.5 1.15 15h6.56L14.29 3.5H7.71Z" />
      <path fill="#F4B400" d="M16.29 3.5 9.73 15h6.56l6.56-11.5h-6.56Z" />
      <path fill="#4285F4" d="M12 20.5 5.44 9h6.56L18.56 20.5H12Z" />
    </svg>
  );
}

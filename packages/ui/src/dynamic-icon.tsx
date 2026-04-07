import * as icons from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';

export type LucideReactIcon = keyof typeof icons;

interface IconProps extends Omit<LucideProps, 'ref'> {
  name: LucideReactIcon;
}

export function DynamicIcon({ name, color, size, ...props }: IconProps) {
  const LucideIcon = icons[name] as ForwardRefExoticComponent<
    Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>
  >;

  if (!LucideIcon) {
    return null;
  }

  return <LucideIcon color={color} size={size} {...props} />;
}

import { Card } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { cva, VariantProps } from 'class-variance-authority';

const cardButtonVariants = cva(
  'flex p-6 cursor-pointer space-x-4 items-center',
  {
    variants: {
      selected: {
        true: 'border-neutral-9',
        false: 'hover:border-neutral-5',
      },
      colorVariant: {
        accent: '',
        error: '',
        warn: '',
        neutral: '',
        success: '',
        tension: '',
        insight: '',
      },
    },
    compoundVariants: [
      // Accent variants
      {
        colorVariant: 'accent',
        selected: true,
        className: 'border-accent-9',
      },
      {
        colorVariant: 'accent',
        selected: false,
        className: 'hover:border-accent-5',
      },
      // Error variants
      {
        colorVariant: 'error',
        selected: true,
        className: 'border-error-9',
      },
      {
        colorVariant: 'error',
        selected: false,
        className: 'hover:border-error-5',
      },
      // Warn variants
      {
        colorVariant: 'warn',
        selected: true,
        className: 'border-warning-10',
      },
      {
        colorVariant: 'warn',
        selected: false,
        className: 'hover:border-warning-8',
      },
      // Neutral variants
      {
        colorVariant: 'neutral',
        selected: true,
        className: 'border-neutral-9',
      },
      {
        colorVariant: 'neutral',
        selected: false,
        className: 'hover:border-neutral-5',
      },
      // Success variants
      {
        colorVariant: 'success',
        selected: true,
        className: 'border-success-11',
      },
      {
        colorVariant: 'success',
        selected: false,
        className: 'hover:border-success-5',
      },
      // Tension variants
      {
        colorVariant: 'tension',
        selected: true,
        className: 'border-tension-10',
      },
      {
        colorVariant: 'tension',
        selected: false,
        className: 'hover:border-tension-9',
      },
      // Insight variants
      {
        colorVariant: 'insight',
        selected: true,
        className: 'border-insight-9',
      },
      {
        colorVariant: 'insight',
        selected: false,
        className: 'hover:border-insight-8',
      },
    ],
    defaultVariants: {
      colorVariant: 'neutral',
      selected: false,
    },
  },
);

export interface CardButtonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardButtonVariants> {
  title?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  onClick: () => void;
}

export const CardButton = ({
  title,
  description,
  selected,
  colorVariant,
  children,
  className,
  onClick,
}: CardButtonProps) => {
  return (
    <Card
      className={cn(cardButtonVariants({ selected, colorVariant }), className)}
      onClick={onClick}
    >
      {children ? (
        children
      ) : (
        <div className="flex flex-col">
          <span className="text-2 font-medium">{title}</span>
          <span className="text-1 text-neutral-11">
            <span>{description}</span>
          </span>
        </div>
      )}
    </Card>
  );
};

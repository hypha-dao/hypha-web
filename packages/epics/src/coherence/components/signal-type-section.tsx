import type { ReactNode } from 'react';
import type { CardButtonColorVariant } from '../../common/card-button';
import type { LucideReactIcon } from '@hypha-platform/ui';
import { CoherenceTypeButton } from './coherence-type-button';

/** Separates the last type card (Issue) from the next section's top rule. */
export const SIGNAL_TYPE_SECTION_CLASS =
  'flex flex-col gap-6 border-t border-border pb-8 pt-8';

export type SignalTypePickerOption = {
  icon: LucideReactIcon;
  title: string;
  description: string;
  type: string;
  colorVariant: CardButtonColorVariant;
};

export function SignalTypeSection({ children }: { children: ReactNode }) {
  return (
    <section
      className={SIGNAL_TYPE_SECTION_CLASS}
      data-testid="signal-type-section"
    >
      {children}
    </section>
  );
}

export function SignalTypePickerGrid({
  options,
  selected,
  onSelect,
}: {
  options: readonly SignalTypePickerOption[];
  selected?: string;
  onSelect: (type: string) => void;
}) {
  return (
    <span
      className="grid w-full grid-cols-2 gap-2"
      data-testid="signal-type-grid"
    >
      {options.map((option) => (
        <CoherenceTypeButton
          key={`type-option-${option.type}`}
          icon={option.icon}
          title={option.title}
          description={option.description}
          colorVariant={option.colorVariant}
          selected={selected === option.type}
          onClick={() => onSelect(option.type)}
          data-signal-type={option.type}
          data-testid={`signal-type-option-${option.type}`}
        />
      ))}
    </span>
  );
}

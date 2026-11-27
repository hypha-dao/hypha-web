'use client';

import { useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import {
  resolveEffectiveBoard,
  type SignalFormValues,
  type SignalWorkflowConfig,
} from '@hypha-platform/core/client';
import {
  activeSignalBoards,
  hasSignalBoardChoice,
} from '../lib/signal-board-label';

/**
 * The board a signal sits on: the rows of the swimlane view (#2763 D5/D6).
 * Renders nothing while the space has a single board, since there is nothing
 * to choose; the form still saves the default board. If the space's boards
 * could not be loaded, says so with a retry instead of hiding silently.
 */
export function SignalBoardField({
  workflow,
  loadError,
  onRetry,
  disabled = false,
}: {
  workflow: SignalWorkflowConfig | null | undefined;
  loadError?: unknown;
  onRetry?: () => void;
  disabled?: boolean;
}) {
  const form = useFormContext<SignalFormValues>();
  const t = useTranslations('CoherenceTab');
  if (!workflow && loadError) {
    return (
      <div
        data-testid="signal-board-field-error"
        className="flex flex-col gap-3"
      >
        <Label className="text-foreground">{t('signalFormBoard')}</Label>
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 border border-error-6 bg-error-2 px-3 py-2 text-1 text-error-11"
        >
          <span>{t('signalBoardsLoadFailed')}</span>
          {onRetry ? (
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              size="sm"
              disabled={disabled}
              onClick={onRetry}
            >
              {t('signalLoadRetry')}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }
  if (!workflow || !hasSignalBoardChoice(workflow)) return null;
  const boards = activeSignalBoards(workflow);

  return (
    <FormField
      control={form.control}
      name="board"
      render={({ field }) => (
        <FormItem data-signal-field="board">
          <FormLabel className="text-foreground">
            {t('signalFormBoard')}
          </FormLabel>
          <Select
            value={resolveEffectiveBoard(field.value, workflow)}
            onValueChange={field.onChange}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {boards.map((board) => (
                <SelectItem key={board.slug} value={board.slug}>
                  {board.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormDescription>{t('signalFormBoardHint')}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

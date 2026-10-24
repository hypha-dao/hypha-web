'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@hypha-platform/ui';

type HumanChatPanelErrorBoundaryInnerProps = {
  children: ReactNode;
  fallbackTitle: string;
  retryLabel: string;
};

type HumanChatPanelErrorBoundaryState = {
  hasError: boolean;
};

/**
 * Keeps a chat-thread throw from replacing the whole document with the
 * maintenance page (and from surviving a reload of that dead tree).
 */
class HumanChatPanelErrorBoundaryInner extends Component<
  HumanChatPanelErrorBoundaryInnerProps,
  HumanChatPanelErrorBoundaryState
> {
  state: HumanChatPanelErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): HumanChatPanelErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      '[HumanChatPanel] Chat panel crashed',
      error,
      info.componentStack,
    );
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <div
        role="alert"
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-center"
      >
        <p className="text-sm text-muted-foreground">
          {this.props.fallbackTitle}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => this.setState({ hasError: false })}
        >
          {this.props.retryLabel}
        </Button>
      </div>
    );
  }
}

export function HumanChatPanelErrorBoundary({
  children,
}: {
  children: ReactNode;
}) {
  const t = useTranslations('HumanChatPanel');
  return (
    <HumanChatPanelErrorBoundaryInner
      fallbackTitle={t('connectionRetryFailedDescription')}
      retryLabel={t('connectionLostRetry')}
    >
      {children}
    </HumanChatPanelErrorBoundaryInner>
  );
}

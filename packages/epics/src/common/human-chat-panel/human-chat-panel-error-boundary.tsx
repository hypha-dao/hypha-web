'use client';

import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@hypha-platform/ui';

import {
  CHAT_PANEL_CRASH_FALLBACK_MESSAGE_KEY,
  chatPanelErrorBoundaryFromError,
  idleChatPanelErrorBoundaryState,
  retryChatPanelErrorBoundary,
  type ChatPanelErrorBoundaryState,
} from './human-chat-panel-error-boundary-state';

type HumanChatPanelErrorBoundaryInnerProps = {
  children: ReactNode;
  fallbackTitle: string;
  retryLabel: string;
};

/**
 * Keeps a chat-thread throw from replacing the whole document with the
 * maintenance page (and from surviving a reload of that dead tree).
 */
class HumanChatPanelErrorBoundaryInner extends Component<
  HumanChatPanelErrorBoundaryInnerProps,
  ChatPanelErrorBoundaryState
> {
  state: ChatPanelErrorBoundaryState = idleChatPanelErrorBoundaryState();

  static getDerivedStateFromError(
    error: Error,
  ): Pick<ChatPanelErrorBoundaryState, 'hasError' | 'errorMessage'> {
    return {
      hasError: true,
      errorMessage:
        error instanceof Error ? error.message : String(error ?? 'Unknown'),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      '[HumanChatPanel] Chat panel crashed',
      error,
      info.componentStack,
    );
    // getDerivedStateFromError already recorded the message — do not setState
    // again here (extra updates during recovery can amplify update-depth faults).
  }

  handleRetry = () => {
    this.setState(retryChatPanelErrorBoundary);
  };

  render() {
    if (!this.state.hasError) {
      return (
        <Fragment key={this.state.retryNonce}>{this.props.children}</Fragment>
      );
    }
    return (
      <div
        role="alert"
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-center"
        data-testid="chat-panel-crashed"
      >
        <p className="text-sm text-muted-foreground">
          {this.props.fallbackTitle}
        </p>
        {this.state.errorMessage ? (
          <pre
            className="max-h-40 w-full max-w-md overflow-auto whitespace-pre-wrap break-words rounded-none border border-border bg-muted/40 px-3 py-2 text-left font-mono text-[11px] leading-snug text-destructive"
            data-testid="chat-panel-crash-detail"
          >
            {this.state.errorMessage}
          </pre>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={this.handleRetry}
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
      fallbackTitle={t(CHAT_PANEL_CRASH_FALLBACK_MESSAGE_KEY)}
      retryLabel={t('connectionLostRetry')}
    >
      {children}
    </HumanChatPanelErrorBoundaryInner>
  );
}

type HumanChatPanelMessageErrorBoundaryProps = {
  children: ReactNode;
  /** Quiet fallback so one bad row does not wipe the whole timeline. */
  fallbackLabel: string;
};

class HumanChatPanelMessageErrorBoundaryInner extends Component<
  HumanChatPanelMessageErrorBoundaryProps,
  ChatPanelErrorBoundaryState
> {
  state: ChatPanelErrorBoundaryState = idleChatPanelErrorBoundaryState();

  static getDerivedStateFromError(
    error: Error,
  ): Pick<ChatPanelErrorBoundaryState, 'hasError' | 'errorMessage'> {
    return {
      hasError: true,
      errorMessage:
        error instanceof Error ? error.message : String(error ?? 'Unknown'),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      '[HumanChatPanel] Message row crashed',
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
        className="px-4 py-2 text-xs text-muted-foreground"
        data-testid="chat-message-row-crashed"
      >
        {this.props.fallbackLabel}
        {this.state.errorMessage ? (
          <span className="mt-1 block font-mono text-[10px] text-destructive/80">
            {this.state.errorMessage}
          </span>
        ) : null}
      </div>
    );
  }
}

/** Isolates a single timeline row so one throw cannot trip the messages EB. */
export function HumanChatPanelMessageErrorBoundary({
  children,
  fallbackLabel,
}: HumanChatPanelMessageErrorBoundaryProps) {
  return (
    <HumanChatPanelMessageErrorBoundaryInner fallbackLabel={fallbackLabel}>
      {children}
    </HumanChatPanelMessageErrorBoundaryInner>
  );
}

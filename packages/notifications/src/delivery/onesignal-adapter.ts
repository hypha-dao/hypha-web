import { sendPushByAlias } from '../sdk/send-push';
import { sendEmailByAlias } from '../sdk/send-email';
import type {
  DecidedNotification,
  NotificationPushContent,
} from '../core/types';
import type { DispatchResult, NotificationDispatcher } from './types';

function pushGroupKey(push: NotificationPushContent): string {
  return JSON.stringify(push);
}

/**
 * First/default `NotificationDispatcher` implementation (implementation-plan.md §2, §3.B) —
 * wraps the existing `sdk/*` OneSignal calls. Push is grouped by identical content before
 * sending, so recipients sharing content (the common case — e.g. every `proposal.created` member
 * push) still go out as one OneSignal call, matching today's per-action batching rather than one
 * call per recipient. Email is personalised per recipient today (e.g. `user_name`), so it's sent
 * individually, same as today.
 */
export const onesignalDispatcher: NotificationDispatcher = {
  async sendMany(
    notifications: DecidedNotification[],
  ): Promise<DispatchResult> {
    const onesignalAppId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '';
    if (!onesignalAppId) {
      throw new Error('ONESIGNAL_APP_ID environment variable is not set');
    }

    const pushGroups = new Map<
      string,
      { push: NotificationPushContent; usernames: string[] }
    >();
    const emailSends: Promise<unknown>[] = [];

    for (const notification of notifications) {
      if (notification.channels.includes('push') && notification.content.push) {
        const key = pushGroupKey(notification.content.push);
        const group = pushGroups.get(key);
        if (group) group.usernames.push(notification.recipient.personSlug);
        else
          pushGroups.set(key, {
            push: notification.content.push,
            usernames: [notification.recipient.personSlug],
          });
      }

      if (
        notification.channels.includes('email') &&
        notification.content.email
      ) {
        const email = notification.content.email;
        emailSends.push(
          sendEmailByAlias({
            app_id: onesignalAppId,
            alias: {
              include_aliases: {
                external_id: [notification.recipient.personSlug],
              },
            },
            content:
              email.kind === 'template'
                ? {
                    template_id: email.templateId,
                    custom_data: email.customData,
                  }
                : { email_subject: email.subject, email_body: email.body },
          }),
        );
      }

      if (notification.channels.includes('in_app')) {
        // Reserved channel — no in-app notification store exists yet (implementation-plan.md §9,
        // decisions.md forward note on #2498). Nothing to send to until that lands.
        console.warn(
          '[notifications] in_app channel requested but no in-app delivery is implemented yet',
          { personSlug: notification.recipient.personSlug },
        );
      }
    }

    const pushSends = Array.from(pushGroups.values()).map(
      ({ push, usernames }) =>
        sendPushByAlias({
          app_id: onesignalAppId,
          alias: { include_aliases: { external_id: usernames } },
          content:
            push.kind === 'template'
              ? { template_id: push.templateId, custom_data: push.customData }
              : { contents: push.contents, headings: push.headings },
          url: push.url,
        }),
    );

    const results = await Promise.allSettled([...pushSends, ...emailSends]);
    const failed = results.filter((r) => r.status === 'rejected');
    // Message only: the full error carries the OneSignal response (recipient aliases included);
    // `notify()` already logged its redacted detail.
    failed.forEach((r) => {
      const reason = (r as PromiseRejectedResult).reason;
      console.error(
        '[notifications] delivery failed',
        reason instanceof Error ? reason.message : String(reason),
      );
    });

    return { sent: results.length - failed.length, failed: failed.length };
  },
};

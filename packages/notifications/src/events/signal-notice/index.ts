import { registerEventHandlers } from '../../core/registry';
import { buildSignalNoticeContent } from './content';
import { resolveSignalNoticeRecipients } from './resolver';

export { buildSignalNoticeEvent } from './resolver';
export { buildSignalNoticeContent } from './content';
export { buildSignalNoticeEmail } from './email';

registerEventHandlers('signal.notice', {
  resolver: resolveSignalNoticeRecipients,
  contentBuilder: buildSignalNoticeContent,
});

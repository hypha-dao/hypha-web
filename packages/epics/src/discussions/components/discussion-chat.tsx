import { DiscussionMessageProps } from './discussion-message';
import { DiscussionMessage } from './discussion-message';
import { FormInput } from '../../interactions/components/form-input';

export type DiscussionChatProps = {
  messages: DiscussionMessageProps[];
  isLoading: boolean;
};

export const DiscussionChat = ({
  messages,
  isLoading,
}: DiscussionChatProps) => {
  return (
    <div>
      <div className="flex flex-col mb-4">
        {messages.map((message) => (
          <DiscussionMessage
            replies={message.replies}
            isLoading={isLoading}
            message={message.message}
            creator={message.creator}
            date={message.date}
          />
        ))}
      </div>
      <FormInput />
    </div>
  );
};

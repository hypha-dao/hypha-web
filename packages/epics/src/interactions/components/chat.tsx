import { MessageProps } from './message';
import { Message } from './message';
import { FormInput } from './form-input';

export type ChatProps = {
  messages: MessageProps[];
  isLoading: boolean;
};

export const Chat = ({ messages, isLoading }: ChatProps) => {
  return (
    <div>
      <div className="flex flex-col mb-4">
        {messages.map((message) => (
          <Message
            key={message.id}
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

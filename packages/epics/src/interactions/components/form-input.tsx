import { Input } from '@hypha-platform/ui';
import { RxChatBubble, RxPaperPlane } from 'react-icons/rx';

export const FormInput = () => {
  return (
    <Input
      leftIcon={<RxChatBubble />}
      rightIcon={<RxPaperPlane />}
      placeholder="Type a comment here"
    />
  );
};

// import { Asterisk as AsteriskIcon } from 'lucide-react';
import { Text } from '@radix-ui/themes';
import clsx from 'clsx';

interface RequirementMarkProps {
  className?: string;
}

export const RequirementMark = ({ className }: RequirementMarkProps) => {
  return (
    <Text className={clsx('inline text-destructive', className)}>
      {/* <AsteriskIcon size={18} /> */}*
    </Text>
  );
};

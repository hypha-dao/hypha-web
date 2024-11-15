import { Avatar, AvatarImage } from "@hypha-platform/ui";

export type ButtonProfileProps = {
  avatarSrc: string;
  userName?: string;
};

export const ButtonProfile = ({ avatarSrc, userName }: ButtonProfileProps) => {
  return (
    <div>
      <Avatar className="w-10 h-10 rounded-lg">
        <AvatarImage src={avatarSrc} alt={`${userName}'s avatar`} />
      </Avatar>
    </div>
  );
};

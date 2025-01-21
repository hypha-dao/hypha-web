import clsx from 'clsx';
import { Avatar, AvatarImage } from '../avatar';

type Dao = {
  logo: string;
  id: string;
};

type LeftMenuProps = {
  activeDao: Dao;
  connectedDaos: Dao[];
  className?: string;
};

export const MenuLeft = ({
  activeDao: { logo },
  connectedDaos,
  className,
}: LeftMenuProps) => {
  return (
    <div
      id="menu-left"
      className={clsx(
        'fixed top-0 left-0 h-full flex flex-col w-20 items-center py-4 space-y-8 bg-background-2',
        className
      )}
    >
      <div id="active-dao">
        <Avatar>
          <AvatarImage src={logo} alt="logo" />
        </Avatar>
      </div>
      <div id="menu-left-spacer" className="flex-grow" />
      <div id="connected-daos" className="flex flex-col space-y-2">
        {connectedDaos.map(({ logo, id }) => (
          <Avatar key={id}>
            <AvatarImage src={logo} alt="logo" />
          </Avatar>
        ))}
      </div>
      <div id="user-avatar">
        <Avatar>
          <AvatarImage
            src={
              'https://images.unsplash.com/photo-1544005313-94ddf0286df2?&w=64&h=64&dpr=2&q=70&crop=faces&fit=crop'
            }
            alt="logo"
          />
        </Avatar>
      </div>
    </div>
  );
};

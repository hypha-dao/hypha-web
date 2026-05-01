type TabScreenTitleProps = {
  title: string;
};

export function TabScreenTitle({ title }: TabScreenTitleProps) {
  return (
    <h1 className="text-6 font-semibold tracking-tight text-foreground">
      {title}
    </h1>
  );
}

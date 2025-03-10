export const Html: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <html lang="en" suppressHydrationWarning className={className}>
      <head>
        <link
          rel="icon"
          href="https://hypha.earth/wp-content/uploads/2023/07/cropped-favicon-32x32.png"
          sizes="32x32"
        />
        <link
          rel="icon"
          href="https://hypha.earth/wp-content/uploads/2023/07/cropped-favicon-192x192.png"
          sizes="192x192"
        />
      </head>
      <body className="flex flex-col w-full h-full">{children}</body>
    </html>
  );
};
